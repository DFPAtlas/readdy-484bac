'use client';

import { useRef, useState } from 'react';
import { paymentDocumentHTML, type ClientPaymentDocument } from '@/lib/payments/clientPaymentDocument';

export function PaymentDocument({ record }: { record: ClientPaymentDocument }) {
  return (
    <article className="qg-payment-document">
      <style>{`
        .qg-payment-document { box-sizing: border-box; max-width: 800px; margin: auto; padding: 32px; background: white; color: #172033; font: 15px/1.6 Arial, sans-serif; overflow-wrap: anywhere; }
        .qg-payment-document h1 { font-size: 26px; color: #1a237e; margin: 0 0 8px; }
        .qg-payment-document h2 { font-size: 18px; margin: 24px 0 8px; }
        .qg-payment-document p { margin: 4px 0; }
        .qg-payment-document dl { margin: 16px 0; }
        .qg-payment-document dl div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; border-bottom: 1px solid #ddd; padding: 10px 0; }
        .qg-payment-document dt { font-weight: bold; }
        .qg-payment-document dd { margin: 0; }
        .qg-payment-document footer { margin-top: 24px; border-top: 2px solid #1a237e; padding-top: 16px; font-size: 13px; }
        @media print { .qg-payment-document { padding: 0; } }
      `}</style>
      <h1>QuickGuard — {record.title}</h1>
      <p>Operated by Digital Footprint</p>
      <p><strong>Reference:</strong> {record.reference}</p>
      <h2>Client</h2>
      <p>{record.client.company_name || record.client.contact_name || 'Client'}</p>
      <p>{record.client.email}</p>
      <h2>Job</h2>
      <p>{record.job.job_title || 'Job'}</p>
      <p>{record.job.id}</p>
      <dl>{record.details.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      <dl aria-label="Amounts">{record.amounts.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      <footer><p>{record.note}</p><p>Questions? Contact billing@quickguard.uk</p></footer>
    </article>
  );
}

export default function PaymentRecordPreview({ record, onClose }: { record: ClientPaymentDocument; onClose: () => void }) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const download = () => {
    if (!documentRef.current) return;
    const blob = new Blob([paymentDocumentHTML(documentRef.current.innerHTML)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `QuickGuard-${record.title.replaceAll(' ', '-')}-${record.reference.replace(/[^a-zA-Z0-9_-]/g, '')}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const print = () => {
    if (!documentRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError('Allow pop-ups to print this payment document.'); return; }
    printWindow.opener = null;
    printWindow.document.write(paymentDocumentHTML(documentRef.current.innerHTML));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label={record.title}>
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col text-gray-900">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{record.title}</h2>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100" ref={documentRef}><PaymentDocument record={record} /></div>
        {error && <p role="alert" className="px-6 text-red-700">{error}</p>}
        <div className="border-t px-6 py-4 flex justify-between gap-4">
          <button onClick={print} className="px-4 py-2 rounded-lg border">Print</button>
          <button onClick={download} className="bg-[#1a237e] text-white px-4 py-2 rounded-lg">Download {record.title.toLowerCase()}</button>
        </div>
      </div>
    </div>
  );
}
