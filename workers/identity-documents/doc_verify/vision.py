"""
Reads documents with a vision model running in Ollama on HAL, so the
documents never leave your network.

Default model: qwen2.5vl:7b (fits HAL's 12GB GPU). Try qwen3-vl:8b too and
keep whichever reads your test documents best - set VISION_MODEL in .env.
"""
import base64
import json
import os

import httpx
from pydantic import BaseModel, ValidationError

from .models import POA_TYPES, DlExtract, PoaExtract

OLLAMA_URL = os.getenv("OLLAMA_URL", "").rstrip("/")
VISION_MODEL = os.getenv("VISION_MODEL", "qwen3-vl:8b")

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


class VisionError(Exception):
    """Ollama unreachable or the model gave unusable output. Retryable."""


async def _ask(images: list[bytes], prompt: str, schema: type[BaseModel]) -> BaseModel:
    body = {
        "model": VISION_MODEL,
        "stream": False,
        "keep_alive": "10m",
        "format": schema.model_json_schema(),
        "options": {"temperature": 0},
        "messages": [{"role": "user", "content": prompt,
                      "images": [base64.b64encode(i).decode() for i in images]}],
    }
    last = None
    async with httpx.AsyncClient(timeout=httpx.Timeout(80, connect=10), trust_env=False) as client:
        for _ in range(2):
            try:
                r = await client.post(f"{OLLAMA_URL}/api/chat", json=body)
                r.raise_for_status()
                content = r.json()["message"]["content"]
                return schema.model_validate(json.loads(content))
            except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValidationError) as e:
                last = e
    raise VisionError(f"{type(last).__name__}: local inference unavailable")


async def read_poa(images: list[bytes], text_layer: str = "") -> PoaExtract:
    prompt = POA_PROMPT
    if text_layer.strip():
        prompt += ("\n\nThe PDF also has this text layer. Use it to read values accurately, "
                   "but only for things you can see on the page:\n" + text_layer)
    return await _ask(images, prompt, PoaExtract)


async def read_dl(images: list[bytes]) -> DlExtract:
    return await _ask(images, DL_PROMPT, DlExtract)
