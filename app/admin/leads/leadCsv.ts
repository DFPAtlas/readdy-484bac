export const leadCsvFields = [
  'id', 'company_name', 'website_url', 'email', 'phone', 'sector',
  'location', 'postcode', 'decision_maker_name', 'contact_page_url',
] as const;

const maxRows = 500;
export const maxLeadCsvBytes = 1024 * 1024;

export interface CsvLead {
  row: number;
  fields: Partial<Record<(typeof leadCsvFields)[number], string>>;
}

export function parseLeadCsv(source: string): CsvLead[] {
  const csv = source.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let offset = 0;
  // Consume one field and its delimiter together, including RFC 4180 escaped quotes.
  const field = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\r|\n|$)/y;

  while (offset < csv.length) {
    field.lastIndex = offset;
    const match = field.exec(csv);
    if (!match || field.lastIndex === offset) {
      throw new Error(`CSV row ${records.length + 1} has malformed quotes.`);
    }

    record.push((match[1]?.replace(/""/g, '"') ?? match[2]).trim());
    offset = field.lastIndex;
    if (match[3] === ',') {
      if (offset < csv.length) continue;
      record.push('');
    }

    records.push(record);
    record = [];
  }

  const [rawHeaders = [], ...rows] = records;
  const headers = rawHeaders.map(header => header.toLowerCase().replace(/[ -]+/g, '_'));
  if (!headers.some(header => leadCsvFields.some(field => field === header))) {
    throw new Error('Use the template headers or include a recognised lead column.');
  }
  if (new Set(headers).size !== headers.length || headers.some(header => header === '')) {
    throw new Error('Column names must be unique and filled in.');
  }

  const leads: CsvLead[] = [];
  for (const [index, cells] of rows.entries()) {
    if (cells.every(cell => !cell)) continue;
    if (cells.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} needs ${headers.length} columns.`);
    }

    const fields: CsvLead['fields'] = {};
    for (const name of leadCsvFields) {
      const value = cells[headers.indexOf(name)];
      if (value) fields[name] = value;
    }

    leads.push({ row: index + 2, fields });
  }
  if (leads.length === 0) throw new Error('The file has no lead rows.');
  if (leads.length > maxRows) throw new Error(`Upload up to ${maxRows} leads at a time.`);
  return leads;
}
