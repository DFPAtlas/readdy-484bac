export const BULK_JOB_CSV_COLUMNS = ['jobTitle', 'securityType', 'venue', 'addressLine1', 'addressLine2', 'city', 'postcode', 'startDate', 'startTime', 'endTime', 'numberOfDays', 'numberOfGuards', 'hourlyRate', 'jobDescription', 'urgency'] as const;
export type BulkCsvJob = Record<typeof BULK_JOB_CSV_COLUMNS[number], string>;
export const BULK_JOB_CSV_MAX_ROWS = 100;
export const BULK_JOB_CSV_MAX_BYTES = 1024 * 1024;
const required = ['jobTitle', 'securityType', 'venue', 'addressLine1', 'city', 'postcode', 'startDate', 'startTime', 'endTime', 'numberOfGuards', 'hourlyRate'];
const securityTypes = ['door-supervisor', 'event-security', 'retail-security', 'close-protection', 'cctv-operator', 'security-guard', 'mobile-patrol', 'key-holding', 'dog-handler'];

export function parseCsvRows(source: string): string[][] {
  if (source.includes('\0')) throw new Error('CSV contains an invalid character.');
  const rows: string[][] = [];let row: string[] = [], field = '', quoted = false, closed = false;
  const endField = () => { row.push(field);field = '';closed = false; };
  const endRow = () => { endField();if (row.some(value => value.trim())) rows.push(row);row = []; };
  source = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) { if (char === '"') { if (source[i + 1] === '"') { field += '"';i++; } else { quoted = false;closed = true; } } else field += char;continue; }
    if (char === ',') endField();
    else if (char === '\r' || char === '\n') { endRow();if (char === '\r' && source[i + 1] === '\n') i++; }
    else if (char === '"' && field === '' && !closed) quoted = true;
    else { if (closed || char === '"') throw new Error('CSV has malformed quotes.');field += char; }
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  if (field || row.length || closed) endRow();
  return rows;
}

export function importBulkJobCsv(source: string): BulkCsvJob[] {
  if (new TextEncoder().encode(source).length > BULK_JOB_CSV_MAX_BYTES) throw new Error('CSV must be at most 1MB.');
  const [headers, ...rows] = parseCsvRows(source);
  if (!headers || !rows.length) throw new Error('Add a header and at least one job row.');
  if (rows.length > BULK_JOB_CSV_MAX_ROWS) throw new Error('Import up to 100 jobs at a time.');
  const keys = headers.map(value => value.trim());
  if (new Set(keys).size !== keys.length || keys.some(key => !BULK_JOB_CSV_COLUMNS.some(column => column === key))) throw new Error('Use the template headers without duplicates or unknown columns.');
  if (required.some(key => !keys.includes(key))) throw new Error('The CSV is missing required template columns.');
  return rows.map((values, index) => {
    const fail = (message: string): never => { throw new Error(`Row ${index + 2}: ${message}`); };
    if (values.length !== keys.length) fail('column count does not match the header.');
    const job = Object.fromEntries(BULK_JOB_CSV_COLUMNS.map(key => [key, key === 'numberOfDays' ? '1' : key === 'urgency' ? 'standard' : ''])) as BulkCsvJob;
    keys.forEach((key, i) => { const column = BULK_JOB_CSV_COLUMNS.find(value => value === key);if (column) job[column] = values[i].trim(); });
    if (required.some(key => !job[BULK_JOB_CSV_COLUMNS.find(value => value === key)!])) fail('complete all required fields.');
    if (!securityTypes.includes(job.securityType)) fail('use a securityType from the template guidance.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(job.startDate) || !Number.isFinite(Date.parse(job.startDate)) || new Date(job.startDate).toISOString().slice(0, 10) !== job.startDate) fail('use a valid YYYY-MM-DD date.');
    for (const time of [job.startTime, job.endTime]) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail('use HH:MM times.');
    if (!/^\d+$/.test(job.numberOfGuards) || +job.numberOfGuards < 1 || +job.numberOfGuards > 100) fail('guards must be 1–100.');
    if (!/^\d+$/.test(job.numberOfDays) || +job.numberOfDays < 1 || +job.numberOfDays > 366) fail('days must be 1–366.');
    if (!/^\d+(\.\d{1,2})?$/.test(job.hourlyRate) || +job.hourlyRate < 10 || +job.hourlyRate > 10000) fail('hourly rate must be £10–£10,000 with up to two decimals.');
    if (!['standard', 'urgent', 'immediate'].includes(job.urgency)) fail('urgency must be standard, urgent or immediate.');
    if (values.some(value => value.length > 10000)) fail('a field exceeds 10,000 characters.');
    return job;
  });
}
export function bulkJobCsvTemplate(): string {
  return BULK_JOB_CSV_COLUMNS.join(',') + '\r\n' + ['Example shift', 'event-security', 'Example venue', '1 Example Road', '', 'London', 'SW1A 1AA', '2027-01-01', '18:00', '22:00', '1', '2', '20', 'Replace this example before posting', 'standard'].join(',') + '\r\n';
}
