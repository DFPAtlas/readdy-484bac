"""Identity document worker. All outcomes are advisory and lease-scoped."""
import asyncio
from datetime import date
import logging
import shutil
from pathlib import Path
import sys
import time

from . import vision
from .decoder import decode
from .extraction import extract
from .transport import inference_client, inference_url, model_pin
from .models import RuleInput
from .rules import evaluate, parse_doc_date
from .store import DocStore

HEARTBEAT = Path("/tmp/identity-documents.heartbeat")
READINESS = Path("/tmp/identity-documents.ready")
log = logging.getLogger("identity-documents")


async def check(store: DocStore, job: dict) -> tuple[str, list[str]]:
    sia = job.get("sia") or {}
    context = RuleInput(today=date.today(), profile_full_name=job.get("profile_full_name"),
                        profile_postcode=job.get("profile_postcode"),
                        profile_dob=parse_doc_date(job.get("profile_dob")),
                        sia_first_name=sia.get("first"), sia_surname=sia.get("last"))
    poa = await decode(await store.download(job, "proof"), "poa")
    licence = await decode(await store.download(job, "licence"), "dl")
    context.poa_flags, context.dl_flags = poa.flags, licence.flags
    proof = await extract(poa, "proof")
    driving = await extract(licence, "licence")
    if proof.reasons or driving.reasons:
        return "review", proof.reasons + driving.reasons
    context.poa, context.dl = proof.fields, driving.fields
    result = evaluate(context)
    # The models have not passed extraction acceptance.
    if result.decision == "approve":
        return "review", ["human_document_review_required"]
    return result.decision, result.reasons


async def run_cycle(store: DocStore) -> bool:
    READINESS.unlink(missing_ok=True)
    if not await store.ready() or not await vision.ready():
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
        READINESS.unlink(missing_ok=True)
    await store.finish(job, outcome, reasons)
    if outcome != "retry":
        READINESS.touch()
    return outcome != "retry"


async def heartbeat() -> None:
    while True:
        HEARTBEAT.touch()
        await asyncio.sleep(10)


async def run() -> None:
    READINESS.unlink(missing_ok=True)
    HEARTBEAT.unlink(missing_ok=True)
    inference_url()
    model_pin()
    if shutil.which("tesseract") is None:
        raise RuntimeError("OCR executable unavailable")
    async with inference_client():
        pass
    store = DocStore()
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
    for name in ("httpx", "httpcore"):
        logging.getLogger(name).disabled = True
    if sys.argv[1:] == ["--heartbeat"]:
        raise SystemExit(0 if healthy(HEARTBEAT, 35) else 1)
    if sys.argv[1:] == ["--readiness"]:
        raise SystemExit(0 if healthy(HEARTBEAT, 35) and healthy(READINESS, 480) else 1)
    try:
        asyncio.run(run())
    except Exception:
        log.error("Identity worker could not start or stopped unexpectedly")
        raise SystemExit(1) from None
