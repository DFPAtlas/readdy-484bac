"""
Decision rules for the ID document check. Pure functions - no network, no AI.

The name every document is compared against (the "anchor") is the SIA
register name when we have one, otherwise the guard's profile name.

  reject  - something the guard can fix: a missing, unreadable, expired or
            out-of-date document, the wrong kind of document, or a document
            clearly in someone else's name
  review  - anything a human should look at: small name differences,
            postcode or date-of-birth differences, signs the file was edited,
            the same document used on another account
  approve - everything lines up

We never auto-reject because a document *looks* fake. Those signals only
ever send the check to an admin.
"""
import os
import re
import unicodedata
from datetime import date, datetime, timedelta
from difflib import SequenceMatcher
from typing import Optional

from .models import DlExtract, PoaExtract, Result, RuleInput

POA_MAX_AGE_DAYS = int(os.getenv("POA_MAX_AGE_DAYS", "90"))
DL_EXPIRY_WARN_DAYS = int(os.getenv("DL_EXPIRY_WARN_DAYS", "60"))
ACCEPTED_POA_TYPES = set(os.getenv(
    "ACCEPTED_POA_TYPES",
    "utility_bill,council_tax,bank_statement,building_society_statement,broadband_bill,"
    "mortgage_statement,hmrc_letter,benefits_letter").split(","))

TITLES = {"mr", "mrs", "ms", "miss", "mx", "dr", "sir", "rev", "prof", "master", "lady", "lord"}
UK_POSTCODE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$")
SUSPICIOUS = {"poa_used_on_another_account", "dl_used_on_another_account", "dob_mismatch_dl"}

DATE_FORMATS = ("%d/%m/%Y", "%d/%m/%y", "%d.%m.%Y", "%d.%m.%y", "%d-%m-%Y", "%d-%m-%y",
                "%d %B %Y", "%d %b %Y", "%d %B %y", "%d %b %y", "%Y-%m-%d",
                "%B %d %Y", "%b %d %Y")


# --------------------------------------------------------------------- helpers


def normalise(text: Optional[str]) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z ]+", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()



def parse_doc_date(text: Optional[str]) -> Optional[date]:
    """Dates as printed on UK bills and licences: '12 March 2026', '12/03/2026',
    '12.03.2030', '12th Mar 2026', 'March 2026' (taken as the last day)."""
    if not text:
        return None
    t = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", text.strip(), flags=re.I)
    t = re.sub(r"[,]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(t, fmt).date()
        except ValueError:
            pass
    for fmt in ("%B %Y", "%b %Y"):
        try:
            d = datetime.strptime(t, fmt).date()
            nxt = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
            return nxt - timedelta(days=1)
        except ValueError:
            pass
    return None


def norm_postcode(text: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", (text or "").upper())


def valid_postcode(text: Optional[str]) -> bool:
    return bool(UK_POSTCODE.match(norm_postcode(text)))


def split_full_name(full: Optional[str]) -> tuple[str, str]:
    """'Mr John P Smith' -> ('john p', 'smith')."""
    tokens = [t for t in normalise(full).split() if t not in TITLES]
    if not tokens:
        return "", ""
    if len(tokens) == 1:
        return "", tokens[0]
    return " ".join(tokens[:-1]), tokens[-1]


def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio() if a and b else 0.0


def compare_names(anchor_first: str, anchor_surname: str,
                  got_first: Optional[str], got_surname: Optional[str],
                  allow_initial: bool = False) -> tuple[str, list[str]]:
    """Returns ('match' | 'close' | 'mismatch' | 'missing', warnings).
    Middle names on a document are fine. A first initial is fine on bills."""
    a_first = normalise(anchor_first).split()
    a_sur = normalise(anchor_surname)
    g_first = [t for t in normalise(got_first).split() if t not in TITLES]
    g_sur = normalise(got_surname)
    if not g_sur or not a_sur:
        return "missing", []

    # Double-barrelled surnames: 'smith jones' vs 'smithjones'
    sur = max(_sim(a_sur, g_sur), _sim(a_sur.replace(" ", ""), g_sur.replace(" ", "")))

    warnings: list[str] = []
    if not a_first:
        first = 1.0
    elif not g_first:
        first = 0.0 if not allow_initial else 0.5
    elif a_first[0] in g_first:
        first = 1.0
    elif allow_initial and len(g_first[0]) == 1 and g_first[0] == a_first[0][0]:
        first = 1.0
        warnings.append("poa_name_initial_only")
    else:
        first = max(_sim(a_first[0], t) for t in g_first)

    if sur >= 1.0 and first >= 1.0:
        return "match", warnings
    if sur < 0.75 or first < 0.6:
        return "mismatch", warnings
    return "close", warnings


# ----------------------------------------------------------------------- rules

def evaluate(inp: RuleInput) -> Result:
    reject: list[str] = []
    review: list[str] = []
    warnings: list[str] = []
    extracted: dict = {}

    # Who should these documents belong to?
    if inp.sia_surname:
        anchor_first, anchor_sur = normalise(inp.sia_first_name), normalise(inp.sia_surname)
        extracted["anchor"] = "sia_register"
    else:
        anchor_first, anchor_sur = split_full_name(inp.profile_full_name)
        extracted["anchor"] = "profile"
        warnings.append("sia_name_not_available_yet")

    # ---------------------------------------------------------- driving licence
    dl = inp.dl
    if dl is None:
        reject.append("missing_driving_licence")
    elif not dl.readable or not (dl.surname or dl.first_names):
        reject.append("dl_unreadable")
    elif not dl.is_uk_driving_licence:
        reject.append("dl_not_uk_licence")
    else:
        outcome, w = compare_names(anchor_first, anchor_sur, dl.first_names, dl.surname)
        warnings += w
        if outcome == "mismatch":
            reject.append("name_mismatch_dl")
        elif outcome in ("close", "missing"):
            review.append("name_variation_dl")

        expiry = parse_doc_date(dl.expiry_date)
        if expiry is None:
            review.append("dl_expiry_unreadable")
        elif expiry < inp.today:
            reject.append("dl_expired")
        elif expiry <= inp.today + timedelta(days=DL_EXPIRY_WARN_DAYS):
            warnings.append(f"dl_expires_in_{(expiry - inp.today).days}_days")

        # Date of birth: compared here, never stored
        dob = parse_doc_date(dl.date_of_birth)
        if inp.profile_dob and dob:
            extracted["dob_match"] = dob == inp.profile_dob
            if dob != inp.profile_dob:
                review.append("dob_mismatch_dl")
        else:
            extracted["dob_match"] = None

        extracted["dl"] = {"name": " ".join(filter(None, [dl.first_names, dl.surname])),
                           "postcode": norm_postcode(dl.postcode) or None,
                           "expiry_date": expiry.isoformat() if expiry else None}

    if inp.dl_flags:
        review += inp.dl_flags
    if inp.dl_duplicate:
        review.append("dl_used_on_another_account")

    # --------------------------------------------------------- proof of address
    poa = inp.poa
    if poa is None:
        reject.append("missing_proof_of_address")
    elif not poa.readable or not (poa.account_holder_name or poa.postcode):
        reject.append("poa_unreadable")
    elif not poa.is_proof_of_address_document or (
            poa.document_type and poa.document_type not in ACCEPTED_POA_TYPES):
        reject.append("poa_not_accepted_type")
    else:
        outcome, w = compare_names(anchor_first, anchor_sur, *split_full_name(poa.account_holder_name),
                                   allow_initial=True)
        warnings += w
        if outcome == "mismatch":
            reject.append("name_mismatch_poa")
        elif outcome in ("close", "missing"):
            review.append("name_variation_poa")

        doc_date = parse_doc_date(poa.document_date)
        if doc_date is None:
            review.append("poa_date_unreadable")
        elif doc_date > inp.today + timedelta(days=7):
            review.append("poa_date_in_future")
        elif doc_date < inp.today - timedelta(days=POA_MAX_AGE_DAYS):
            reject.append("poa_too_old")

        poa_pc = norm_postcode(poa.postcode)
        if not poa_pc or not valid_postcode(poa_pc):
            review.append("poa_postcode_unreadable")
        else:
            dl_pc = norm_postcode(dl.postcode) if dl else ""
            if dl_pc and dl_pc != poa_pc:
                review.append("postcode_mismatch_dl_poa")
            prof_pc = norm_postcode(inp.profile_postcode)
            if prof_pc and prof_pc != poa_pc:
                review.append("postcode_mismatch_profile")

        extracted["poa"] = {"document_type": poa.document_type, "issuer": poa.issuer,
                            "name": poa.account_holder_name, "postcode": poa_pc or None,
                            "document_date": doc_date.isoformat() if doc_date else None}

    if inp.poa_flags:
        review += inp.poa_flags
    if inp.poa_duplicate:
        review.append("poa_used_on_another_account")

    if dl and poa and dl.address_first_line and poa.address_first_line:
        if normalise(dl.address_first_line) != normalise(poa.address_first_line):
            review.append("address_mismatch_dl_poa")

    detail = inp.poa_flag_detail + inp.dl_flag_detail
    if detail:
        extracted["flag_detail"] = detail

    reasons = list(dict.fromkeys(reject + review))   # keep order, drop repeats
    # Signs of tampering or reuse always go to a human, even when the guard
    # would otherwise just be asked to re-upload, so an admin sees them.
    suspicious = any(r in SUSPICIOUS or r.endswith("_edited") or r.endswith("_modified_later")
                     for r in review)
    if suspicious:
        decision = "review"
    else:
        decision = "reject" if reject else "review" if review else "approve"
    return Result(decision=decision, reasons=reasons,
                  warnings=list(dict.fromkeys(warnings)), extracted=extracted)
