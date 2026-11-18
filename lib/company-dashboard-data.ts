// Keep the company read view scoped to the company and signed-in message owner.
// A failed read must not be presented as an empty dataset or zero unread messages.
export async function loadCompanyDashboardData(client: any, companyId: string, userId: string) {
  const results = await Promise.all([
    client.from('company_sites').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    client.from('company_staff').select('*, company_sites(site_name)').eq('company_id', companyId).order('created_at', { ascending: false }),
    client.from('rotas').select('*, company_sites(site_name), guards(full_name)').eq('company_id', companyId).gte('shift_date', new Date().toISOString().split('T')[0]).order('shift_date', { ascending: true }).limit(20),
    client.from('incidents').select('*, company_sites(site_name)').eq('company_id', companyId).order('reported_at', { ascending: false }).limit(10),
    client.from('compliance_records').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    client.from('training_records').select('*, guards(full_name)').eq('company_id', companyId).order('completion_date', { ascending: false }).limit(10),
    client.from('messages').select('id').eq('receiver_id', userId).eq('read', false),
  ]);
  if (results.some(result => result.error || !Array.isArray(result.data))) {
    throw new Error('Company dashboard data could not be loaded. Please retry or contact support.');
  }
  const [sites, staff, rotas, incidents, compliance, training, messages] = results.map(result => result.data);
  return { sites, staff: staff.map((row: any) => ({ ...row, site_name: row.company_sites?.site_name || 'Unassigned' })),
    rotas: rotas.map((row: any) => ({ ...row, site_name: row.company_sites?.site_name || '', guard_name: row.guards?.full_name || 'Unassigned' })),
    incidents: incidents.map((row: any) => ({ ...row, site_name: row.company_sites?.site_name || '' })), compliance,
    training: training.map((row: any) => ({ ...row, guard_name: row.guards?.full_name || '' })), unreadMessages: messages.length };
}
