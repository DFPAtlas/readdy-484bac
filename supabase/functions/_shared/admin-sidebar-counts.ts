interface CountResult {
  count: number | null;
  error: unknown;
}

type CountReader = (table: string, column: string, value: string | string[]) => Promise<CountResult>;

export async function readAdminSidebarCounts(readCount: CountReader) {
  const results = await Promise.all([
    readCount('transactions', 'status', 'failed'),
    readCount('guards', 'verification_status', ['pending', 'manual_review', 'pending_sia_check']),
    readCount('sia_verifications', 'verification_status', 'pending'),
    readCount('guard_payouts', 'status', 'held'),
    readCount('contact_submissions', 'status', 'new'),
    readCount('complaints', 'status', ['open', 'pending']),
  ]);

  const counts = results.map(result => {
    if (result.error || typeof result.count !== 'number' || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error('Unable to load admin sidebar counts');
    }
    return result.count;
  });

  return {
    failedPayments: counts[0], guardVerifications: counts[1], siaVerifications: counts[2],
    heldPayments: counts[3], contactSubmissions: counts[4], complaints: counts[5],
  };
}
