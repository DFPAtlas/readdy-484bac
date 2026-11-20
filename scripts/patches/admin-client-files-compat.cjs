// Narrow compatibility patch for deployed legacy admin-delete-user v33.
// Keep its auth/account/financial behavior unchanged; repository hardening is
// separately tracked. Refuse unknown input rather than overwrite source drift.
function patchAdminClientFiles(source) {
  const edits = [
    ['import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";', 'import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";\nimport { listAccountStorageFiles } from "./storage-cleanup.ts";'],
    ['    async function listStorageFiles(bucket: string, searchPaths: string[]): Promise<string[]> {', '    async function listStorageFiles(bucket: string, searchPaths: string[]): Promise<string[]> {\n      if (bucket === "client-files") return listAccountStorageFiles(adminClient, [bucket], searchPaths);'],
    ['? ["avatars", "guard-documents", "guard-profiles", "ID-images", "sia-licences", "quickguard-email-assets"]', '? ["avatars", "guard-documents", "guard-profiles", "ID-images", "sia-licences", "quickguard-email-assets", "client-files"]'],
  ];
  let result = source;
  for (const [before,after] of edits) {
    if (result.split(before).length !== 2) throw new Error('Deployed admin deletion source requires review');
    result = result.replace(before,after);
  }
  return result;
}
module.exports = { patchAdminClientFiles };
