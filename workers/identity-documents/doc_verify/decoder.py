"""Single-document memory-only decoding in a time- and memory-bounded child."""
import asyncio
import base64
import json
import resource
import sys

from .transport import DOCUMENT_LIMIT, RENDER_LIMIT


async def decode(data: bytes, role: str):
    from .files import LoadedDoc

    if not 0 < len(data) <= DOCUMENT_LIMIT:
        return LoadedDoc("", "", unreadable=True)
    process = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "doc_verify.decoder", role,
        stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        raw, _ = await asyncio.wait_for(process.communicate(data), 12)
    except (TimeoutError, asyncio.CancelledError):
        if process.returncode is None:
            process.kill()
        await process.wait()
        if asyncio.current_task().cancelling():
            raise
        return LoadedDoc("", "", unreadable=True)
    if process.returncode or len(raw) > RENDER_LIMIT * 4 // 3 + 4096:
        return LoadedDoc("", "", unreadable=True)
    result = json.loads(raw)
    return LoadedDoc("", "", images=[base64.b64decode(i, validate=True) for i in result["images"]],
                     flags=result["flags"], unreadable=result["unreadable"])


def main() -> None:
    resource.setrlimit(resource.RLIMIT_CPU, (8, 9))
    resource.setrlimit(resource.RLIMIT_AS, (384 * 1024**2,) * 2)
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    from .files import load

    role = sys.argv[1]
    if role not in ("dl", "poa"):
        raise SystemExit(1)
    result = load(sys.stdin.buffer.read(DOCUMENT_LIMIT + 1), "", role)
    print(json.dumps({"images": [base64.b64encode(i).decode() for i in result.images],
                      "flags": result.flags, "unreadable": result.unreadable}))


if __name__ == "__main__":
    main()
