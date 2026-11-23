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

MAX_SIDE = 1600

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
    text: str = ""                              # PDF text layer, if any
    flags: list[str] = field(default_factory=list)      # review reasons
    flag_detail: list[str] = field(default_factory=list)
    unreadable: bool = False


def pick_latest(names: list[str], prefix: str) -> Optional[str]:
    """Newest 'prefix-<millis>.<ext>' in a guard's folder."""
    best, best_ts = None, -1
    for n in names:
        m = re.match(rf"^{re.escape(prefix)}-(\d+)\.\w+$", n)
        if m and int(m.group(1)) > best_ts:
            best, best_ts = n, int(m.group(1))
    return best


def _png(img: Image.Image) -> bytes:
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
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
        if doc.kind == "pdf":
            _load_pdf(data, doc, role)
        else:
            _load_image(data, doc, role)
    except Exception as e:  # corrupt file, wrong format
        doc.unreadable = True
        doc.flag_detail.append(f"{role}: could not open file ({type(e).__name__})")
    return doc


def _load_pdf(data: bytes, doc: LoadedDoc, role: str) -> None:
    pdf = pymupdf.open(stream=data, filetype="pdf")
    if pdf.needs_pass:
        doc.unreadable = True
        doc.flag_detail.append(f"{role}: PDF is password protected")
        return

    meta = pdf.metadata or {}
    made_with = " / ".join(filter(None, [meta.get("producer"), meta.get("creator")]))
    if made_with and EDITORS.search(made_with):
        doc.flags.append(f"{role}_edited")
        doc.flag_detail.append(f"{role}: PDF made or saved with {made_with}")

    created, modified = _pdf_date(meta.get("creationDate")), _pdf_date(meta.get("modDate"))
    if created and modified and modified - created > timedelta(days=1):
        doc.flags.append(f"{role}_pdf_modified_later")
        doc.flag_detail.append(f"{role}: PDF modified {modified:%d %b %Y}, created {created:%d %b %Y}")

    if data.count(b"%%EOF") > 1:
        doc.flags.append(f"{role}_pdf_incremental_edit")
        doc.flag_detail.append(f"{role}: PDF has been saved more than once")

    doc.text = "\n".join(pdf[i].get_text() for i in range(min(2, pdf.page_count)))[:4000]
    page = pdf[0]
    zoom = min(2.0, MAX_SIDE / max(page.rect.width, page.rect.height))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
    doc.images.append(pix.tobytes("png"))


def _load_image(data: bytes, doc: LoadedDoc, role: str) -> None:
    img = Image.open(io.BytesIO(data))
    software = ""
    try:
        software = str(img.getexif().get(305, "") or "")   # 305 = Software
    except Exception:
        pass
    if software and EDITORS.search(software):
        doc.flags.append(f"{role}_edited")
        doc.flag_detail.append(f"{role}: photo saved with {software}")
    img = ImageOps.exif_transpose(img)
    doc.images.append(_png(img))
