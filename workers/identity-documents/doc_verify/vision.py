"""Only the mutually authenticated, digest-pinned local gateway handles inference."""
import base64

from .models import POA_TYPES, DlExtract, PoaExtract
from .transport import RENDER_LIMIT, RESPONSE_LIMIT, exchange, inference_client, inference_url, model_pin

RULES = """Copy every value exactly as it is printed on the document.
If a value is not clearly visible, use null. Never guess or fill in a value.
Answer only with JSON that matches the schema."""

POA_PROMPT = f"""This is a document a person in the UK uploaded as proof of their home address.
Read it and fill in the fields.
- document_type must be one of: {", ".join(POA_TYPES)}.
- account_holder_name is the person the document is addressed to.
- address_first_line and postcode are the address it is sent to, not the company's address.
- document_date is the bill, statement or issue date. For a billing period, use the end date.
- is_proof_of_address_document is false for anything that is not a bill, statement or
  official letter addressed to a person (for example a screenshot of an app, an envelope,
  a delivery note or a blank form).
{RULES}"""

DL_PROMPT = f"""This should be the front of a UK photocard driving licence.
The fields are numbered on the card:
1 = surname, 2 = first names, 3 = date of birth (then place of birth),
4a = issue date, 4b = expiry date, 8 = address.
- is_uk_driving_licence is false if this is anything else (passport, other country's licence,
  the back of the card, an ID card).
- date_of_birth: the date only, not the place of birth.
{RULES}"""


def payload() -> dict:
    model, digest = model_pin()
    return {"model": model, "digest": digest}


async def ready() -> bool:
    async with inference_client() as client:
        status, _ = await exchange(client, "POST", inference_url() + "/ready", json=payload(),
                                   limit=RESPONSE_LIMIT, deadline=10)
    return status == 204


async def _ask(images, kind, schema):
    if len(images) != 1 or len(images[0]) > RENDER_LIMIT:
        raise ValueError("Invalid rendered document")
    body = {**payload(), "kind": kind, "image": base64.b64encode(images[0]).decode()}
    async with inference_client() as client:
        _, data = await exchange(client, "POST", inference_url() + "/infer", json=body,
                                 limit=RESPONSE_LIMIT, deadline=70)
    return schema.model_validate_json(data)


async def read_poa(images):
    return await _ask(images, "proof", PoaExtract)


async def read_dl(images):
    return await _ask(images, "licence", DlExtract)
