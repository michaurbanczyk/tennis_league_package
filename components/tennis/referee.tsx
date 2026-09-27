'use client';
import {ChevronRight,Copy,Plus,RefreshCw,ShieldCheck} from 'lucide-react';
import {Checkbox} from '@/components/ui/checkbox';
import {Collapsible,CollapsibleTrigger,CollapsibleContent} from '@/components/ui/collapsible';
import {seededPlayerName,pointLabels,pointMode,matchWinner,type Match} from '@/lib/tennis';

export function RefereeOption({index,busy}:{index:number;busy:boolean}){
 return <Collapsible className="referee-options"><CollapsibleTrigger type="button" className="referee-options-trigger">Sędziowanie (opcjonalnie)<ChevronRight size={16}/></CollapsibleTrigger><CollapsibleContent forceMount className="referee-options-content"><label className="referee-checkbox"><Checkbox name={'referee'+index} disabled={busy}/> Wygeneruj osobny kod dla sędziego</label><p>Sędzia i organizator wpisują punkty. Kod zawodnika pozwala wtedy tylko oglądać wynik.</p></CollapsibleContent></Collapsible>;
}

export function RefereeSettings({match,busy,onChange,copy}:{match:Match;busy:boolean;onChange:(enabled:boolean,rotate?:boolean)=>void;copy:(value:string)=>void}){
 return <Collapsible className="referee-options"><CollapsibleTrigger type="button" className="referee-options-trigger"><span>Sędziowanie (opcjonalnie){match.refereeEnabled?' · włączone':''}</span><ChevronRight size={16}/></CollapsibleTrigger><CollapsibleContent className="referee-options-content">
  {match.refereeEnabled?<><p>Wynik punkt po punkcie wpisują sędzia i organizator.</p><strong>Kod sędziego</strong><div className="current-code-value referee-code"><code>{match.refereeCurrentCode}</code><button type="button" className="button outline" disabled={!match.refereeCurrentCode} onClick={()=>copy(match.refereeCurrentCode!)}><Copy size={16}/> Kopiuj kod</button></div><p>Wejście przez „Wpisz wynik”. Ten kod otwiera tylko ten mecz.</p><button type="button" className="button outline full" disabled={busy} onClick={()=>onChange(true,true)}><RefreshCw size={16}/> Wygeneruj nowy kod sędziego</button><p>Poprzedni kod i dostęp zalogowanego sędziego przestaną działać.</p><button type="button" className="text-button" disabled={busy} onClick={()=>onChange(false)}>Wyłącz sędziowanie</button></>:<><p>Opcja dla meczu prowadzonego przez sędziego. Powstanie osobny kod 5-cyfrowy, a kod zawodnika będzie służył tylko do podglądu.</p><button type="button" className="button outline full" disabled={busy} onClick={()=>onChange(true)}><ShieldCheck size={16}/> Włącz i wygeneruj kod sędziego</button></>}
  <p>Tryb można zmienić pomiędzy gemami. Wynik zostaje zachowany; historia cofania zaczyna się od zmiany trybu.</p>
 </CollapsibleContent></Collapsible>;
}

export function RefereeScoring({match,format,busy,online,onPoint}:{match:Match;format:string;busy:boolean;online:boolean;onPoint:(player:number)=>void}){
 const ready=matchWinner(match.sets,format)!==null,mode=pointMode(match,format),points=pointLabels(match,format);
 return <><div className="editor-hint referee-editor-hint"><ShieldCheck size={17}/><span>{ready?'Koniec meczu — zatwierdź wynik poniżej.':mode==='super'?'Super tie-break: do 10 punktów z przewagą 2.':mode==='tie-break'?'Tie-break: do 7 punktów z przewagą 2.':'Punkty w gemie · 0, 15, 30, 40, przewaga'}</span></div><div className="scoring-grid referee-scoring">{match.players.map((p,i)=><div key={i}><span>{seededPlayerName(match,i)}</span><strong>{ready?'—':points[i]}</strong><button className="button lime" disabled={busy||ready||!online} onClick={()=>onPoint(i)}><Plus size={21}/> Punkt</button></div>)}</div></>;
}

export function RefereePoints({match,format}:{match:Match;format:string}){
 if(!match.refereeEnabled||(match.status!=='live'&&match.status!=='unfinished')||matchWinner(match.sets,format)!==null)return null;
 const mode=pointMode(match,format),points=pointLabels(match,format);
 return <p className="referee-live-points"><ShieldCheck size={14}/><span>{mode==='super'?'Super tie-break':mode==='tie-break'?'Tie-break':'Punkty w gemie'}: <strong>{points.join(' : ')}</strong></span></p>;
}
