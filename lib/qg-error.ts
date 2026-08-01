export type QGErrorCode =
  | 'not_authenticated'
  | 'session_expired'
  | 'permission_denied'
  | 'missing_profile'
  | 'onboarding_incomplete'
  | 'verification_required'
  | 'account_suspended'
  | 'account_disabled'
  | 'record_not_found'
  | 'rls_rejection'
  | 'duplicate_action'
  | 'invalid_workflow_state'
  | 'edge_function_failure'
  | 'network_timeout'
  | 'service_failure'
  | 'validation_error'
  | 'unknown'

const SAFE_USER_MESSAGES: Record<QGErrorCode, string> = {
  not_authenticated: 'Please sign in to continue.',
  session_expired: 'Your session has expired. Please sign in again.',
  permission_denied: 'You do not have permission to perform this action.',
  missing_profile: 'Your profile could not be found. Please complete your account setup.',
  onboarding_incomplete: 'Please complete your profile setup before continuing.',
  verification_required: 'Your account verification must be completed before accessing this feature.',
  account_suspended: 'Your account has been suspended. Please contact support.',
  account_disabled: 'Your account has been disabled. Please contact support.',
  record_not_found: 'The requested information could not be found.',
  rls_rejection: 'You do not have permission to access this information.',
  duplicate_action: 'This action has already been performed.',
  invalid_workflow_state: 'This action cannot be completed in the current state.',
  edge_function_failure: 'A service is temporarily unavailable. Please try again later.',
  network_timeout: 'The request timed out. Please check your connection and try again.',
  service_failure: 'A temporary error occurred. Please try again later.',
  validation_error: 'Please check your input and try again.',
  unknown: 'An unexpected error occurred. Please try again.',
}

export class QGError extends Error {
  code: QGErrorCode
  correlationId: string
  safeMessage: string
  technicalDetail: string
  httpStatus: number

  constructor(
    code: QGErrorCode,
    technicalDetail: string,
    extra?: { httpStatus?: number }
  ) {
    super(SAFE_USER_MESSAGES[code])
    this.name = 'QGError'
    this.code = code
    this.safeMessage = SAFE_USER_MESSAGES[code]
    this.technicalDetail = technicalDetail
    this.httpStatus = extra?.httpStatus || 400
    this.correlationId = generateCorrelationId()
  }
}

let seq = 0
function generateCorrelationId(): string {
  seq += 1
  const ts = Date.now().toString(36)
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${ts}-${rnd}-${seq}`
}

export function qgError(code: QGErrorCode, detail: string, httpStatus?: number): QGError {
  return new QGError(code, detail, { httpStatus })
}

export function getSafeErrorMessage(err: unknown): string {
  if (err instanceof QGError) return err.safeMessage
  if (err instanceof Error) return 'An unexpected error occurred. Please try again.'
  return 'An unexpected error occurred. Please try again.'
}

export function logQGSafeError(err: unknown, context?: Record<string, unknown>) {
  if (err instanceof QGError) {
    console.error(`[QGError] ${err.code} | ${err.correlationId} | ${err.technicalDetail}`, context || {})
    return
  }
  console.error('[QGError] unknown', err, context || {})
}

export function logAuditEvent(params: {
  userId?: string
  role?: string
  action: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
  correlationId?: string
}) {
  try {
    const correlationId = params.correlationId || generateCorrelationId()
    console.log(
      `[AUDIT] ${correlationId} | ${params.action} | user=${params.userId || 'anon'} | role=${params.role || 'none'} | entity=${params.entityType || 'none'}/${params.entityId || 'none'}`,
      params.metadata || {}
    )
  } catch {}
}