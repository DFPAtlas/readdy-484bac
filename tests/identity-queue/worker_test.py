"""Isolated queue adapter tests. The HTTP transport never opens a connection."""
import base64
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from doc_verify import worker
from doc_verify.store import DocStore


SUBJECT = "00000000-0000-0000-0000-000000000001"


def fixture_token(exp):
    payload = {"sub": SUBJECT, "role": "authenticated", "iss": "https://synthetic.invalid/auth/v1", "exp": exp}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return "synthetic." + encoded + ".signature"


class QueueAdapterTest(unittest.IsolatedAsyncioTestCase):
    async def test_schema_headers_and_scoped_calls(self):
        with tempfile.TemporaryDirectory() as tmp:
            token = Path(tmp) / "token"
            token.write_text(fixture_token(int(time.time()) + 600))
            with patch.dict("os.environ", {
                "QUICKGUARD_SUPABASE_URL": "https://synthetic.invalid",
                "QUICKGUARD_PUBLISHABLE_KEY": "sb_publishable_synthetic",
                "IDENTITY_WORKER_TOKEN_FILE": str(token),
                "IDENTITY_WORKER_SUBJECT": SUBJECT,
            }):
                store = DocStore()
            seen = []

            def handle(request):
                self.assertEqual(request.headers["Authorization"], "Bearer " + token.read_text())
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
                token.write_text(fixture_token(int(time.time()) - 60))
                with self.assertRaisesRegex(ValueError, "token unavailable"):
                    await store.ready()
                replacement = token.with_suffix(".new")
                replacement.write_text(fixture_token(int(time.time()) + 600))
                replacement.replace(token)
                self.assertTrue(await store.ready())
            self.assertEqual(len(seen), 6)

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
                with patch.object(worker.vision, "ready", AsyncMock(return_value=True)):
                    self.assertFalse(await worker.run_cycle(store))
                    self.assertTrue(worker.healthy(marker, 30))
                    store.claim.return_value = {"id": "fixture"}
                    with self.assertLogs(worker.log, level="WARNING") as logs, patch.object(
                            worker, "check", AsyncMock(side_effect=ValueError("synthetic-secret-signed-url"))):
                        self.assertFalse(await worker.run_cycle(store))
                    self.assertNotIn("synthetic-secret-signed-url", " ".join(logs.output))
                    self.assertFalse(marker.exists())
        store.finish.assert_awaited_once_with({"id": "fixture"}, "retry", ["processing_failed"])

    async def test_inference_down_removes_readiness_before_claim(self):
        store = AsyncMock()
        store.ready.return_value = True
        with tempfile.TemporaryDirectory() as tmp:
            marker = Path(tmp) / "ready"
            marker.touch()
            with patch.object(worker, "READINESS", marker), patch.object(
                    worker.vision, "ready", AsyncMock(side_effect=ConnectionError)):
                with self.assertRaises(ConnectionError):
                    await worker.run_cycle(store)
                self.assertFalse(marker.exists())
        store.claim.assert_not_called()

    async def test_bad_worker_signature_denies_readiness(self):
        with tempfile.TemporaryDirectory() as tmp:
            token = Path(tmp) / "token"
            token.write_text(fixture_token(int(time.time()) + 600))
            with patch.dict("os.environ", {
                "QUICKGUARD_SUPABASE_URL": "https://synthetic.invalid",
                "QUICKGUARD_PUBLISHABLE_KEY": "sb_publishable_synthetic",
                "IDENTITY_WORKER_TOKEN_FILE": str(token),
                "IDENTITY_WORKER_SUBJECT": SUBJECT,
            }):
                store = DocStore()
            await store.http.aclose()
            store.http = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(401)))
            async with store.http:
                with self.assertRaises(httpx.HTTPStatusError):
                    await store.ready()

    async def test_clean_ai_result_cannot_approve(self):
        from doc_verify.extraction import Extraction
        from doc_verify.models import DlExtract, Result

        store = AsyncMock()
        with patch.object(worker, "decode", AsyncMock(return_value=type("Fixture", (), {"flags": []})())), patch.object(
                worker, "extract", AsyncMock(return_value=Extraction(
                    DlExtract(readable=True, is_uk_driving_licence=True), {}, []))):
            with patch.object(worker, "evaluate", return_value=Result("approve", [], [], {})):
                outcome, reasons = await worker.check(store, {})
        self.assertEqual(outcome, "review")
        self.assertIn("human_document_review_required", reasons)


if __name__ == "__main__":
    unittest.main()
