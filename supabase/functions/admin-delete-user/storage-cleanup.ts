// Storage metadata must never be deleted with SQL: use the Storage API.
// Enumerate only the verified account's folders, including nested admin uploads.
export async function listAccountStorageFiles(client: any, buckets: string[], roots: string[]): Promise<string[]> {
  const uniqueRoots = [...new Set(roots)];
  if (!uniqueRoots.length || uniqueRoots.some(root => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(root))) {
    throw new Error('Cannot enumerate storage without a verified account folder');
  }
  const files = new Set<string>();
  let visited = 0;
  for (const bucket of buckets) {
    const folders = uniqueRoots.map(path => ({ path, depth: 0 }));
    const seen = new Set<string>();
    while (folders.length) {
      const folder = folders.pop()!;
      if (seen.has(folder.path)) continue;
      seen.add(folder.path);
      if (folder.depth > 20) throw new Error('Storage folder depth exceeds safe limit');
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.storage.from(bucket).list(folder.path, {
          limit: 1000, offset, sortBy: { column: 'name', order: 'asc' },
        });
        if (error || !Array.isArray(data)) throw new Error(`Cannot list ${bucket}/${folder.path}: ${error?.message || 'invalid response'}`);
        visited += data.length;
        if (visited > 20000) throw new Error('Storage inventory exceeds safe limit; manual review required');
        for (const item of data) {
          if (typeof item.name !== 'string' || !item.name || item.name.includes('/') || item.name === '.' || item.name === '..') {
            throw new Error('Invalid storage object name');
          }
          const path = `${folder.path}/${item.name}`;
          if (item.id == null) folders.push({ path, depth: folder.depth + 1 });
          else files.add(`${bucket}/${path}`);
        }
        if (data.length < 1000) break;
      }
    }
  }
  return [...files].sort();
}

export async function removeAccountStorageFiles(client: any, files: string[], onBatch?: (deleted: string[]) => Promise<void>): Promise<string[]> {
  const grouped = new Map<string, string[]>();
  for (const file of new Set(files)) {
    const slash = file.indexOf('/');
    if (slash < 1) throw new Error('Invalid storage object path');
    const bucket = file.slice(0, slash);
    const paths = grouped.get(bucket) || [];
    paths.push(file.slice(slash + 1));
    grouped.set(bucket, paths);
  }
  const deleted: string[] = [];
  for (const [bucket, paths] of grouped) {
    for (let offset = 0; offset < paths.length; offset += 1000) {
      const batch = paths.slice(offset, offset + 1000);
      const { error } = await client.storage.from(bucket).remove(batch);
      if (error) throw new Error(`Cannot remove ${bucket} documents: ${error.message}`);
      deleted.push(...batch.map(path => `${bucket}/${path}`));
      await onBatch?.([...deleted]);
    }
  }
  return deleted;
}
