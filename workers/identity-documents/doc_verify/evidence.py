"""Independent OCR corroboration. Never use profile data to fill missing fields."""
from dataclasses import dataclass
from datetime import date
import re
import unicodedata

from .models import DlExtract, PoaExtract

LICENCE = {
    "surname": r"(?:1[.) ]+)?surname",
    "first_names": r"(?:2[.) ]+)?(?:first|given) names?",
    "date_of_birth": r"(?:3[.) ]+)?date of birth",
    "expiry_date": r"(?:4b[.) ]+|ab[.) ]+)?(?:licence )?expiry date",
    "address_first_line": r"(?:8[.) ]+)?address",
    "postcode": r"(?:8[.) ]+)?post\s*code",
}
PROOF = {
    "account_holder_name": r"(?:account holder|customer name|addressed to)",
    "address_first_line": r"(?:(?:service|billing) )?address",
    "postcode": r"(?:service |billing )?post\s*code",
    "document_date": r"(?:statement|bill|issue|document) date",
}
DATES = {"date_of_birth", "expiry_date", "document_date"}
POSTCODE = r"[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}"
INSTRUCTION = re.compile(
    r"\b(?:ignore|disregard|override|forget)\b.{0,70}\b(?:instructions?|prompt|previous|system)\b|"
    r"\b(?:system prompt|assistant role|developer message|return fake data|output json)\b", re.I
)


@dataclass(frozen=True)
class Line:
    page: int
    number: int
    text: str


def canonical(field: str, value: str | None) -> str | None:
    if not isinstance(value, str) or not 0 < len(value) <= 160 or any(ord(c) < 32 for c in value):
        return None
    value = " ".join(unicodedata.normalize("NFC", value).split())
    if field in DATES:
        try:
            if re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
                return date.fromisoformat(value).isoformat()
            match = re.fullmatch(r"([0-9]{1,2})([/.-])([0-9]{1,2})\2([0-9]{4})", value)
            if match:
                return date(int(match[4]), int(match[3]), int(match[1])).isoformat()
        except ValueError:
            pass
        return None
    if field == "postcode":
        return re.sub(r"\s", "", value).upper() if re.fullmatch(POSTCODE, value, re.I) else None
    return value.casefold() or None


def candidates(kind: str, lines: list[Line]) -> dict[str, list[tuple[str, Line]]]:
    patterns = LICENCE if kind == "licence" else PROOF
    found = {key: [] for key in patterns}
    for line in lines:
        for key, label in patterns.items():
            match = re.fullmatch(label + r"\s*[:–-]\s*(.+)", line.text.strip(), re.I)
            if match:
                found[key].append((match[1].strip(), line))
    return found


def classified(kind: str, lines: list[Line]) -> bool:
    headers = " ".join(line.text for line in lines if line.page == 1 and line.number <= 6)
    if kind == "licence":
        return bool(re.search(r"\b(?:UK )?DRIVING LICEN[CS]E\b", headers, re.I))
    return bool(re.search(r"\b(?:UTILITY BILL|ELECTRICITY BILL|GAS BILL|WATER BILL|BANK STATEMENT|"
                          r"COUNCIL TAX|BROADBAND BILL|MORTGAGE STATEMENT|HMRC LETTER)\b", headers, re.I))


def verify(kind, lines: list[Line], proposal) -> tuple[dict, dict, list[str]]:
    """Return supported values and their page/line positions, plus safe reason codes."""
    values, locations, reasons = {}, {}, []
    for key, found in candidates(kind, lines).items():
        values[key] = None
        normalized = {canonical(key, text) for text, _ in found}
        proposed = canonical(key, getattr(proposal, key, None))
        if len(normalized) > 1:
            reasons.append(f"{kind}_{key}_conflicting")
        elif proposed is not None and normalized == {proposed}:
            source, line = found[0]
            values[key] = source
            locations[key] = (line.page, line.number)
        else:
            reasons.append(f"{kind}_{key}_unconfirmed")
    return values, locations, reasons


def blank(kind):
    return (DlExtract(readable=False, is_uk_driving_licence=False) if kind == "licence" else
            PoaExtract(readable=False, is_proof_of_address_document=False))
