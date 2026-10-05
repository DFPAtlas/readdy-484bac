/** Upgrade stored job links to routes available even for jobs posted after publication. */
export function normalizeJobLink(link: string): string {
  const match = link.match(/^\/(client\/|guard\/)?jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(select-guards|payment|confirmation|apply))?(\?[^#]*)?(#.*)?$/i);
  if (!match) return link;
  const [, role = '', id, action = 'detail', query = '', hash = ''] = match;
  const route = action === 'select-guards' ? 'applicants' : action;
  const params = new URLSearchParams(query);
  params.set('id', id);
  return `/${role}jobs/${route}?${params.toString()}${hash}`;
}
