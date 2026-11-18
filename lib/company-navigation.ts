export const COMPANY_TABS = ['overview', 'sites', 'staff', 'rotas', 'incidents', 'compliance', 'training', 'reports', 'billing', 'messages', 'settings'] as const;
export type CompanyTab = typeof COMPANY_TABS[number];
export function resolveCompanyTab(value: string | null): CompanyTab {
  return COMPANY_TABS.includes(value as CompanyTab) ? value as CompanyTab : 'overview';
}
export function companyTabHref(tab: CompanyTab): string {
  return `/company/dashboard?tab=${tab}`;
}
