"""Bounded pixel OCR inside the isolated decoder. No PDF text is trusted."""
from collections import defaultdict
import io
import os
import subprocess

from PIL import Image

from .evidence import Line, candidates

MAX_WORDS = 600


def read(png: bytes, page: int) -> list[Line]:
    result = subprocess.run(
        ["tesseract", "stdin", "stdout", "-l", "eng", "--psm", "6", "tsv"],
        input=png, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=2.5,
        env={**os.environ, "OMP_THREAD_LIMIT": "1"}, check=True,
    )
    groups = defaultdict(list)
    for row in result.stdout.decode(errors="replace").splitlines()[1:MAX_WORDS + 1]:
        columns = row.split("\t", 11)
        if len(columns) == 12 and columns[0] == "5" and columns[11].strip():
            groups[tuple(columns[2:5])].append((float(columns[10]), columns[11].strip()))
    return [Line(page, index, " ".join(word for _, word in words)[:300])
            for index, words in enumerate(list(groups.values())[:80], 1)
            if min(conf for conf, _ in words) >= 62]


def align(png: bytes, kind: str) -> tuple[bytes, list[Line]]:
    first = read(png, 1)
    if any(candidates(kind, first).values()):
        return png, first
    # Only use orientation recovery, never speculative field-specific retries.
    with Image.open(io.BytesIO(png)) as original:
        for angle in (90, 270, 180):
            out = io.BytesIO()
            original.rotate(angle, expand=True).save(out, "PNG")
            rotated = out.getvalue()
            lines = read(rotated, 1)
            if sum(bool(v) for v in candidates(kind, lines).values()) >= 2:
                return rotated, lines
    return png, first
