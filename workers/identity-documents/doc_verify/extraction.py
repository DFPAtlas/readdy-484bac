"""Classification, proposal and verification are separate trust stages."""
from dataclasses import dataclass

from . import vision
from .evidence import INSTRUCTION, blank, classified, verify
from .models import DlExtract, PoaExtract


@dataclass
class Extraction:
    fields: PoaExtract | DlExtract
    locations: dict[str, tuple[int, int]]
    reasons: list[str]


async def extract(doc, kind: str) -> Extraction:
    if doc.unreadable or not doc.images:
        return Extraction(blank(kind), {}, [f"{kind}_unreadable"])
    if any(INSTRUCTION.search(line.text) for line in doc.lines):
        return Extraction(blank(kind), {}, [f"{kind}_untrusted_instructions"])
    if not classified(kind, doc.lines):
        return Extraction(blank(kind), {}, [f"{kind}_layout_unconfirmed"])
    classification = await vision.classify(doc.images, kind)
    if classification.kind != kind:
        return Extraction(blank(kind), {}, [f"{kind}_classification_unconfirmed"])
    proposal = await (vision.read_dl(doc.images) if kind == "licence" else vision.read_poa(doc.images))
    fields, locations, reasons = verify(kind, doc.lines, proposal)
    if kind == "licence":
        result = DlExtract(readable=bool(locations), is_uk_driving_licence=True, **fields)
    else:
        result = PoaExtract(readable=bool(locations), is_proof_of_address_document=True, **fields)
    return Extraction(result, locations, reasons)
