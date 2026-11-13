/** Verification evidence must come from trusted backend auth, never the email payload. */
export type TicketRequest = {
 inboundEmailId: string; actorKind: 'client' | 'guard'; actorId: string;
 verificationMethod: 'authenticated_session' | 'verified_challenge'; verificationEvidenceId: string;
 subject: string; bodyText: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function prepareInboundTicketRequest(input: Record<string, unknown>): TicketRequest | null {
 const actorKind = input.actorKind;
 const method = input.verificationMethod;
 if (typeof input.inboundEmailId !== 'string' || !UUID.test(input.inboundEmailId) ||
     typeof input.actorId !== 'string' || !UUID.test(input.actorId) ||
     (actorKind !== 'client' && actorKind !== 'guard') ||
     (method !== 'authenticated_session' && method !== 'verified_challenge') ||
     typeof input.verificationEvidenceId !== 'string' ||
     input.verificationEvidenceId.length < 1 || input.verificationEvidenceId.length > 250 ||
     typeof input.subject !== 'string' || !input.subject.trim() || input.subject.length > 500 ||
     typeof input.bodyText !== 'string' || !input.bodyText.trim() || input.bodyText.length > 20000) return null;
 return { inboundEmailId: input.inboundEmailId, actorKind, actorId: input.actorId,
   verificationMethod: method, verificationEvidenceId: input.verificationEvidenceId,
   subject: input.subject.trim(), bodyText: input.bodyText };
}
