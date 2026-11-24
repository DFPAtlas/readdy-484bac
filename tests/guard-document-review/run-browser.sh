#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
repo="$PWD"
temp="$(mktemp -d)"
server=
cleanup() {
  if [[ -n "$server" ]]; then kill "$server" 2>/dev/null || true; fi
  rm -rf "$temp"
}
trap cleanup EXIT
mkdir -p "$temp/app" "$temp/lib"
ln -s "$repo/node_modules" "$temp/node_modules"
cp tsconfig.json postcss.config.mjs tailwind.config.js "$temp/"
cp app/admin/guard-verifications/DocumentsReviewPanel.tsx "$temp/app/"
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$temp/app/globals.css"
cat > "$temp/app/layout.tsx" <<'TSX'
import './globals.css';
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><body className="bg-slate-950 p-3 sm:p-8">{children}</body></html>;
}
TSX
cat > "$temp/app/page.tsx" <<'TSX'
'use client';
import Panel from './DocumentsReviewPanel';
export default function Page() {
  return <main className="mx-auto max-w-5xl"><Panel guardId="fixture-guard" onAttestation={() => {}} onRestored={() => {}} /></main>;
}
TSX
cat > "$temp/lib/supabase.ts" <<'TS'
let first = true;
let prepareFailed = false;
let review: {id: string; version: string; attested_at: string | null} | null = null;
const viewed: string[] = [];
export const supabase = {
  schema: (_schema: string) => ({ rpc: async (_name: string, _args: unknown) => {
    if (review) review.attested_at = '2026-11-24T00:00:00Z';
    return { error: null };
  } }),
  functions: { invoke: async (_name: string, {body}: {body: Record<string, unknown>}) => {
    if (first) { first = false; return {error: {context: null}, data: null}; }
    if (body.action === 'prepare') {
      if (!prepareFailed) {
        prepareFailed = true;
        return {error:{context:Response.json({error:'Synthetic queue unavailable'})},data:null};
      }
      review = {id:'fixture-review',version:'42',attested_at:null};
    }
    if (body.action === 'document') {
      const kind = String(body.kind);
      viewed.push(kind);
      const pdf = kind === 'proof';
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFZcAAAAASUVORK5CYII='), c => c.charCodeAt(0));
      return {error:null, data:new Blob([pdf ? '%PDF-1.4\n%%EOF' : png]), response:new Response(null,
        {headers:{'X-Document-Type':pdf ? 'application/pdf' : 'image/png'}})};
    }
    return {error: null, data:{version:review?.version ?? null,status:review ? 'pending' : null,
      advisory:null, reasons:review ? ['proof_date_unconfirmed'] : [], review, viewed, can_restore:false}};
  } }
};
TS
port="${PHASE3D_FIXTURE_PORT:-3146}"
(cd "$temp"; NEXT_TELEMETRY_DISABLED=1 node "$repo/node_modules/next/dist/bin/next" dev --hostname 127.0.0.1 --port "$port") > "$temp/server.log" 2>&1 &
server=$!
export PHASE3D_FIXTURE_URL="http://127.0.0.1:$port"
ready=false
for i in $(seq 1 30); do
  if curl -fsS "$PHASE3D_FIXTURE_URL" >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if ! "$ready"; then cat "$temp/server.log"; exit 1; fi
node tests/guard-document-review/browser.cjs || { cat "$temp/server.log"; exit 1; }
