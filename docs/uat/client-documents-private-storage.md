# Private company Documents recovery — C12

Company Documents targeted a nonexistent client-files bucket, exposed public file URLs, stored zero bytes without MIME type and silently treated errors/unconfirmed writes as success. All production document records and new-bucket files were zero before and after deployment.

The new private 10MB bucket accepts the advertised PDF/Word/PNG/JPEG formats. A restrictive browser policy denies direct bucket access even if another permissive policy is added. Owned metadata SELECT/closed-account RLS remain; anonymous metadata access and direct authenticated metadata mutation are revoked. New content_sha256 is nullable and omitted from normal list/export responses.

manage-client-documents authenticates through auth.getUser, checks active owned client and closure, compares expected_client_id only as a context guard and derives every path from verified user/client/document UUID. It bounds request bytes, validates extension/MIME/basic signature/type/name/date/description, records real size/hash and never overwrites files. A lost upload or metadata reply can confirm the same hash/owned payload. Different bytes/details never overwrite. Downloads verify owner/path/size/hash and return no-store attachment bytes, never public/signed URLs.

Delete confirms a bounded owned inventory, removes files through Storage API, confirms absence, deletes matching owned metadata and confirms absence. An absent replay is explicitly verified. Storage/database are separate systems; uncertain failures can retain private pending objects for same-draft Retry, explicit Discard upload or scheduled retention. Leaving the page loses the local selection; keep the source file and retry/discard before navigating. No atomic/orphan-free guarantee or malware/full Word-container validation is claimed.

Selection is local until Save; untouched Cancel makes no request. Failed saves preserve/freeze the same draft/file/details for Retry; Discard explicitly authorizes deleting any copy saved by the prior attempt. Ordered 200-row metadata paging, failure/Retry, locks, auth/client/unmount retirement, same-user draft preservation and revoked Blob URLs replace the earlier false empty/unconfirmed flows. Account Health uses a confirmed ready list and shows unknown/error. Admin metadata uses actual mime_type instead of nonexistent file_type.

## Deployed backend

- Installed migration: 20261120095240_client_documents_private_storage.sql. The CLI-generated filename was aligned with hosted history.
- manage-client-documents ACTIVE v1; process-account-retention ACTIVE v17; admin-delete-user ACTIVE v34.
- Gateway verify_jwt=false is paired with explicit in-handler user/worker/admin authorization, supporting current signing keys. Anonymous production document request returned 401. No authenticated positive file probe was submitted.
- Retention v16 source/helper matched repository base. Only client document-stage bucket inclusion changed.
- Admin v33 differs from current repository hardening. The exact three-anchor scripts/patches/admin-client-files-compat.cjs patch added recursive inventory only for client-files, preserving existing auth/MFA/account/financial behavior. Deployed v34 source readback matches that patch. Main's hardened source also includes the bucket for future alignment; broader runtime hardening and metadata-retention review remain separate.
- Captured admin source SHA-256: 92bcfd778429104786cffd73041f88043b65518f2b6e63d965bd5bc1486722cd. Compatibility source: 4596808a8519dc4d1afa2d17e175ec23991b1560aab652c3fa428b2700e6c872.
- Production readback confirms private bucket/limits/restrictive policy, enabled metadata RLS, owned SELECT allowed, anonymous SELECT and direct authenticated INSERT/UPDATE/DELETE denied including column grants. Document and object counts remain 0. Security advisories retain four service-table RLS INFO findings and pg_net-in-public warning.
- First migration confirmation expired without applying; after checking no change, the renewed request succeeded. No admin deletion/retention-worker request, production business write or email was submitted.

## Validation and recovery

Before the coding workspace disconnected, all 738 repository unit tests passed, final 34 focused checks passed after the blank-File.type MIME compatibility fix, TypeScript/admin/lint passed with eight existing image warnings, and the final production build passed. Backend source bytes were retained and deployed readback matches them.

The workspace became unavailable before the Git tree was captured. Frontend/helper/test files were recovered from the retained source and deterministic changes to the verified base. No exact local-tree match is claimed for that reconstruction; current-head GitHub validation is required before merge. The PR records its current CI evidence. The original consolidated acceptance report could not yet be updated in the unavailable workspace.

## Controlled acceptance

After green current-head checks/review, merge/import latest main into Readdy and publish. No further backend/secret/dependency setup is required. Test all supported types, save/reopen/download byte parity, errors/lost replies/Retry, untouched Cancel, explicit uncertain Discard, delete/replay, foreign/closed/direct-Storage denial, account switching, Health/export/admin metadata and retention/admin cleanup with labelled synthetic fixtures. Replace a file by uploading a new copy then removing the old one. Published positive lifecycle, malware scanning, broader account-deletion hardening/metadata retention and full booking/guard/payment/communication acceptance remain open. Public launch remains on hold.
