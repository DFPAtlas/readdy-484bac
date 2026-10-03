 'use client';
import { useEffect, useState } from 'react';
import { loadMapsEmbedKey } from '@/lib/maps-embed';
export default function SecureMapsPreview({query, height = 200}: {query: string; height?: number}) {
 const [key,setKey] = useState(''); const [error,setError] = useState(false); const [attempt,setAttempt] = useState(0);
 useEffect(() => { let live = true; setError(false); setKey(''); loadMapsEmbedKey().then(value => {if(live) setKey(value);}).catch(() => {if(live) setError(true);}); return () => {live=false;}; }, [attempt]);
 return <div className="rounded-xl overflow-hidden border border-slate-700">
  {error ? <div role="status" className="p-4 text-sm text-slate-400">Map preview unavailable. <button type="button" onClick={() => setAttempt(a => a+1)} className="text-teal-400 underline">Retry</button></div> : !key ? <p role="status" className="p-4 text-sm text-slate-400">Loading map preview…</p> : <iframe title="Location preview" width="100%" height={height} style={{border:0}} loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}`} />}
  <a className="block p-3 text-sm text-teal-400" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer">Open location in Google Maps</a>
 </div>;
}
