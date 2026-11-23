"""Shapes for what the vision model reads off each document, and for the result."""
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

POA_TYPES = ["utility_bill", "council_tax", "bank_statement", "building_society_statement",
             "broadband_bill", "mortgage_statement", "hmrc_letter", "benefits_letter",
             "mobile_phone_bill", "tenancy_agreement", "other"]


class PoaExtract(BaseModel):
    """Read off a proof-of-address document."""
    readable: bool = Field(description="True if the document is clear enough to read the name and address")
    is_proof_of_address_document: bool = Field(
        description="True if this is a bill, statement or official letter addressed to a person at a home address")
    document_type: Optional[str] = Field(None, description="One of: " + ", ".join(POA_TYPES))
    issuer: Optional[str] = Field(None, description="Company or organisation that issued it, e.g. British Gas")
    account_holder_name: Optional[str] = Field(
        None, description="Name the document is addressed to, exactly as printed, including any title")
    address_first_line: Optional[str] = Field(None, description="First line of the address it is addressed to")
    postcode: Optional[str] = Field(None, description="Postcode of the address it is addressed to")
    document_date: Optional[str] = Field(
        None, description="Bill, statement or issue date exactly as printed. For a period, the end date")


class DlExtract(BaseModel):
    """Read off the front of a UK photocard driving licence."""
    readable: bool = Field(description="True if the licence is clear enough to read the name")
    is_uk_driving_licence: bool = Field(description="True if this is the front of a UK photocard driving licence")
    surname: Optional[str] = Field(None, description="Field 1, surname, exactly as printed")
    first_names: Optional[str] = Field(None, description="Field 2, first and middle names, exactly as printed")
    date_of_birth: Optional[str] = Field(None, description="Field 3, the date part only, exactly as printed")
    expiry_date: Optional[str] = Field(None, description="Field 4b, expiry date, exactly as printed")
    address_first_line: Optional[str] = Field(None, description="Field 8, first line of the address")
    postcode: Optional[str] = Field(None, description="Field 8, postcode")


@dataclass
class RuleInput:
    today: date
    profile_full_name: Optional[str] = None
    profile_postcode: Optional[str] = None
    profile_dob: Optional[date] = None          # compared in memory, never stored
    sia_first_name: Optional[str] = None        # from the latest SIA register check
    sia_surname: Optional[str] = None
    poa: Optional[PoaExtract] = None            # None = no file uploaded
    poa_flags: list[str] = field(default_factory=list)
    poa_flag_detail: list[str] = field(default_factory=list)
    poa_duplicate: bool = False
    dl: Optional[DlExtract] = None
    dl_flags: list[str] = field(default_factory=list)
    dl_flag_detail: list[str] = field(default_factory=list)
    dl_duplicate: bool = False


@dataclass
class Result:
    decision: str                       # approve | review | reject
    reasons: list[str]
    warnings: list[str]
    extracted: dict                     # minimal: no DOB, no licence number, no full address
