
'use client';

interface ExportCSVProps {
  activeTab: 'clients' | 'guards';
  clients: any[];
  guards: any[];
}

export default function ExportCSV({ activeTab, clients, guards }: ExportCSVProps) {
  const exportClients = () => {
    const headers = ['Name', 'Email', 'Company', 'Industry', 'Phone', 'City', 'Postcode', 'Jobs Posted', 'Active Jobs', 'Verified', 'Profile Complete', 'Joined'];
    const rows = clients.map(c => {
      const name = c.first_name && c.last_name ? `${c.first_name} ${c.last_name}` : c.contact_name || '';
      return [
        name,
        c.email || '',
        c.company_name || '',
        c.industry || c.company_type || '',
        c.phone || '',
        c.city || '',
        c.postcode || '',
        String(c.total_jobs_posted || 0),
        String(c.active_jobs || 0),
        c.verified ? 'Yes' : 'No',
        c.profile_completed ? 'Yes' : 'No',
        c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB') : '',
      ];
    });
    downloadCSV(headers, rows, 'clients');
  };

  const exportGuards = () => {
    const headers = ['Name', 'Email', 'Phone', 'City', 'Postcode', 'SIA Licence', 'SIA Verified', 'Rating', 'Reviews', 'Jobs Completed', 'Status', 'Joined'];
    const rows = guards.map(g => {
      const name = g.first_name && g.last_name ? `${g.first_name} ${g.last_name}` : g.full_name || '';
      const sia = g.sia_license_number || g.sia_licence_number || '';
      const jobs = g.total_jobs_completed || g.completed_jobs || 0;
      let status = g.verification_status || '';
      if (status === 'approved' && g.is_active) status = 'Active';
      else if (status === 'approved' && !g.is_active) status = 'Inactive';
      else if (status === 'pending') status = 'Pending';
      else if (status === 'rejected') status = 'Rejected';
      return [
        name,
        g.email || '',
        g.phone || '',
        g.city || '',
        g.postcode || '',
        sia,
        g.sia_verified ? 'Yes' : 'No',
        g.rating ? Number(g.rating).toFixed(1) : 'N/A',
        String(g.total_reviews || 0),
        String(jobs),
        status,
        g.created_at ? new Date(g.created_at).toLocaleDateString('en-GB') : '',
      ];
    });
    downloadCSV(headers, rows, 'guards');
  };

  const escapeCSV = (value: string) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const downloadCSV = (headers: string[], rows: string[][], type: string) => {
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `${type}-accounts-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const count = activeTab === 'clients' ? clients.length : guards.length;

  return (
    <button
      onClick={activeTab === 'clients' ? exportClients : exportGuards}
      disabled={count === 0}
      className={`px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
        count === 0
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-teal-600 text-white hover:bg-teal-700'
      }`}
    >
      <i className="ri-download-2-line"></i>
      Export CSV
      <span className={`px-1.5 py-0.5 rounded text-xs ${
        count === 0 ? 'bg-gray-200 text-gray-400' : 'bg-teal-500 text-white'
      }`}>
        {count}
      </span>
    </button>
  );
}
