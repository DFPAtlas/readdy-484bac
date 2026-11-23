"""Lease-scoped queue access with a dedicated Supabase Auth identity."""
import base64
import json
import os
import time
from uuid import UUID
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from .transport import DOCUMENT_LIMIT, RESPONSE_LIMIT, exchange


class DocStore:
    def __init__(self) -> None:
        self.base_url = os.environ["QUICKGUARD_SUPABASE_URL"].rstrip("/")
        url = urlsplit(self.base_url)
        if (url.scheme != "https" or not url.hostname or url.username or url.password
                or url.path or url.query or url.fragment):
            raise ValueError("Invalid Supabase URL")
        self.api_key = os.environ["QUICKGUARD_PUBLISHABLE_KEY"]
        if not self.api_key.startswith("sb_publishable_"):
            raise ValueError("A Supabase publishable key is required")
        self.token_file = Path(os.environ["IDENTITY_WORKER_TOKEN_FILE"])
        self.subject = str(UUID(os.environ["IDENTITY_WORKER_SUBJECT"]))
        self.http = httpx.AsyncClient(timeout=httpx.Timeout(30, connect=8), trust_env=False,
                                      follow_redirects=False, headers={"Accept-Encoding": "identity"})

    def headers(self) -> dict:
        with self.token_file.open() as file:
            token = file.read(8193).strip()
        try:
            if len(token) > 8192 or any(char.isspace() for char in token):
                raise ValueError
            _, claims, _ = token.split(".")
            data = json.loads(base64.urlsafe_b64decode(claims + "=" * (-len(claims) % 4)))
            if (data.get("sub") != self.subject or data.get("role") != "authenticated" or
                    data.get("iss") != self.base_url + "/auth/v1" or
                    type(data.get("exp")) is not int or data["exp"] <= time.time() + 30):
                raise ValueError
        except Exception:
            raise ValueError("Worker token unavailable or invalid") from None
        # PostgREST validates the signature and permissions. This is a local preflight.
        return {"apikey": self.api_key, "Authorization": f"Bearer {token}"}

    async def rpc(self, name: str, payload: dict | None = None):
        _, data = await exchange(self.http, "POST", f"{self.base_url}/rest/v1/rpc/{name}",
                                 json=payload or {}, limit=RESPONSE_LIMIT, deadline=35,
                                 headers={**self.headers(), "Content-Profile": "app", "Accept-Profile": "app"})
        return json.loads(data)

    async def claim(self) -> dict | None:
        return await self.rpc("claim_identity_document_check")

    async def finish(self, job: dict, outcome: str, reasons: list[str]) -> str:
        return await self.rpc("finish_identity_document_check", {
            "p_job": job["id"], "p_token": job["token"], "p_outcome": outcome, "p_reasons": reasons,
        })

    async def broker(self, body: dict, limit: int) -> tuple[int, bytes]:
        return await exchange(self.http, "POST", f"{self.base_url}/functions/v1/identity-document-download",
                              headers=self.headers(), json=body, limit=limit, deadline=35)

    async def download(self, job: dict, kind: str) -> bytes:
        status, data = await self.broker({"job": job["id"], "token": job["token"], "kind": kind}, DOCUMENT_LIMIT)
        if status != 200 or not data:
            raise ValueError("Document unavailable")
        return data

    async def ready(self) -> bool:
        if await self.rpc("identity_document_queue_ready") is not True:
            return False
        status, _ = await self.broker({"ready": True}, RESPONSE_LIMIT)
        return status == 204
