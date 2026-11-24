'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const slots = [
  ['licence', 'Driving licence front'],
  ['back', 'Driving licence back'],
  ['proof', 'Proof of address'],
] as const;
type Slot = (typeof slots)[number][0];
type Review = { id: string; version: string; attested_at: string | null };
type ReviewState = { version: string | null; status: string | null; advisory: string | null;
  reasons: string[]; review: Review | null; viewed: Slot[]; can_restore: boolean };

export default function DocumentsReviewPanel({ guardId, onAttestation, onRestored }: {
  guardId: string;
  onAttestation: (guardId: string, reviewId: string | null) => void;
  onRestored: () => void;
}) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [pending, setPending] = useState<string | null>('status');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<{ slot: Slot; url: string; mime: string } | null>(null);
  const active = useRef(false);
  const objectUrl = useRef<string | null>(null);
  const currentReview = useRef<string | null>(null);

  const request = async (action: string, body: Record<string, unknown> = {}) => {
    const result = await supabase.functions.invoke('admin-guard-document-review', {
      body: { guardId, action, ...body },
    });
    if (result.error) {
      const parsed = await result.error.context?.json?.().catch(() => null);
      throw new Error(typeof parsed?.error === 'string' ? parsed.error : 'Document review is unavailable. Try again.');
    }
    return result;
  };

  const apply = (next: ReviewState) => {
    if (!active.current) return;
    if (currentReview.current !== (next.review?.id ?? null)) {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
      setPreview(null);
      setConfirmed(false);
    }
    currentReview.current = next.review?.id ?? null;
    setState(next);
    onAttestation(guardId, next.review?.attested_at ? next.review.id : null);
  };

  useEffect(() => {
    active.current = true;
    let cancelled = false;
    async function load() {
      try {
        const result = await supabase.functions.invoke('admin-guard-document-review', {
          body: { guardId, action: 'status' },
        });
        if (result.error) throw new Error();
        if (!cancelled) apply(result.data);
      } catch {
        if (!cancelled) setError('Could not load document review. Check your MFA session and retry.');
      } finally {
        if (!cancelled) setPending(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
      active.current = false;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    };
    // The panel is keyed by guard ID. Actions reload their own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardId]);

  async function refresh() {
    apply((await request('status')).data);
  }

  async function act(action: string, kind?: Slot) {
    if (pending) return;
    let failure = '';
    setError('');
    setPending(action);
    try {
      if (action === 'prepare') {
        onAttestation(guardId, null);
        setConfirmed(false);
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
        setPreview(null);
        await request(action);
      } else if (action === 'document' && state?.review && kind) {
        const result = await request(action, { reviewId: state.review.id, kind });
        const mime = result.response?.headers.get('X-Document-Type') ?? '';
        if (!(result.data instanceof Blob) || !['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(mime)) {
          throw new Error('Could not display the verified document.');
        }
        if (!active.current) return;
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = URL.createObjectURL(new Blob([result.data], { type: mime }));
        setPreview({ slot: kind, url: objectUrl.current, mime });
      } else if (action === 'attest' && state?.review && confirmed) {
        const result = await supabase.schema('app').rpc('attest_guard_document_review', { p_review: state.review.id });
        if (result.error) throw new Error('Review could not be recorded. Check the current documents and retry.');
      } else if (action === 'restore' && state?.review?.attested_at) {
        const result = await supabase.functions.invoke('admin-verify-guard', {
          body: { guardId, action: 'restore', reviewId: state.review.id },
        });
        if (result.error || result.data?.action !== 'restored') throw new Error('Restoration could not be confirmed.');
        if (active.current) onRestored();
        return;
      }
      await refresh();
    } catch (err) {
      failure = err instanceof Error ? err.message : 'Document review failed.';
      if (active.current) {
        onAttestation(guardId, null);
        setPreview(null);
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
        objectUrl.current = null;
        setConfirmed(false);
        try { await refresh(); } catch { setState(null); }
        if (active.current) setError(failure);
      }
    } finally {
      if (active.current) setPending(null);
    }
  }

  const reviewCurrent = !!state?.review;
  const canAttest = reviewCurrent && state?.viewed.length === slots.length && confirmed;
  const label = slots.find(([slot]) => slot === preview?.slot)?.[1] ?? 'Identity document';
  return (
    <section aria-label="Version-bound document review" className="min-w-0 space-y-4 text-slate-200">
      <div className="rounded-xl border border-slate-700 p-4">
        <h3 className="font-semibold text-white">Identity document review</h3>
        <p className="mt-1 text-sm text-slate-300" aria-live="polite">
          {pending ? 'Working… ' : ''}Submission {state?.version ?? 'awaiting capture'} · {state?.status ?? 'No check recorded'}
        </p>
        <p className="mt-1 text-sm">AI advisory: {state?.advisory ?? 'Pending or unavailable'}. You can review the documents manually.</p>
        {!!state?.reasons.length && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {state.reasons.map((reason) => <li key={reason}>{reason.replaceAll('_', ' ')}</li>)}
        </ul>}
        {error && <p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!!pending} onClick={() => void act('status')} className="rounded border px-3 py-2 text-sm">Refresh status</button>
          <button type="button" disabled={!!pending} onClick={() => void act('prepare')} className="rounded bg-teal-700 px-3 py-2 text-sm text-white">
            {reviewCurrent ? 'Start a new review' : 'Prepare or retry document review'}
          </button>
        </div>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map(([slot, title]) => <article key={slot} className="min-w-0 rounded-lg border border-slate-700 p-3">
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="mt-1 text-xs text-slate-300">{state?.viewed.includes(slot) ? 'Access recorded' : 'Awaiting review'}</p>
          <button type="button" disabled={!reviewCurrent || !!pending} onClick={() => void act('document', slot)}
            className="mt-2 rounded border px-3 py-2 text-sm disabled:opacity-50">Open {title.toLowerCase()}</button>
        </article>)}
      </div>
      {preview && <div className="max-h-[60vh] min-w-0 overflow-auto rounded border border-slate-700 p-3" tabIndex={0} aria-label={label}>
        {preview.mime === 'application/pdf'
          ? <><iframe title={label} sandbox="" className="h-[48vh] w-full" src={preview.url} />
              <a className="underline" href={preview.url} download="review-document.pdf">Download PDF for review</a></>
          // The local blob comes only from the scoped and checksum-verified broker.
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={preview.url} alt={label} className="mx-auto max-w-full object-contain" />}
      </div>}
      {reviewCurrent && <div className="rounded border border-slate-700 p-3">
        {state?.review?.attested_at ? <p role="status">Human review recorded for submission {state.review.version}.</p> : <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>I examined the current licence front and back and proof of address, and confirm these versions support approval.</span>
          </label>
          <button type="button" disabled={!canAttest || !!pending} onClick={() => void act('attest')}
            className="mt-3 rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-50">Record human review</button>
        </>}
        {state?.review?.attested_at && state.can_restore &&
          <button type="button" disabled={!!pending} onClick={() => void act('restore')}
            className="mt-2 rounded border px-3 py-2 text-sm">Restore guard access</button>}
      </div>}
    </section>
  );
}
