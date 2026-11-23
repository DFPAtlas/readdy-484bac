"""TRON mTLS gateway. Only fixed loopback Ollama endpoints are reachable."""
import asyncio
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import socket
import ssl
from threading import BoundedSemaphore, Lock
import time

import httpx

from .models import DlExtract, PoaExtract
from .transport import RENDER_LIMIT, REQUEST_LIMIT, RESPONSE_LIMIT, exchange, model_pin, private_ipv4

LOCAL_OLLAMA = "http://127.0.0.1:11434"
SCHEMAS = {"proof": PoaExtract, "licence": DlExtract}
INFERENCE = Lock()


async def require_pin(client, model, digest):
    _, raw = await exchange(client, "GET", LOCAL_OLLAMA + "/api/tags", limit=RESPONSE_LIMIT, deadline=5)
    models = json.loads(raw)["models"]
    matching = [entry for entry in models if entry.get("name") == model]
    if len(matching) != 1 or matching[0].get("digest", "").removeprefix("sha256:") != digest:
        raise ValueError("Local model pin mismatch")


async def handle(path, request):
    model, digest = model_pin()
    if request.get("model") != model or request.get("digest") != digest:
        raise ValueError("Client model pin mismatch")
    async with httpx.AsyncClient(trust_env=False, follow_redirects=False,
                                 timeout=httpx.Timeout(55, connect=3),
                                 headers={"Accept-Encoding": "identity"}) as client:
        await require_pin(client, model, digest)
        if path == "/ready":
            return 204, b""
        from .vision import DL_PROMPT, POA_PROMPT
        kind = request["kind"]
        schema = SCHEMAS[kind]
        image = request["image"]
        if not isinstance(image, str) or not image or len(image) > 2_800_000:
            raise ValueError("Invalid image")
        decoded = base64.b64decode(image, validate=True)
        if len(decoded) > RENDER_LIMIT or not decoded.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Invalid image format")
        body = {
            "model": model, "stream": False, "keep_alive": 0, "format": schema.model_json_schema(),
            "options": {"temperature": 0, "num_predict": 768, "num_ctx": 4096},
            "messages": [{"role": "user", "content": POA_PROMPT if kind == "proof" else DL_PROMPT,
                          "images": [image]}],
        }
        _, raw = await exchange(client, "POST", LOCAL_OLLAMA + "/api/chat", json=body,
                                limit=RESPONSE_LIMIT, deadline=55)
        await require_pin(client, model, digest)
        result = json.loads(raw)
        if result.get("model") != model or result.get("done") is not True:
            raise ValueError("Invalid local inference response")
        data = schema.model_validate_json(result["message"]["content"])
        return 200, data.model_dump_json().encode()


class GatewayHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def setup(self):
        self.request.settimeout(8)
        super().setup()

    def do_POST(self):
        status, response = 503, b""
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if self.path not in ("/ready", "/infer") or not 0 < size <= REQUEST_LIMIT or self.headers.get("Transfer-Encoding"):
                status = 400
            elif INFERENCE.acquire(blocking=False):
                try:
                    end = time.monotonic() + 8
                    body = bytearray()
                    while len(body) < size:
                        remaining = end - time.monotonic()
                        if remaining <= 0:
                            raise TimeoutError
                        self.connection.settimeout(remaining)
                        chunk = self.rfile.read1(min(65536, size - len(body)))
                        if not chunk:
                            raise ValueError
                        body.extend(chunk)
                    self.connection.settimeout(8)
                    status, response = asyncio.run(handle(self.path, json.loads(body)))
                finally:
                    INFERENCE.release()
        except Exception:
            pass
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        if response:
            self.wfile.write(response)


class Server(ThreadingHTTPServer):
    """Bound handshake concurrency, including unauthenticated connections."""
    slots = BoundedSemaphore(4)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            request.close()

    def process_request_thread(self, request, client_address):
        try:
            request.settimeout(5)
            with self.context.wrap_socket(request, server_side=True, do_handshake_on_connect=False) as secured:
                secured.do_handshake()
                super().process_request_thread(secured, client_address)
        except (OSError, socket.timeout):
            request.close()
        finally:
            self.slots.release()

    def handle_error(self, *_):
        pass


def serve():
    model_pin()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.load_verify_locations(cafile=os.environ["IDENTITY_CLIENT_CA_FILE"])
    ctx.load_cert_chain(os.environ["IDENTITY_SERVER_CERT_FILE"], os.environ["IDENTITY_SERVER_KEY_FILE"])
    with Server((private_ipv4(os.environ["IDENTITY_GATEWAY_BIND"]), int(os.environ.get("IDENTITY_GATEWAY_PORT", "8445"))),
                GatewayHandler) as server:
        server.context = ctx
        server.serve_forever()


if __name__ == "__main__":
    try:
        serve()
    except Exception:
        raise SystemExit("Identity inference gateway could not start or stopped unexpectedly") from None
