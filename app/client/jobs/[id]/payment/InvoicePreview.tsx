'use client';

import { useRef, useCallback } from 'react';

interface Job {
  id: string;
  job_title: string;
  security_type: string;
  venue_name: string;
  venue_address_line1: string;
  venue_city: string;
  venue_postcode: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  number_of_guards: number;
  hourly_rate: number;
}

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
}

interface Guard {
  id: string;
  full_name: string;
  hours_worked?: number;
}

interface Costs {
  hours?: number;
  guardFees: number;
  serviceFee: number;
  vat: number;
  total: number;
}

interface InvoicePreviewProps {
  job: Job;
  client: Client;
  guards: Guard[];
  costs: Costs;
  invoiceNumber: string;
  onClose: () => void;
  paymentStatus?: string;
  paymentDate?: string;
  paymentMethod?: string;
}

export default function InvoicePreview({ job, client, guards, costs, invoiceNumber, onClose, paymentStatus, paymentDate, paymentMethod }: InvoicePreviewProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }, []);

  const buildInvoiceHTML = useCallback(() => {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const dateRange = job.end_date && job.end_date !== job.start_date
      ? formatDate(job.start_date) + ' - ' + formatDate(job.end_date)
      : formatDate(job.start_date);

    const styles = [
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      'body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1a1a1a; }',
      '.invoice-container { max-width: 800px; margin: 0 auto; }',
      '.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #1a237e; }',
      '.logo { display: flex; align-items: center; gap: 10px; }',
      '.logo-icon { width: 40px; height: 40px; background: #1a237e; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: bold; }',
      '.logo-text { font-size: 24px; font-weight: bold; color: #1a237e; font-family: serif; }',
      '.invoice-title { text-align: right; }',
      '.invoice-title h1 { font-size: 32px; color: #1a237e; margin-bottom: 5px; }',
      '.invoice-number { color: #666; font-size: 14px; }',
      '.addresses { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }',
      '.address-block h3 { font-size: 12px; text-transform: uppercase; color: #666; margin-bottom: 10px; letter-spacing: 1px; }',
      '.address-block p { margin-bottom: 5px; font-size: 14px; }',
      '.address-block .company { font-weight: bold; font-size: 16px; color: #1a237e; }',
      '.invoice-details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }',
      '.detail-item label { display: block; font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 5px; }',
      '.detail-item span { font-weight: bold; font-size: 14px; }',
      '.items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }',
      '.items-table th { background: #1a237e; color: white; padding: 12px 15px; text-align: left; font-size: 12px; text-transform: uppercase; }',
      '.items-table td { padding: 15px; border-bottom: 1px solid #eee; font-size: 14px; }',
      '.items-table .amount { text-align: right; font-weight: bold; }',
      '.totals { margin-left: auto; width: 300px; }',
      '.totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }',
      '.totals-row.total { border-bottom: none; border-top: 2px solid #1a237e; padding-top: 15px; margin-top: 10px; }',
      '.totals-row.total span { font-size: 18px; font-weight: bold; color: #1a237e; }',
      '.footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }',
      '.payment-info { background: #f0f4ff; padding: 20px; border-radius: 8px; margin-top: 30px; }',
      '.payment-info h4 { color: #1a237e; margin-bottom: 10px; }',
      '.payment-info p { font-size: 13px; margin-bottom: 5px; }',
      '.paid-badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }',
      '.failed-badge { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }',
      '.pending-badge { display: inline-block; background: #f59e0b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }',
      '@media print { body { padding: 20px; } }',
    ].join('');

    const isPaidHtml = paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === 'succeeded';
    const isFailedHtml = paymentStatus === 'failed';
    const displayStatusHtml = isPaidHtml ? '<span class="paid-badge">Paid</span>' : isFailedHtml ? '<span class="failed-badge">Failed</span>' : '<span class="pending-badge">Awaiting Payment</span>';
    const paymentInfoHtml = isPaidHtml ? (
      '<div style="margin-top:10px"><p><strong>Payment Date:</strong> ' + (paymentDate || today) + '</p>' +
      '<p><strong>Payment Method:</strong> ' + (paymentMethod || 'Card') + '</p></div>'
    ) : '';

    const htmlParts = [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8"><title>Invoice ' + invoiceNumber + '</title><style>' + styles + '</style></head><body>',
      '<div class="invoice-container">',
      '<div class="header"><div class="logo"><div class="logo-icon">Q</div><span class="logo-text">QuickGuard</span></div>',
      '<div class="invoice-title"><h1>INVOICE</h1><p class="invoice-number">' + invoiceNumber + '</p></div></div>',
      '<div class="addresses">',
      '<div class="address-block"><h3>From</h3><p class="company">QuickGuard Ltd</p><p>123 Security House</p><p>London, EC1A 1BB</p><p>United Kingdom</p><p style="margin-top:10px">VAT: GB123456789</p></div>',
      '<div class="address-block"><h3>Bill To</h3><p class="company">' + (client.company_name || 'Client') + '</p>',
      '<p>' + (client.contact_name || '') + '</p><p>' + (client.address || '') + '</p>',
      '<p>' + (client.city || '') + ' ' + (client.postcode || '') + '</p><p style="margin-top:10px">' + client.email + '</p></div></div>',
      '<div class="invoice-details">',
      '<div class="detail-item"><label>Invoice Date</label><span>' + today + '</span></div>',
      '<div class="detail-item"><label>Due Date</label><span>' + due + '</span></div>',
      '<div class="detail-item"><label>Job Reference</label><span>' + job.id.slice(0, 8).toUpperCase() + '</span></div>',
      '<div class="detail-item"><label>Status</label><span>' + displayStatusHtml + '</span></div></div>',
      '<table class="items-table"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>',
      '<tr><td><strong>' + job.job_title + '</strong><br><span style="color:#666;font-size:12px">' + job.venue_name + ', ' + job.venue_city + '<br>' + dateRange + '<br>' + job.start_time + ' - ' + job.end_time + '</span></td>',
      '<td>' + guards.length + ' guards &times; ' + (costs.hours || 0).toFixed(1) + 'h</td>',
      '<td>&pound;' + job.hourly_rate.toFixed(2) + '/hr</td>',
      '<td class="amount">&pound;' + costs.guardFees.toFixed(2) + '</td></tr>',
      '<tr><td>QuickGuard Service Fee (10%)</td><td>1</td><td>10%</td><td class="amount">&pound;' + costs.serviceFee.toFixed(2) + '</td></tr>',
      '</tbody></table>',
      '<div class="totals">',
      '<div class="totals-row"><span>Subtotal</span><span>&pound;' + (costs.guardFees + costs.serviceFee).toFixed(2) + '</span></div>',
      '<div class="totals-row"><span>VAT (20%)</span><span>&pound;' + costs.vat.toFixed(2) + '</span></div>',
      '<div class="totals-row total"><span>' + (isPaidHtml ? 'Total Paid' : 'Total Due') + '</span><span>&pound;' + costs.total.toFixed(2) + '</span></div></div>',
      '<div class="payment-info"><h4>Payment Information</h4>',
      '<p><strong>Bank:</strong> Barclays Bank PLC</p>',
      '<p><strong>Account Name:</strong> QuickGuard Ltd</p>',
      '<p><strong>Sort Code:</strong> 20-00-00</p>',
      '<p><strong>Account Number:</strong> 12345678</p>',
      '<p><strong>Reference:</strong> ' + invoiceNumber + '</p>' + paymentInfoHtml + '</div>',
      '<div class="footer"><p>Thank you for choosing QuickGuard for your security needs.</p>',
      '<p style="margin-top:5px">Questions? Contact us at billing@quickguard.uk</p></div>',
      '</div></body></html>'
    ];

    return htmlParts.join('');
  }, [client, costs, formatDate, guards.length, invoiceNumber, job, paymentStatus, paymentDate, paymentMethod]);

  const handleDownload = useCallback(() => {
    const html = buildInvoiceHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = invoiceNumber + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [buildInvoiceHTML, invoiceNumber]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(buildInvoiceHTML());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }, [buildInvoiceHTML]);

  const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const dueStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const isPaid = paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === 'succeeded';
  const isFailed = paymentStatus === 'failed';
  const displayStatus = isPaid ? 'Paid' : isFailed ? 'Failed' : 'Awaiting Payment';
  const statusColor = isPaid ? 'text-emerald-600' : isFailed ? 'text-red-600' : 'text-orange-600';
  const displayPaymentDate = paymentDate || todayStr;
  const displayPaymentMethod = paymentMethod || 'Bank Transfer';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Invoice Preview</h2>
            <p className="text-sm text-gray-600">{invoiceNumber}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="bg-[#1a237e] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#0d1642] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              <i className="ri-download-line"></i>
              Download
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-2xl text-gray-600"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
          <div ref={invoiceRef} className="bg-white rounded-xl shadow-lg p-8 max-w-3xl mx-auto">
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-[#1a237e]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#1a237e] rounded-lg flex items-center justify-center">
                  <i className="ri-shield-check-line text-white text-2xl"></i>
                </div>
                <span className="text-2xl font-bold text-[#1a237e] font-[family-name:var(--font-pacifico)]">QuickGuard</span>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold text-[#1a237e]">INVOICE</h1>
                <p className="text-gray-600 mt-1">{invoiceNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">From</h3>
                <p className="font-bold text-[#1a237e]">QuickGuard Ltd</p>
                <p className="text-sm text-gray-600">123 Security House</p>
                <p className="text-sm text-gray-600">London, EC1A 1BB</p>
                <p className="text-sm text-gray-600">United Kingdom</p>
                <p className="text-sm text-gray-600 mt-2">VAT: GB123456789</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bill To</h3>
                <p className="font-bold text-[#1a237e]">{client.company_name || 'Client'}</p>
                <p className="text-sm text-gray-600">{client.contact_name}</p>
                <p className="text-sm text-gray-600">{client.address}</p>
                <p className="text-sm text-gray-600">{client.city} {client.postcode}</p>
                <p className="text-sm text-gray-600 mt-2">{client.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 uppercase">Invoice Date</p>
                <p className="font-semibold text-gray-900">{todayStr}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Due Date</p>
                <p className="font-semibold text-gray-900">{dueStr}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Job Reference</p>
                <p className="font-semibold text-gray-900">{job.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Status</p>
                <p className={`font-semibold ${statusColor}`}>{displayStatus}</p>
              </div>
              {isPaid && (
                <>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Payment Date</p>
                    <p className="font-semibold text-gray-900">{displayPaymentDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Payment Method</p>
                    <p className="font-semibold text-gray-900">{displayPaymentMethod}</p>
                  </div>
                </>
              )}
            </div>

            <table className="w-full mb-8">
              <thead>
                <tr className="bg-[#1a237e] text-white">
                  <th className="py-3 px-4 text-left text-xs uppercase">Description</th>
                  <th className="py-3 px-4 text-left text-xs uppercase">Qty</th>
                  <th className="py-3 px-4 text-left text-xs uppercase">Rate</th>
                  <th className="py-3 px-4 text-right text-xs uppercase">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-4 px-4">
                    <p className="font-semibold text-gray-900">{job.job_title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {job.venue_name}, {job.venue_city}<br />
                      {job.end_date && job.end_date !== job.start_date
                        ? formatDate(job.start_date) + ' - ' + formatDate(job.end_date)
                        : formatDate(job.start_date)}<br />
                      {job.start_time} - {job.end_time}
                    </p>
                  </td>
                  <td className="py-4 px-4 text-gray-600">{guards.length} × {(costs.hours || 0).toFixed(1)}h</td>
                  <td className="py-4 px-4 text-gray-600">£{job.hourly_rate.toFixed(2)}/hr</td>
                  <td className="py-4 px-4 text-right font-semibold">£{costs.guardFees.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-4 px-4 text-gray-600">QuickGuard Service Fee (10%)</td>
                  <td className="py-4 px-4 text-gray-600">1</td>
                  <td className="py-4 px-4 text-gray-600">10%</td>
                  <td className="py-4 px-4 text-right font-semibold">£{costs.serviceFee.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end mb-8">
              <div className="w-72">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">£{(costs.guardFees + costs.serviceFee).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">VAT (20%)</span>
                  <span className="font-semibold">£{costs.vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-[#1a237e] mt-2">
                  <span className="text-lg font-bold text-gray-900">{isPaid ? 'Total Paid' : 'Total Due'}</span>
                  <span className="text-lg font-bold text-[#1a237e]">£{costs.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-[#1a237e] mb-2">Payment Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600"><span className="font-medium">Bank:</span> Barclays Bank PLC</p>
                  <p className="text-gray-600"><span className="font-medium">Account Name:</span> QuickGuard Ltd</p>
                </div>
                <div>
                  <p className="text-gray-600"><span className="font-medium">Sort Code:</span> 20-00-00</p>
                  <p className="text-gray-600"><span className="font-medium">Account Number:</span> 12345678</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm mt-2"><span className="font-medium">Reference:</span> {invoiceNumber}</p>
              {isPaid && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-gray-600"><span className="font-medium">Payment Date:</span> {displayPaymentDate}</p>
                  <p className="text-gray-600"><span className="font-medium">Payment Method:</span> {displayPaymentMethod}</p>
                </div>
              )}
            </div>

            <div className="text-center text-sm text-gray-500 pt-6 border-t border-gray-200">
              <p>Thank you for choosing QuickGuard for your security needs.</p>
              <p className="mt-1">Questions? Contact us at billing@quickguard.uk</p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-printer-line"></i>
            Print
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="bg-[#1a237e] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#0d1642] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              <i className="ri-download-line"></i>
              Download Invoice
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}