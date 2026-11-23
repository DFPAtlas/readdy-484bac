"""Isolated queue adapter tests. The HTTP transport never opens a connection."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from doc_verify import worker
from doc_verify.store import DocStore


class QueueAdapterTest(unittest.IsolatedAsyncioTestCase):
    async def test_schema_headers_and_scoped_calls(self):
        with tempfile.TemporaryDirectory() as tmp:
            token = Path(tmp) / "token"
            token.write_text("synthetic.jwt.value")
            with patch.dict("os.environ", {
                "QUICKGUARD_SUPABASE_URL": "https://synthetic.invalid",
                "QUICKGUARD_PUBLISHABLE_KEY": "sb_publishable_synthetic",
                "IDENTITY_WORKER_TOKEN_FILE": str(token),
            }):
                store = DocStore()
            seen = []

            def handle(request):
                self.assertEqual(request.headers["Authorization"], "Bearer synthetic.jwt.value")
                self.assertEqual(request.headers["apikey"], "sb_publishable_synthetic")
                seen.append(request.url.path)
                if request.url.path.startswith("/rest/v1/"):
                    self.assertEqual(request.headers["Content-Profile"], "app")
                    self.assertEqual(request.headers["Accept-Profile"], "app")
                    return httpx.Response(200, content=b"true" if "ready" in request.url.path else b'"done"')
                if b'"ready"' in request.content:
                    return httpx.Response(204)
                self.assertNotIn(b"path", request.content)
                return httpx.Response(200, content=b"synthetic bytes")

            await store.http.aclose()
            store.http = httpx.AsyncClient(transport=httpx.MockTransport(handle))
            async with store.http:
                self.assertTrue(await store.ready())
                job = {"id": "synthetic-job", "token": "synthetic-lease"}
                self.assertEqual(await store.download(job, "licence"), b"synthetic bytes")
                self.assertEqual(await store.finish(job, "review", ["fixture"]), "done")
            self.assertEqual(len(seen), 4)

    async def test_queue_down_cannot_set_readiness(self):
        store = AsyncMock()
        store.ready.return_value = False
        with tempfile.TemporaryDirectory() as tmp:
            marker = Path(tmp) / "ready"
            with patch.object(worker, "READINESS", marker):
                with self.assertRaises(RuntimeError):
                    await worker.run_cycle(store)
            self.assertFalse(marker.exists())
            store.claim.assert_not_called()

    async def test_healthy_empty_queue_and_transient_failure(self):
        store = AsyncMock()
        store.ready.return_value = True
        store.claim.return_value = None
        with tempfile.TemporaryDirectory() as tmp:
            marker = Path(tmp) / "ready"
            with patch.object(worker, "READINESS", marker):
                self.assertFalse(await worker.run_cycle(store))
                self.assertTrue(worker.healthy(marker, 30))
                store.claim.return_value = {"id": "fixture"}
                with patch.object(worker, "check", AsyncMock(side_effect=ValueError)):
                    self.assertTrue(await worker.run_cycle(store))
        store.finish.assert_awaited_once_with({"id": "fixture"}, "retry", ["processing_failed"])

    async def test_clean_ai_result_cannot_approve(self):
        from doc_verify.models import Result

        store = AsyncMock()
        with patch.object(worker.files, "load", return_value=type("Fixture", (), {"flags": [], "unreadable": True})()):
            with patch.object(worker, "evaluate", return_value=Result("approve", [], [], {})):
                outcome, reasons = await worker.check(store, {})
        self.assertEqual(outcome, "review")
        self.assertIn("human_document_review_required", reasons)


if __name__ == "__main__":
    unittest.main()
