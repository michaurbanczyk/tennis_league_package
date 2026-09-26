'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Collapsible,CollapsibleContent,CollapsibleTrigger} from '@/components/ui/collapsible';
import {BANNERS,BANNER_MAX_BYTES,validateBanner,type BannerKind} from '@/lib/sponsor-banner';
import {LeagueBrand} from './league-brand';
import {toast} from 'sonner';
const endpoint=(kind:BannerKind)=>'/api/banners?kind='+kind;
type Meta={version:string;custom:boolean};
function useBanner(kind:BannerKind){
 const [meta,setMeta]=useState<Meta|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const controller=new AbortController();
  async function refresh(){try{const r=await fetch(endpoint(kind),{cache:'no-store',signal:controller.signal});const d=await r.json() as Meta & {error?:string};if(!r.ok)throw Error(d.error);if(active){setMeta(d);setError('');}}catch(e){if(active&&!controller.signal.aborted)setError((e as Error).message);}}
  void refresh();const timer=setInterval(()=>void refresh(),30000);const listener=()=>void refresh();window.addEventListener('league-banner-updated',listener);window.addEventListener('focus',listener);
  return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('league-banner-updated',listener);window.removeEventListener('focus',listener);};
 },[kind]);return {meta,error};
}
export function BannerImage({kind,fallback}:{kind:BannerKind;fallback:ReactNode}){
 const {meta}=useBanner(kind),[failed,setFailed]=useState('');
 if(!meta?.custom||failed===meta.version)return <>{fallback}</>;
 const d=BANNERS[kind];return <img className={'custom-banner custom-banner-'+kind} src={endpoint(kind)+'&image=1&v='+encodeURIComponent(meta.version)} width={d.width} height={d.height} alt={d.title} onError={()=>setFailed(meta.version)} decoding="async"/>;
}
export function LeagueHeader(){return <BannerImage kind="header" fallback={<LeagueBrand theme="relaksmisja"/>}/>;}
function BannerEditor({kind}:{kind:BannerKind}){
 const {meta,error:loadError}=useBanner(kind),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[expected,setExpected]=useState('');
 const d=BANNERS[kind];
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 async function select(selected?:File){setFile(null);setError('');if(!selected)return;
  try{if(selected.size>BANNER_MAX_BYTES)throw Error('Baner może mieć maksymalnie 2 MB.');validateBanner(new Uint8Array(await selected.arrayBuffer()),selected.type,kind);const bitmap=await createImageBitmap(selected);bitmap.close();setExpected(meta?.version??'');setFile(selected);}catch(e){setError((e as Error).message||'Nie można odczytać obrazu.');}
 }
 async function save(reset=false){if(!meta||!reset&&!file)return;setBusy(true);setError('');try{
  const r=await fetch(endpoint(kind)+(reset?'&reset=1':''),{method:'POST',headers:{'Content-Type':reset?'application/json':file!.type,'X-Banner-Version':reset?meta.version:expected},body:reset?'{}':file});const data=await r.json() as Meta & {error?:string};
  if(!r.ok){if(r.status===409){const latest=await fetch(endpoint(kind),{cache:'no-store'}).then(r=>r.json()) as Meta;setExpected(latest.version);window.dispatchEvent(new Event('league-banner-updated'));}throw Error(data.error);}
  setFile(null);window.dispatchEvent(new Event('league-banner-updated'));toast.success(reset?'Przywrócono domyślny baner.':'Zapisano baner.');
 }catch(e){setError((e as Error).message||'Nie udało się zapisać banera. Spróbuj ponownie.');}finally{setBusy(false);}}
 return <section className="banner-editor"><h3>{d.title}</h3><p id={'banner-help-'+kind}>PNG lub JPG · <strong>{d.width} × {d.height} px</strong> · maksymalnie 2 MB</p>
 <label className="banner-file-label">Wybierz plik z komputera<input type="file" accept="image/png,image/jpeg" aria-describedby={'banner-help-'+kind} disabled={busy||!meta} onChange={e=>{void select(e.currentTarget.files?.[0]);e.currentTarget.value='';}}/></label>
 {preview&&<div className="banner-preview"><p>Podgląd przed zapisaniem: {file?.name}</p><img src={preview} alt={'Podgląd: '+d.title} width={d.width} height={d.height}/></div>}
 {(error||loadError)&&<p role="alert" className="error-message">{error||loadError}</p>}
 <div className="banner-actions"><button className="button dark" disabled={busy||!file||!meta} onClick={()=>void save()}>{busy?'Zapisywanie…':'Zapisz baner'}</button>
 {file&&<button className="button outline" disabled={busy} onClick={()=>{setFile(null);setError('');}}>Anuluj</button>}
 {meta?.custom&&<><a className="button outline" href={endpoint(kind)+'&image=1&download=1&v='+encodeURIComponent(meta.version)}>Pobierz kopię banera</a><button className="button outline" disabled={busy} onClick={()=>void save(true)}>Przywróć domyślny</button></>}</div></section>;
}
export function BannerSettings(){return <Collapsible className="banner-settings"><CollapsibleTrigger className="season-management-trigger">Banery strony <span aria-hidden="true">＋</span></CollapsibleTrigger><CollapsibleContent><p className="banner-settings-note">Banery obowiązują we wszystkich sezonach. Sponsorzy są widoczni na dole zakładek, poza widokiem TV. Baner ligi zastępuje logo i nazwę w nagłówku, również w TV. Banery pobierzesz osobno przyciskiem „Pobierz kopię banera”; kopia danych ligi obejmuje rozgrywki.</p><BannerEditor kind="header"/><BannerEditor kind="sponsors"/></CollapsibleContent></Collapsible>;}
