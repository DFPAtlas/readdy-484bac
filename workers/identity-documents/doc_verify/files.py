"""
Turns an uploaded file into images the vision model can read, and checks
the file itself for signs of editing.

Everything happens in memory. Documents are never written to disk on HAL.
"""
import hashlib
import io
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import pymupdf
from PIL import Image, ImageOps

from .transport import DOCUMENT_LIMIT, RENDER_LIMIT

MAX_SIDE = 1200
MAX_IMAGE_PIXELS = 12_000_000
MAX_PDF_PAGES = 4
MAX_PDF_OBJECTS = 1000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

# Tools that create or edit documents. A genuine bill downloaded from a
# supplier is made by their billing system, not one of these.
EDITORS = re.compile(
    r"photoshop|gimp|canva|ilovepdf|smallpdf|sejda|pdfescape|pdf-xchange|phantompdf|"
    r"foxit pdf editor|nitro pro|pdffiller|dochub|pdfelement|wondershare|microsoft.{0,4}word|"
    r"libreoffice|openoffice|pixelmator|affinity|paint\.net|picsart|inkscape|\bpages\b",
    re.I)


@dataclass
class LoadedDoc:
    sha256: str
    kind: str                                   # pdf | image
    images: list[bytes] = field(default_factory=list)   # PNG bytes, first page / photo
    flags: list[str] = field(default_factory=list)      # review reasons
    unreadable: bool = False


def _png(img: Image.Image) -> bytes:
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    if buf.tell() > RENDER_LIMIT:
        raise ValueError("Render too large")
    return buf.getvalue()


def _pdf_date(s: Optional[str]) -> Optional[datetime]:
    # 'D:20260312101500Z' / 'D:20260312101500+01'00''
    m = re.match(r"D:(\d{14})", s or "")
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y%m%d%H%M%S")
    except ValueError:
        return None


def load(data: bytes, filename: str, role: str) -> LoadedDoc:
    """role is 'poa' or 'dl' - used as the prefix on flag names."""
    doc = LoadedDoc(sha256=hashlib.sha256(data).hexdigest(),
                    kind="pdf" if filename.lower().endswith(".pdf") or data[:5] == b"%PDF-" else "image")
    try:
        if not 0 < len(data) <= DOCUMENT_LIMIT:
            raise ValueError("File too large")
        if doc.kind == "pdf":
            _load_pdf(data, doc, role)
        else:
            _load_image(data, doc, role)
    except Exception:  # corrupt file, wrong format
        doc.unreadable = True
    return doc


def _load_pdf(data: bytes, doc: LoadedDoc, role: str) -> None:
    with pymupdf.open(stream=data, filetype="pdf") as pdf:
        if pdf.needs_pass or not 0 < pdf.page_count <= MAX_PDF_PAGES or pdf.xref_length() > MAX_PDF_OBJECTS:
            raise ValueError("Unsupported PDF complexity")
        meta = pdf.metadata or {}
        if any(EDITORS.search(meta.get(k) or "") for k in ("producer", "creator")):
            doc.flags.append(f"{role}_edited")
        created, modified = _pdf_date(meta.get("creationDate")), _pdf_date(meta.get("modDate"))
        if created and modified and modified - created > timedelta(days=1):
            doc.flags.append(f"{role}_pdf_modified_later")
        if data.count(b"%%EOF") > 1:
            doc.flags.append(f"{role}_pdf_incremental_edit")
        page = pdf[0]
        if not 0 < page.rect.width <= 4000 or not 0 < page.rect.height <= 4000:
            raise ValueError("Unsupported PDF page size")
        zoom = min(2.0, MAX_SIDE / max(page.rect.width, page.rect.height))
        rendered = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).tobytes("png")
        if len(rendered) > RENDER_LIMIT:
            raise ValueError("Render too large")
        doc.images.append(rendered)


def _load_image(data: bytes, doc: LoadedDoc, role: str) -> None:
    with Image.open(io.BytesIO(data), formats=("JPEG", "PNG", "WEBP")) as img:
        if img.width * img.height > MAX_IMAGE_PIXELS or getattr(img, "n_frames", 1) != 1:
            raise ValueError("Unsupported image complexity")
        software = str(img.getexif().get(305, "") or "")
        if EDITORS.search(software):
            doc.flags.append(f"{role}_edited")
        doc.images.append(_png(ImageOps.exif_transpose(img)))
