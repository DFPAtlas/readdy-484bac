"""Network-disabled integration test with real mTLS and synthetic loopback Ollama."""
import io
import json
import os
from pathlib import Path
import ssl
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

import httpx
import pymupdf
from PIL import Image

from doc_verify import gateway, vision
from doc_verify.decoder import decode
from doc_verify.transport import inference_url

DIGEST = "a" * 64
MODEL = "qwen3-vl:8b"


class Stub(BaseHTTPRequestHandler):
    digest = DIGEST
    requests = 0
    tag_reads = 0
    changed_after_chat = False

    def log_message(self, *_):
        pass

    def reply(self, body):
        raw = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        assert self.path == "/api/tags"
        type(self).tag_reads += 1
        self.reply({"models": [{"name": MODEL, "digest": self.digest}]})

    def do_POST(self):
        assert self.path == "/api/chat"
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        assert body["model"] == MODEL and body["keep_alive"] == 0
        type(self).requests += 1
        if self.changed_after_chat:
            type(self).digest = "c" * 64
        self.reply({"model": MODEL, "done": True, "message": {
            "content": '{"readable":false,"is_uk_driving_licence":false}'}})


class SecurityTest(unittest.IsolatedAsyncioTestCase):
    async def test_encrypted_and_authenticated_loopback(self):
        certs = Path("/certs")
        backend = ThreadingHTTPServer(("127.0.0.1", 0), Stub)
        proxy = gateway.Server(("127.0.0.1", 0), gateway.GatewayHandler)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.verify_mode = ssl.CERT_REQUIRED
        ctx.load_verify_locations(str(certs / "client-ca.pem"))
        ctx.load_cert_chain(str(certs / "server.pem"), str(certs / "server.key"))
        proxy.context = ctx
        for service in (backend, proxy):
            threading.Thread(target=service.serve_forever, daemon=True).start()
        env = {
            "IDENTITY_INFERENCE_URL": f"https://127.0.0.1:{proxy.server_port}",
            "IDENTITY_MODEL": MODEL, "IDENTITY_MODEL_DIGEST": DIGEST,
            "IDENTITY_INFERENCE_CA_FILE": str(certs / "server-ca.pem"),
            "IDENTITY_INFERENCE_CERT_FILE": str(certs / "client.pem"),
            "IDENTITY_INFERENCE_KEY_FILE": str(certs / "client.key"),
        }
        try:
            with patch.dict(os.environ, env), patch.object(gateway, "LOCAL_OLLAMA",
                                                          f"http://127.0.0.1:{backend.server_port}"):
                self.assertTrue(await vision.ready())
                image = io.BytesIO()
                Image.new("RGB", (32, 24), "white").save(image, "PNG")
                self.assertFalse((await vision.read_dl([image.getvalue()])).readable)
                self.assertEqual(Stub.requests, 1)
                for prefix in (None, "rogue"):
                    no_approved_client = ssl.create_default_context(cafile=str(certs / "server-ca.pem"))
                    if prefix:
                        no_approved_client.load_cert_chain(str(certs / f"{prefix}.pem"),
                                                           str(certs / f"{prefix}.key"))
                    async with httpx.AsyncClient(verify=no_approved_client, trust_env=False) as client:
                        with self.assertRaises(httpx.HTTPError):
                            await client.post(env["IDENTITY_INFERENCE_URL"] + "/ready", json=vision.payload())
                with patch.dict(os.environ, {"IDENTITY_INFERENCE_CA_FILE": str(certs / "rogue-ca.pem")}):
                    with self.assertRaises(httpx.HTTPError):
                        await vision.ready()
                self.assertEqual(Stub.requests, 1)
                Stub.digest = "b" * 64
                with self.assertRaises(httpx.HTTPStatusError):
                    await vision.read_dl([image.getvalue()])
                self.assertEqual(Stub.requests, 1)
                Stub.digest = DIGEST
                Stub.changed_after_chat = True
                with self.assertRaises(httpx.HTTPStatusError):
                    await vision.read_dl([image.getvalue()])
                self.assertEqual(Stub.requests, 2)
                backend.shutdown()
                backend.server_close()
                with self.assertRaises(httpx.HTTPStatusError):
                    await vision.ready()
        finally:
            proxy.shutdown()
            proxy.server_close()
            backend.server_close()

    async def test_parser_limits_and_ordinary_synthetic_files(self):
        png = io.BytesIO()
        Image.new("RGB", (320, 220), "white").save(png, "PNG")
        self.assertEqual(len((await decode(png.getvalue(), "dl")).images), 1)
        document = pymupdf.open()
        document.new_page().insert_text((25, 30), "SYNTHETIC ADDRESS FIXTURE")
        self.assertEqual(len((await decode(document.tobytes(), "poa")).images), 1)
        for _ in range(4):
            document.new_page()
        self.assertTrue((await decode(document.tobytes(), "poa")).unreadable)
        document.close()
        giant = io.BytesIO()
        Image.new("1", (4000, 4000)).save(giant, "PNG")
        for data in (giant.getvalue(), b"%PDF-corrupt", b"x" * (5 * 1024 * 1024 + 1)):
            self.assertTrue((await decode(data, "poa")).unreadable)

    def test_no_external_or_plaintext_inference_destination(self):
        for url in ("http://127.0.0.1", "https://8.8.8.8", "https://example.test", "https://127.0.0.1/api"):
            with patch.dict(os.environ, {"IDENTITY_INFERENCE_URL": url}):
                with self.assertRaises(ValueError):
                    inference_url()


if __name__ == "__main__":
    unittest.main()
