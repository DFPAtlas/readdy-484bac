"""Bounded HTTP exchange and mutually authenticated inference transport."""
import asyncio
import ipaddress
import os
import re
import ssl
from urllib.parse import urlsplit

import httpx

DOCUMENT_LIMIT = 5 * 1024 * 1024
RENDER_LIMIT = 2 * 1024 * 1024
REQUEST_LIMIT = 3 * 1024 * 1024
RESPONSE_LIMIT = 64 * 1024
DIGEST = re.compile(r"[a-f0-9]{64}")
MODELS = {"qwen3-vl:8b", "qwen2.5vl:7b"}


async def exchange(client: httpx.AsyncClient, method: str, url: str, *,
                   limit: int, deadline: float, **kwargs) -> tuple[int, bytes]:
    async with asyncio.timeout(deadline):
        async with client.stream(method, url, **kwargs) as response:
            response.raise_for_status()
            if response.headers.get("Content-Encoding", "identity") != "identity":
                raise ValueError("Unexpected content encoding")
            data = bytearray()
            async for chunk in response.aiter_bytes():
                if len(data) + len(chunk) > limit:
                    raise ValueError("Response limit exceeded")
                data.extend(chunk)
            return response.status_code, bytes(data)


def model_pin() -> tuple[str, str]:
    model = os.environ["IDENTITY_MODEL"]
    digest = os.environ["IDENTITY_MODEL_DIGEST"].removeprefix("sha256:")
    if model not in MODELS or DIGEST.fullmatch(digest) is None:
        raise ValueError("Invalid inference pin")
    return model, digest


def private_ipv4(value: str) -> str:
    address = ipaddress.IPv4Address(value)
    allowed = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8")
    if not any(address in ipaddress.IPv4Network(block) for block in allowed):
        raise ValueError("Inference requires a private IPv4 endpoint")
    return str(address)


def inference_url() -> str:
    url = urlsplit(os.environ["IDENTITY_INFERENCE_URL"])
    private_ipv4(url.hostname or "")
    if (url.scheme != "https" or url.username or url.password or url.path or url.query or url.fragment):
        raise ValueError("Invalid private inference URL")
    return url.geturl()


def inference_client() -> httpx.AsyncClient:
    ctx = ssl.create_default_context(cafile=os.environ["IDENTITY_INFERENCE_CA_FILE"])
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(os.environ["IDENTITY_INFERENCE_CERT_FILE"], os.environ["IDENTITY_INFERENCE_KEY_FILE"])
    return httpx.AsyncClient(verify=ctx, trust_env=False, follow_redirects=False,
                             timeout=httpx.Timeout(35, connect=5),
                             headers={"Accept-Encoding": "identity"})
