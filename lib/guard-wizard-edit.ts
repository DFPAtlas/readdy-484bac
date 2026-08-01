const EDIT_FLAG_KEY = 'guard_wizard_edit';

export function setGuardWizardEditFlag() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EDIT_FLAG_KEY, '1');
  } catch {}
}

export function clearGuardWizardEditFlag() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(EDIT_FLAG_KEY);
  } catch {}
}

export function hasGuardWizardEditFlag(searchParamValue?: string | null): boolean {
  if (searchParamValue === '1') return true;
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem(EDIT_FLAG_KEY) === '1') return true;
    if (window.location.search.includes('edit=1')) return true;
  } catch {}
  return false;
}

export function goToGuardWizardEdit() {
  setGuardWizardEditFlag();
  if (typeof window !== 'undefined') {
    window.location.href = '/guard/complete-profile-wizard?edit=1';
  }
}

export const DASHBOARD_ALLOWED_STATUSES = ['approved', 'verified'];

export function isDashboardAllowedStatus(status?: string | null): boolean {
  return !!status && DASHBOARD_ALLOWED_STATUSES.includes(status);
}