"""Identity document worker. All outcomes are advisory and lease-scoped."""
import asyncio
from datetime import date
import ipaddress
import logging
from pathlib import Path
import sys
import time
from urllib.parse import urlsplit

from . import files, vision
from .models import DlExtract, PoaExtract, RuleInput
from .rules import evaluate, parse_doc_date
from .store import DocStore

HEARTBEAT = Path("/tmp/identity-documents.heartbeat")
READINESS = Path("/tmp/identity-documents.ready")
log = logging.getLogger("identity-documents")


def validate_vision_configuration() -> None:
    url = urlsplit(vision.OLLAMA_URL)
    try:
        address = ipaddress.IPv4Address(url.hostname or "")
    except ValueError:
        raise ValueError("Ollama must use an approved private IPv4 endpoint") from None
    private = any(address in ipaddress.IPv4Network(block)
                  for block in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8"))
    if (not private or url.scheme not in ("https", "http") or url.path or url.username or
            url.password or url.query or url.fragment or vision.VISION_MODEL not in ("qwen3-vl:8b", "qwen2.5vl:7b")):
        raise ValueError("Invalid local vision configuration")


async def check(store: DocStore, job: dict) -> tuple[str, list[str]]:
    sia = job.get("sia") or {}
    context = RuleInput(today=date.today(), profile_full_name=job.get("profile_full_name"),
                        profile_postcode=job.get("profile_postcode"),
                        profile_dob=parse_doc_date(job.get("profile_dob")),
                        sia_first_name=sia.get("first"), sia_surname=sia.get("last"))
    poa = files.load(await store.download(job, "proof"), "proof", "poa")
    licence = files.load(await store.download(job, "licence"), "licence", "dl")
    context.poa_flags, context.dl_flags = poa.flags, licence.flags
    context.poa = (PoaExtract(readable=False, is_proof_of_address_document=False) if poa.unreadable
                   else await vision.read_poa(poa.images, poa.text))
    context.dl = (DlExtract(readable=False, is_uk_driving_licence=False) if licence.unreadable
                  else await vision.read_dl(licence.images))
    result = evaluate(context)
    # The models have not passed extraction acceptance.
    if result.decision == "approve":
        return "review", ["human_document_review_required"]
    return result.decision, result.reasons


async def run_cycle(store: DocStore) -> bool:
    if not await store.ready():
        raise RuntimeError("Queue readiness check failed")
    job = await store.claim()
    READINESS.touch()
    if job is None:
        return False
    try:
        outcome, reasons = await asyncio.wait_for(check(store, job), timeout=400)
    except Exception as exc:
        log.warning("Identity check could not run: %s", type(exc).__name__)
        outcome, reasons = "retry", ["processing_failed"]
    await store.finish(job, outcome, reasons)
    READINESS.touch()
    return True


async def heartbeat() -> None:
    while True:
        HEARTBEAT.touch()
        await asyncio.sleep(10)


async def run() -> None:
    validate_vision_configuration()
    store = DocStore()
    READINESS.unlink(missing_ok=True)
    async with store.http, asyncio.TaskGroup() as tasks:
        tasks.create_task(heartbeat())
        while True:
            try:
                if await run_cycle(store):
                    continue
            except Exception as exc:
                READINESS.unlink(missing_ok=True)
                log.warning("Identity queue unavailable: %s", type(exc).__name__)
            await asyncio.sleep(20)


def healthy(path: Path, max_age: int) -> bool:
    try:
        return time.time() - path.stat().st_mtime < max_age
    except FileNotFoundError:
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    if sys.argv[1:] == ["--heartbeat"]:
        raise SystemExit(0 if healthy(HEARTBEAT, 35) else 1)
    if sys.argv[1:] == ["--readiness"]:
        raise SystemExit(0 if healthy(HEARTBEAT, 35) and healthy(READINESS, 480) else 1)
    asyncio.run(run())
