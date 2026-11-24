# Identity document extraction · Phase 3C

This change is for review and synthetic qualification. Keep the identity queue consumer stopped.

## Why the earlier test failed

The Phase 3 logs distinguished transport success from extraction accuracy. Qwen3-VL accepted the specimen layout more often under a test-only preamble but still marked the readable licence as unreadable and omitted its visible surname and expiry. Qwen2.5-VL classified a readable fictional licence as an unsupported type and swapped name fields. The specimen was intentionally sparse and visibly fictional. The original prompt coupled type, readability and transcription in a single response. The PDF adapter also supplied a text layer that could disagree with the rendered page. Those tests did not establish that the watermark or resolution alone caused the errors.

## Evidence boundary

1. The non-root, resource-limited decoder renders bounded images and runs local Tesseract on pixels. It can correct orientation using labelled evidence. It scans rendered PDF pages for conflicting evidence, within the existing four-page bound, and sends only the first aligned page to the model. PDF text layers and OCR transcripts are excluded from prompts.
2. An independent header check and a structured model classification must agree before field extraction. The gateway uses fixed system instructions and operation-specific prompts. Documents cannot supply a custom prompt, URL, model or tool.
3. The model proposes fields. The worker outputs a value only when the independent OCR found a unique matching value under its visible label. Accepted fields carry an in-memory page and line reference. Absent, ambiguous, conflicting or unsupported values stay null. Dates must be valid calendar dates and postcodes must match the expected shape. A visible issuance date never substitutes for expiry. There is no expiry-specific retry.
4. Recognised instruction-like content is routed directly to review before any model call for that document. Unrecognised visual injection may still influence the model proposal, which remains untrusted. A proposal cannot write the queue result directly or bypass corroboration; all clean outputs still require human review. Neither OCR agreement nor field extraction proves authenticity. Unlabelled or unsupported layouts may require manual extraction.

Raw OCR, extracted names and addresses, and page evidence stay in memory. The queue still receives only advisory outcome and reason codes. Phase 3A queue, checksum and approval permissions and Phase 3B mTLS, model pins, response bounds and non-root execution remain enforced.

## Qualification

The frozen synthetic generator and acceptance criteria are in `tests/identity-qualification`. Development and holdout use different names, fonts and layouts. There are 14 cases per split. The fictional specimens use conspicuous watermarks, fictional UK-format data, and no templates from real IDs. Do not alter the holdout or thresholds after inspecting its output.

The fixed minimum per model is 90% exact extraction over expected fields, zero false rejects of the declared valid cases, zero unsupported non-null extractions, and review with a reason for every declared uncertain case. The ceiling is a 145 s p95 per document and 11,000 MiB GPU memory on the specified RTX A2000. Every held-out case must run on the isolated mTLS path. Report classification failures, routing decisions and metrics separately for each model. The oracle mode supplies expected proposals to test only the OCR and policy boundary; it is never model qualification.

With an approved isolated TRON Ollama instance and Phase 3B certificates in staging, run `qualify.py --mode live --split holdout` independently for each pinned model. Mount only the synthetic fixture directory and staging certificates. Capture peak GPU memory externally throughout each run (for example, sample per-GPU used memory at one-second intervals on an otherwise idle staging GPU) and retain the evidence alongside the digest and JSONL output. The runner accepts the verified GPU name and peak as inputs; it cannot attest hardware telemetry itself. Repeat neither run for tuning and do not switch models automatically.

Rollback means stopping only the staged worker or gateway and restoring the previous pinned image for review. Keep the identity consumer stopped. Phase 3A schema and rollback remain unchanged.
