'use client';

import PaymentRecordPreview from '@/app/client/components/PaymentRecordPreview';
import {
  buildClientPaymentEstimate, buildClientPaymentRecord,
  type PaymentDocumentClient, type PaymentDocumentJob, type RecordedClientPayment,
} from '@/lib/payments/clientPaymentDocument';

interface InvoicePreviewProps {
  job: PaymentDocumentJob;
  client: PaymentDocumentClient;
  guards: unknown[];
  costs: { guardFees: number; serviceFee: number; vat: number; processingFee?: number; total: number };
  invoiceNumber: string;
  onClose: () => void;
  paymentStatus?: string;
  transaction?: RecordedClientPayment | null;
}

export default function InvoicePreview({ job, client, costs, onClose, transaction, paymentStatus }: InvoicePreviewProps) {
  try {
    if (!transaction && paymentStatus && !['not_required', 'pending_payment'].includes(paymentStatus)) {
      throw new Error('The recorded payment could not be loaded. Reload the page and try again.');
    }
    const record = transaction
      ? buildClientPaymentRecord(transaction, client, job)
      : buildClientPaymentEstimate(client, job, costs);
    return <PaymentRecordPreview record={record} onClose={onClose} />;
  } catch (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Payment document unavailable">
        <div className="bg-white text-gray-900 rounded-xl p-6 max-w-lg">
          <p role="alert">{error instanceof Error ? error.message : 'The payment document could not be loaded.'}</p>
          <button onClick={onClose} className="border rounded-lg px-4 py-2 mt-4">Close</button>
        </div>
      </div>
    );
  }
}
