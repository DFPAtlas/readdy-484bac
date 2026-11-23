"""Lease-scoped queue access with a dedicated Supabase Auth identity."""
import os
from pathlib import Path
from urllib.parse import urlsplit

import httpx


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
        self.http = httpx.AsyncClient(timeout=httpx.Timeout(30, connect=8), trust_env=False)

    def headers(self) -> dict:
        token = self.token_file.read_text().strip()
        if token.count(".") != 2 or any(char.isspace() for char in token):
            raise ValueError("Invalid worker access token")
        return {"apikey": self.api_key, "Authorization": f"Bearer {token}"}

    async def rpc(self, name: str, payload: dict | None = None):
        response = await self.http.post(f"{self.base_url}/rest/v1/rpc/{name}", json=payload or {},
                                        headers={**self.headers(), "Content-Profile": "app",
                                                 "Accept-Profile": "app"})
        response.raise_for_status()
        return response.json()

    async def claim(self) -> dict | None:
        return await self.rpc("claim_identity_document_check")

    async def finish(self, job: dict, outcome: str, reasons: list[str]) -> str:
        return await self.rpc("finish_identity_document_check", {
            "p_job": job["id"], "p_token": job["token"], "p_outcome": outcome, "p_reasons": reasons,
        })

    async def broker(self, body: dict) -> httpx.Response:
        response = await self.http.post(f"{self.base_url}/functions/v1/identity-document-download",
                                        headers=self.headers(), json=body)
        response.raise_for_status()
        return response

    async def download(self, job: dict, kind: str) -> bytes:
        response = await self.broker({"job": job["id"], "token": job["token"], "kind": kind})
        if not response.content or len(response.content) > 5 * 1024 * 1024:
            raise ValueError("Document size outside worker limits")
        return response.content

    async def ready(self) -> bool:
        if await self.rpc("identity_document_queue_ready") is not True:
            return False
        return (await self.broker({"ready": True})).status_code == 204
