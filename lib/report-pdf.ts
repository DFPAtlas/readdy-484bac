import type { jsPDF } from 'jspdf';
export type PdfCell = string | number | boolean | null | undefined;
export interface PdfReport { title: string; columns: string[]; rows: PdfCell[][]; summary?: string[]; }
const plain = (value: PdfCell) => String(value ?? '—').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
export function renderReportPdf(doc: jsPDF, report: PdfReport): jsPDF {
  if (!report.columns.length || report.rows.some(row => row.length !== report.columns.length)) throw new Error('Invalid report columns.');
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 12, lineHeight = 4;
  const columnWidth = (width - 2 * margin) / report.columns.length;
  let y = 0;
  const header = () => {
    doc.setFont('helvetica', 'bold');doc.setFontSize(13);doc.text(plain(report.title), margin, 14);
    doc.setFont('helvetica', 'normal');doc.setFontSize(8);doc.text(`QuickGuard | ${report.rows.length} records | Generated ${new Date().toISOString()}`, margin, 20);
    y = 26;
    for (const summary of report.summary || []) { for (const line of doc.splitTextToSize(plain(summary), width - 2 * margin)) { doc.text(String(line), margin, y);y += lineHeight; } }
    doc.setFont('helvetica', 'bold');doc.setFontSize(7);
    const headings: string[][] = report.columns.map(column => doc.splitTextToSize(plain(column), columnWidth - 2));
    headings.forEach((lines, index) => doc.text(lines, margin + index * columnWidth, y));
    y += Math.max(...headings.map(lines => lines.length)) * lineHeight + 3;
    doc.line(margin, y - 2, width - margin, y - 2);doc.setFont('helvetica', 'normal');
  };
  header();
  for (const row of report.rows) {
    const cells: string[][] = row.map(value => doc.splitTextToSize(plain(value), columnWidth - 2));
    const count = Math.max(1, ...cells.map(cell => cell.length));
    for (let offset = 0; offset < count;) {
      if (y + lineHeight > height - 15) { doc.addPage();header(); }
      const available = Math.max(1, Math.floor((height - 15 - y) / lineHeight));const length = Math.min(available, count - offset);
      cells.forEach((lines, index) => { const part = lines.slice(offset, offset + length);if (part.length) doc.text(part, margin + index * columnWidth, y); });
      offset += length;y += length * lineHeight;
    }
    y += 3;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { doc.setPage(page);doc.setFontSize(8);doc.text(`Page ${page} of ${pages}`, margin, height - 7); }
  return doc;
}
export async function createReportPdf(report: PdfReport): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  return renderReportPdf(new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }), report).output('blob');
}
