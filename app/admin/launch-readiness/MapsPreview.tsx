 'use client';
import SecureMapsPreview from '@/components/SecureMapsPreview';
export default function MapsPreview() { return <section className="rounded-2xl border border-slate-700 p-5"><h3 className="text-white font-semibold mb-3">Maps Embed API preview</h3><p className="text-sm text-slate-400 mb-3">Confirm the map renders to verify Google API enablement and referrer restrictions.</p><SecureMapsPreview query="London, UK" height={256}/></section>; }
