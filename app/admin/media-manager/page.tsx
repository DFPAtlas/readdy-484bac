'use client';

import { useState, useEffect, useRef } from 'react';
import AdminPageShell from '@/components/admin/AdminPageShell';
import QuickGuardImage from '@/components/QuickGuardImage';
import { INDUSTRY_MEDIA_ORIGINALS } from '@/lib/industry-media-originals';
import { BRAND_LOGO } from '@/lib/brand';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { normalizeMediaUpload } from '@/lib/site-media-upload';

const originals: Record<string,string> = {
  ...INDUSTRY_MEDIA_ORIGINALS,
  'homepage-hero': "https://readdy.ai/api/search-image?query=Professional%20male%20security%20guard%20in%20sharp%20black%20uniform%20with%20visible%20SIA%20badge%20standing%20confidently%20beside%20a%20sleek%20modern%20laptop%20displaying%20a%20dashboard%20interface%20with%20job%20match%20listings%20in%20a%20modern%20urban%20London%20night%20setting%20with%20subtle%20city%20lights%20and%20blurred%20skyline%20background%2C%20high-end%20cinematic%20lighting%20with%20sharp%20realistic%20details%2C%20dark%20navy%20blue%20and%20teal%20color%20palette%2C%20left%20side%20features%20a%20clean%20dark%20gradient%20background%20perfect%20for%20text%20overlay%2C%20right%20side%20shows%20the%20guard%20and%20technology%20scene%2C%20ultra%20clean%20premium%20corporate%20composition%2C%20modern%20minimalist%20web%20design%20aesthetic%2C%20excellent%20contrast%20ensuring%20white%20text%20readability%20on%20the%20left%2C%20professional%20studio-quality%20lighting%20with%20soft%20shadows%2C%20simple%20background%20highlighting%20the%20subject&width=1600&height=900&seq=hero_quickguard_main_20260503&orientation=landscape",
  'homepage-logo': "https://storage.helloreaddy.io/project_files/0de8e08a-1549-4fde-a095-32bc66c0db0b/5b8bf6ae-e0fb-4726-93c3-167ed96d0716_compressed_quickguard-home-transparent-600-1.webp",
  'brand-full-light': BRAND_LOGO.fullLight,
  'brand-full-dark': BRAND_LOGO.fullDark,
  'brand-symbol-light': BRAND_LOGO.symbolLight,
  'brand-symbol-dark': BRAND_LOGO.symbolDark,
};
type Slot = { slot_key: string; page_label: string; section_label: string; recommended_width: number | null; recommended_height: number | null };
type Version = { id: string; slot_key: string; width: number; height: number; byte_size: number; mime_type: string; created_at: string };
function ratio(w: number,h: number) {
  let a=w,b=h; while(b){const r=a%b;a=b;b=r;} return (w/a)+':'+(h/a);
}
const fmt = (n:number) => (n/1024).toFixed(1)+' KiB';
const btn = 'rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700 disabled:opacity-40';
function MediaCard({slot,versions,current,onStaged}:{slot:Slot;versions:Version[];current:string|null;onStaged:()=>void}) {
  const src=originals[slot.slot_key];
  const [dimensions,setDimensions]=useState<{w:number;h:number}|null>(null);
  const [failed,setFailed]=useState(false);
  const [metadata,setMetadata]=useState<{size:number;type:string}|null>(null);
  const [storedPreview,setStoredPreview]=useState<{id:string;blob:Blob}|null>(null);
  const [storedUrl,setStoredUrl]=useState('');
  const [device,setDevice]=useState<'desktop'|'tablet'|'mobile'>('desktop');
  useEffect(()=>{
    if(!storedPreview){setStoredUrl('');return;}
    const url=URL.createObjectURL(storedPreview.blob);
    setStoredUrl(url);
    return()=>URL.revokeObjectURL(url);
  },[storedPreview]);
  const [file,setFile]=useState<File|null>(null);
  const [preview,setPreview]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  useEffect(()=>{if(!file){setPreview('');return;} const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  async function stage(){
    if(!file||lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    try{
      const normalized = await normalizeMediaUpload(file);
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('Sign in again.');
      const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!base||!anon)throw new Error('Service configuration unavailable.');
      const response=await fetch(base+'/functions/v1/stage-site-media?slot='+encodeURIComponent(slot.slot_key),{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:anon,'Content-Type':'image/png'},body:normalized});
      if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(typeof body?.error==='string'?body.error:'Upload failed.');}
      setMessage('Draft stored. Live image unchanged.');setFile(null);onStaged();
    }catch(e){setMessage(e instanceof Error?e.message:'Upload failed.');}
    finally{lock.current=false;setBusy(false);}
  }
  async function publish(version:string|null){
    if(lock.current)return;
    if(!window.confirm(version===null?'Restore the original website image?':'Publish this stored version to the public website?'))return;
    lock.current=true;setBusy(true);setMessage('');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('Sign in again.');
      const base=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!base||!anon)throw new Error('Service configuration unavailable.');
      const response=await fetch(base+'/functions/v1/publish-site-media',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({slot:slot.slot_key,version,expected:current})});
      if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(typeof body?.error==='string'?body.error:'Publication failed.');}
      setMessage(version===null?'Original restored.':'Version published.');onStaged();
    }catch(e){setMessage(e instanceof Error?e.message:'Publication failed.');}
    finally{lock.current=false;setBusy(false);}
  }
  async function readVersion(version:string,downloadFile:boolean){
    if(lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      const base=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if(!session||!base||!anon)throw new Error('Session or media service unavailable.');
      const res=await fetch(base+'/functions/v1/admin-read-site-media?slot='+encodeURIComponent(slot.slot_key)+'&version='+encodeURIComponent(version),{headers:{Authorization:'Bearer '+session.access_token,apikey:anon},cache:'no-store'});
      if(!res.ok)throw new Error('Stored version unavailable.');
      const blob=await res.blob();
      if(blob.type!=='image/png'||blob.size>10485760)throw new Error('Unexpected image response.');
      if(downloadFile){
        const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=slot.slot_key+'-'+version+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }else {setFile(null);setStoredPreview({id:version,blob});}
    }catch(e){setMessage(e instanceof Error?e.message:'Image retrieval failed.');}
    finally{lock.current=false;setBusy(false);}
  }
  async function inspectOriginal(){
    if(!src||lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    try{
      const res=await fetch(src,{credentials:'omit',signal:AbortSignal.timeout(10000)});
      if(!res.ok)throw new Error();
      const reader=res.body?.getReader();
      if(!reader)throw new Error();
      let size=0;
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.byteLength;
        if(size>20*1024*1024){await reader.cancel();throw new Error();}
      }
      const type=res.headers.get('content-type')?.split(';')[0]??'';
      if(!['image/png','image/jpeg','image/webp','image/avif','image/gif','image/svg+xml'].includes(type))throw new Error();
      setMetadata({size,type});
    }catch{setMessage('Original file metadata unavailable: the host may block cross-origin requests or the image exceeds the inspection limit.');}
    finally{lock.current=false;setBusy(false);}
  }
  async function download(){
    if(!src||lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    try{
      const res=await fetch(src,{credentials:'omit'});
      if(!res.ok)throw new Error();
      const blob=await res.blob();
      setMetadata({size:blob.size,type:blob.type});
      const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/avif':'avif'} as Record<string,string>)[blob.type];
      if(!ext)throw new Error();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=slot.slot_key+'.'+ext;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch{setMessage('Direct download unavailable from this image host. Open the original to save it manually.');}
    finally{lock.current=false;setBusy(false);}
  }
  return <article className="min-w-0 rounded-2xl border border-[#263653] bg-[#111d35] overflow-hidden">
    <div className="aspect-video bg-slate-800 flex items-center justify-center">
      {src&&!failed?<QuickGuardImage src={src} alt={slot.section_label} className="w-full h-full object-contain" onLoad={e=>setDimensions({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})} onError={()=>setFailed(true)}/>:<span className="text-slate-400 text-sm">Original preview unavailable</span>}
    </div>
    <div className="p-4 space-y-3">
      <p className="text-xs text-teal-300">{slot.page_label}</p><h2 className="font-semibold text-white">{slot.section_label}</h2>
      <dl className="text-sm text-slate-300 space-y-1">
        <div>Original pixels: {dimensions?dimensions.w+' × '+dimensions.h:'Unknown'}</div>
        <div>Original ratio: {dimensions?ratio(dimensions.w,dimensions.h):'Unknown'}</div>
        <div>Resolution: {dimensions?((dimensions.w*dimensions.h)/1e6).toFixed(2)+' MP':'Unknown'}</div>
        <div>Recommended: {slot.recommended_width&&slot.recommended_height?slot.recommended_width+' × '+slot.recommended_height+' px ('+ratio(slot.recommended_width,slot.recommended_height)+')':'Not yet measured'}</div>
        <div>Original file size / format: {metadata?fmt(metadata.size)+' · '+metadata.type:'Not verified'}</div>
        {src&&!metadata&&<button type="button" className={btn} disabled={busy} onClick={()=>void inspectOriginal()}>Inspect original file</button>}
      </dl>
      {src&&<div className="flex flex-wrap gap-2"><button type="button" className={btn} disabled={busy} onClick={download}>Download original</button><a className={btn} href={src} target="_blank" rel="noopener noreferrer">Open original</a></div>}
      <label className="block text-sm text-slate-300">Replacement image (max 10 MB; stored as PNG)<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={busy} className="block w-full mt-2 text-xs" onChange={e=>{setFile(e.target.files?.[0]??null);setStoredPreview(null);setMessage('');e.target.value='';}} /></label>
      {(preview||storedUrl)&&<div className="space-y-2">
        <p className="text-xs text-slate-300">Crop simulation (not a live page preview)</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Preview viewport">
          {(['desktop','tablet','mobile'] as const).map(d=><button type="button" key={d} aria-pressed={device===d} className={btn} onClick={()=>setDevice(d)}>{d}</button>)}
        </div>
        <div className="mx-auto overflow-hidden rounded-lg bg-slate-800" style={{width:device==='desktop'?'100%':device==='tablet'?'75%':'45%',aspectRatio:device==='desktop'?'16/9':device==='tablet'?'4/3':'9/16'}}>
          <QuickGuardImage src={preview||storedUrl} alt={preview?'Selected upload preview':'Stored version preview'} className="w-full h-full object-cover"/>
        </div>
        {storedUrl&&<button type="button" className={btn} onClick={()=>setStoredPreview(null)}>Close stored preview</button>}
      </div>}
      <button type="button" className={btn} disabled={!file||busy} onClick={stage}>{busy?'Working…':'Upload draft'}</button>
      <p role="status" className="text-sm text-teal-200">{message}</p>
      <details className="text-sm text-slate-300"><summary>Stored versions ({versions.length})</summary>{versions.map(v=><div key={v.id} className="py-2 space-y-2 break-words"><p>{v.width} × {v.height} px · {ratio(v.width,v.height)} · {fmt(v.byte_size)} · {v.mime_type} · {new Date(v.created_at).toLocaleDateString('en-GB')}</p><div className="flex flex-wrap gap-2"><button type="button" className={btn} disabled={busy} onClick={()=>void readVersion(v.id,false)}>Preview version</button><button type="button" className={btn} disabled={busy} onClick={()=>void readVersion(v.id,true)}>Download version</button></div></div>)}</details>
      {(['homepage-hero','homepage-logo','brand-full-light','brand-full-dark'].includes(slot.slot_key)||Object.prototype.hasOwnProperty.call(INDUSTRY_MEDIA_ORIGINALS,slot.slot_key))?<div className="space-y-2 border-t border-slate-700 pt-3">
        <p className="text-xs text-slate-300">{current?'Replacement selected for public delivery':'Original image selected'}</p>
        {current&&<QuickGuardImage key={current} src={process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/public-site-media?slot='+encodeURIComponent(slot.slot_key)+'&v='+current} alt="Currently published replacement" className="w-full h-36 object-contain bg-slate-800 rounded-lg"/>}
        {versions.map(v=><div key={v.id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-300">{new Date(v.created_at).toLocaleString('en-GB')} · {v.width} × {v.height}</span><button type="button" className={btn} disabled={busy||current===v.id} onClick={()=>void publish(v.id)}>{current===v.id?'Selected':'Publish version'}</button></div>)}
        <button type="button" className={btn} disabled={busy||!current} onClick={()=>void publish(null)}>Restore original</button>
      </div>:<p className="text-xs text-amber-300">Public usage not yet confirmed; publication not enabled for this slot.</p>}
    </div>
  </article>;
}
export default function MediaManager(){
  const admin=useAdminAuth();
  const allowed=admin.role==='admin'||admin.role==='super_admin';
  const [slots,setSlots]=useState<Slot[]>([]);
  const [versions,setVersions]=useState<Version[]>([]);
  const [publications,setPublications]=useState<Record<string,string>>({});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  const [search,setSearch]=useState('');
  useEffect(()=>{
    if(!allowed)return;
    let live=true;
    async function load(){
      setLoading(true);setError('');
      try{
        const db=supabase.schema('app');
        const [s,v,p]=await Promise.all([db.from('site_media_slots').select('slot_key,page_label,section_label,recommended_width,recommended_height').order('page_label'),db.from('site_media_versions').select('id,slot_key,width,height,byte_size,mime_type,created_at').order('created_at',{ascending:false}),db.from('site_media_publications').select('slot_key,version_id')]);
        if(s.error||v.error||p.error)throw new Error('Media registry unavailable. Check the migration and permissions.');
        if(live){setSlots(s.data??[]);setVersions(v.data??[]);setPublications(Object.fromEntries((p.data??[]).map(item=>[item.slot_key,item.version_id])));}
      }catch(e){if(live)setError(e instanceof Error?e.message:'Could not load media.');}finally{if(live)setLoading(false);}
    }
    void load();return()=>{live=false;};
  },[allowed,refresh]);
  return <AdminPageShell title="Image & Media Manager" description="Review image specifications, stage replacements and manage public image publications." >
    {!allowed?<p className="text-slate-300">{admin.role?'Content management permission required.':'Checking permissions…'}</p>:<>
      <label className="block text-sm text-slate-300 mb-4">Search images<input className="block mt-2 rounded-lg bg-slate-800 border border-slate-600 p-2 w-full text-white" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      <p className="text-sm text-amber-300 mb-4">Managed homepage, industry, service, regional, marketing and public full-logo images. Symbol publication is not yet enabled.</p>
      {error?<div role="alert" className="text-red-300">{error} <button className={btn} onClick={()=>setRefresh(x=>x+1)}>Retry</button></div>:loading?<p className="text-slate-300">Loading images…</p>:<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{slots.filter(s=>(s.page_label+' '+s.section_label).toLowerCase().includes(search.toLowerCase())).map(s=><MediaCard key={s.slot_key} slot={s} current={publications[s.slot_key]??null} versions={versions.filter(v=>v.slot_key===s.slot_key)} onStaged={()=>setRefresh(x=>x+1)}/>)}</div>}
    </>}
  </AdminPageShell>;
}
