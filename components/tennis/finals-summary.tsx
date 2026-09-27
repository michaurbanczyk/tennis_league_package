'use client';
import {useMemo} from 'react';
import {finalsStats,type MatchRecord} from '@/lib/finals-stats';
import type {Board} from '@/lib/tennis';
const num=(n:number)=>n.toLocaleString('pl-PL');
const minutes=(ms:number)=>Math.round(ms/60000);
function duration(ms:number){const min=minutes(ms);return min>=60?`${Math.floor(min/60)} godz.${min%60?' '+min%60+' min':''}`:`${min} min`;}
function Metric({label,value,note}:{label:string;value:string;note?:string}){return <article className="match-card finals-metric"><h3>{label}</h3><strong>{value}</strong>{note&&<p>{note}</p>}</article>;}
function RecordCard({title,record,time=false,superTie=false}:{title:string;record:MatchRecord|null;time?:boolean;superTie?:boolean}){return <article className="match-card finals-record"><h3>{title}</h3><strong>{record?(superTie?record.match.sets[2].join(':'):time?duration(record.value):`${num(record.value)} gemów`):'—'}</strong>{record?<><p className="finals-record-players">{record.match.players.join(' vs ')}</p><p className="finals-record-score">{record.match.sets.map(s=>s.join(':')).join(', ')}</p><small>{record.level}{superTie?` · ${num(record.value)} punktów łącznie`:''}</small></>:<p>{superTie?'Brak zakończonych super tie-breaków.':`Brak zakończonych meczów${time?' z zapisanym czasem':''}.`}</p>}</article>;}
export function FinalsSummary({board}:{board:Board}){
 const stats=useMemo(()=>finalsStats(board),[board]),s=stats.total;
 const frequent=s.frequent.join(' / ')||'—';
 return <section className="finals-summary" aria-label="Finały w liczbach">
  <div className="results-top"><div><h2>Statystyki z finałów</h2><p className="finals-subtitle">Aktualizowane na bieżąco</p></div></div>
  <div className="finals-metrics finals-participation">
   <Metric label="Rozegrane mecze" value={`${num(s.played)} / ${num(s.total)}`} note={s.total?`${Math.round(s.played/s.total*100)}% finałów`:'Brak utworzonych meczów'}/>
   <Metric label="Uczestnicy finałów" value={`${stats.participants.estimated?'≈ ':''}${num(stats.participants.count)}`} note={stats.participants.estimated?'Liczba orientacyjna: pary bez rozdzielonych nazwisk liczymy jako 2 osoby.':'Według wpisanych nazwisk, bez powtórzeń.'}/>
  </div>
  <div className="finals-metrics">
   <Metric label="Łączny czas gry" value={s.timed?`${num(minutes(s.durationMs))} min`:'—'} note={s.timed?`${num(Math.round(s.durationMs/360000)/10)} godz.`:'Brak zapisanych czasów'}/>
   <Metric label="Średni czas meczu" value={s.timed?`${num(minutes(s.durationMs/s.timed))} min`:'—'} note={s.timed?`Mecze z zapisanym czasem: ${s.timed}`:'Brak zapisanych czasów'}/>
   <Metric label="Rozegrane sety" value={num(s.sets)}/>
   <Metric label="Rozegrane gemy" value={num(s.games)}/>
   <Metric label="Najczęstszy wynik seta" value={frequent} note={s.frequency?`Wystąpienia: ${s.frequency}${s.frequent.length>1?' · każdy z wyników':''}`:'Brak zakończonych setów'}/>
   <Metric label="Decydująca partia" value={num(s.deciders)} note={`Trzeci set lub super tie-break · ${s.played?Math.round(s.deciders/s.played*100):0}% zakończonych meczów`}/>
   <Metric label="Powroty po pierwszym secie" value={num(s.comebacks)} note="Zwycięstwa po przegranym pierwszym secie"/>
   <Metric label="Rozegrane tie-breaki" value={num(s.tieBreaks)} note={`Przy 6:6 · osobno super tie-breaki: ${num(s.superTieBreaks)}`}/>
  </div>
  <p className="finals-counting-note">Dane z zakończonych meczów. Czas liczymy wyłącznie dla meczów z prawidłowym rozpoczęciem i zakończeniem. Super tie-break liczy się jako decydujący set; jego punkty nie są gemami i nie wchodzą do najczęstszego wyniku seta.</p>
  <section className="finals-section" aria-labelledby="finals-records"><h3 id="finals-records">Rekordy finałów</h3><div className="finals-records">
   <RecordCard title="Najdłuższy mecz" record={s.longest} time/>
   <RecordCard title="Najkrótszy mecz" record={s.shortest} time/>
   <RecordCard title="Najwięcej gemów w jednym meczu" record={s.mostGames}/>
   <RecordCard title="Najdłuższy super tie-break" record={s.longestSuper} superTie/>
  </div></section>
  <section className="finals-section" aria-labelledby="finals-levels"><h3 id="finals-levels">Statystyki z finałów – według poziomu</h3><div className="finals-levels">
   {stats.levels.map(l=><article className="match-card finals-level" key={l.id}><h4>{l.name}</h4><dl>
    <div><dt>Rozegrane mecze</dt><dd>{num(l.played)} / {num(l.total)}</dd></div>
    <div><dt>Czas gry</dt><dd>{l.timed?`${num(minutes(l.durationMs))} min`:'—'}</dd></div>
    <div><dt>Średnio</dt><dd>{l.timed?`${num(minutes(l.durationMs/l.timed))} min`:'—'}</dd></div>
    <div><dt>Sety</dt><dd>{num(l.sets)}</dd></div><div><dt>Gemy</dt><dd>{num(l.games)}</dd></div>
    <div><dt>Najczęstszy wynik seta</dt><dd>{l.frequent.join(' / ')||'—'}</dd></div>
   </dl></article>)}
   {!stats.levels.length&&<p className="schedule-empty">W tym sezonie nie utworzono jeszcze meczów finałowych.</p>}
  </div></section>
 </section>;
}
