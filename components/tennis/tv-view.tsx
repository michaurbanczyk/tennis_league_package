'use client';
import {tvCourts} from '@/lib/tv-courts';
import {matchFormat} from '@/lib/tennis';
import {courtGroups,courtEntries} from '@/lib/court-config';
import {useEffect,useState,type CSSProperties} from 'react';
import {ArrowLeft,RefreshCw,WifiOff} from 'lucide-react';
import {seededPlayerName,pointLabels,matchWinner,courtLabel,liveCourts,dateLabel,playerPlaceholder,type Board,type Match,type Level} from '@/lib/tennis';
import {YoutubeLink} from './youtube-link';
import {LiveBall} from './live-ball';
import {leagueBrand} from '@/lib/league-theme';
import {LeagueHeader} from './banner-settings';
function playerName(m:Match,index:number,l:Level){return seededPlayerName(m,index)||playerPlaceholder(l,m,index);}
function TvPrevious({m,l}:{m:Match;l:Level}){
 return <article className="tv-previous" aria-label={`Ostatni zakończony mecz: ${l.name}, ${m.stage}`}>
  <YoutubeLink url={m.youtubeUrl}/>
  <p className="tv-previous-label">Ostatni zakończony</p>
  <div className="tv-previous-scores">{m.players.map((_,index)=><div className={`tv-previous-player ${m.winner===index?'tv-previous-winner':''}`} key={index}>
   <span className="tv-previous-name">{playerName(m,index,l)}{m.winner===index&&<span aria-label="Zwycięzca"> ✓</span>}</span>
   <span className="tv-previous-sets" aria-label={`Wynik: ${playerName(m,index,l)}`}>{[0,1,2].map(set=><span key={set} aria-label={`${set===2&&matchFormat(l,m)==='super'?'Super tie-break':`Set ${set+1}`}: ${m.sets[set]?.[index]??'nie grano'}`}>{m.sets[set]?.[index]??'–'}</span>)}</span>
  </div>)}</div>
  <p className="tv-previous-finished">Zakończony{m.finishedTime&&<> o <strong>{m.finishedTime}</strong></>}</p>
 </article>;
}
function TvMatch({m,l}:{m:Match;l:Level}){
 const showPoints=!!m.refereeEnabled&&matchWinner(m.sets,matchFormat(l,m))===null;
 return <article className="tv-current-match" aria-label={`${l.name}, ${m.stage}`}>
  <div className="tv-live-heading"><div className="status live"><LiveBall/>W grze</div><YoutubeLink url={m.youtubeUrl}/></div>
  {m.time&&<p className="tv-planned-start">Planowany start: <strong>{m.time}</strong></p>}
  <div className="tv-match-description"><p className="tv-level-name">{l.name}</p><h3 className={m.stage==='Finał'?'tv-final-title':''}>{m.stage}</h3></div>
  <div className="tv-players">{m.players.map((_,index)=><div className="tv-player" key={index}>
   <p className="tv-player-name">{playerName(m,index,l)}</p>
   <div className={`tv-set-scores ${showPoints?'tv-with-points':''}`} aria-label={`Wynik: ${playerName(m,index,l)}`}>{[0,1,2].map(set=><div key={set} className={`tv-set-score ${set===m.sets.length-1?'tv-current-set':''} ${!m.sets[set]?'tv-unplayed':''}`}><span>{set===2?(matchFormat(l,m)==='super'?'STB':'S3'):`S${set+1}`}</span><strong>{m.sets[set]?.[index]??'–'}</strong></div>)}{showPoints&&<div className="tv-set-score tv-game-points"><span>Pkt</span><strong>{pointLabels(m,matchFormat(l,m))[index]}</strong></div>}</div>
  </div>)}</div>
 </article>;
}
export function TvView({board,today,online,lastSync,isDemo,onExit}:{board:Board;today:string;online:boolean;lastSync:Date|null;isDemo:boolean;onExit:()=>void}){
 const brand=leagueBrand(board.theme),isRtl=board.theme==='relaksmisja';
 const [venue,setVenue]=useState<string>('all');
 useEffect(()=>{try{const saved=localStorage.getItem('relaksmisja-tv-venue');if(saved)setVenue(saved)}catch{}},[]);
 function selectVenue(next:string){setVenue(next);try{localStorage.setItem('relaksmisja-tv-venue',next)}catch{}}
 const groups=courtGroups(board),activeVenue=groups.some(g=>g.id===venue)?venue:'all';
 const courts=tvCourts(board,today).filter(c=>activeVenue==='all'||courtEntries(board).some(entry=>entry.id===String(c.number)&&entry.groupId===activeVenue)),hasLive=courts.some(c=>c.live.length),hasWaiting=courts.some(c=>c.waiting.length);
 useEffect(()=>{
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  let wasFullscreen=!!document.fullscreenElement;
  const change=()=>{if(document.fullscreenElement)wasFullscreen=true;else if(wasFullscreen)onExit();};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onExit();};
  document.addEventListener('fullscreenchange',change);document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=previous;document.removeEventListener('fullscreenchange',change);document.removeEventListener('keydown',key);};
 },[onExit]);
 return <main className="tv-screen" data-venue={venue} aria-label="Wyniki na żywo — widok telewizyjny">
  <header className="tv-header"><div className="tv-brand"><div className="tv-brand-logos">{isRtl?<LeagueHeader/>:<img src={brand.logo} alt={brand.name}/>}</div><div><h1>{isRtl?'Wyniki na żywo':brand.title}</h1><p>{board.season?`${isRtl?'':'Sezon '}${board.season} · `:''}{dateLabel(today)}{isDemo?' · DEMO':''}</p></div></div><div className="tv-header-controls"><div className="tv-venue-filter" role="group" aria-label="Korty w widoku TV"><button aria-pressed={activeVenue==='all'} onClick={()=>selectVenue('all')}>Wszystkie</button>{groups.map(g=><button key={g.id} aria-pressed={activeVenue===g.id} onClick={()=>selectVenue(g.id)}>Korty {g.name||'główne'}</button>)}</div><button className="tv-exit" onClick={onExit}><ArrowLeft size={18}/> Wróć</button></div></header>
  {!hasLive&&<p className="tv-empty-message">Obecnie żaden mecz nie jest rozgrywany{!hasWaiting?' · Na dziś nie ma kolejnych zaplanowanych meczów':''}</p>}
  <div className="tv-courts" style={{'--tv-columns':Math.max(1,courts.length)} as CSSProperties}>{courts.map(court=>{const upcoming=court.live.length?undefined:court.waiting[0],next=court.waiting[court.live.length?0:1];return <section key={court.number} className={`tv-court ${court.live.length?'':'tv-idle'} ${court.live.length>1?'tv-multiple':''} ${court.previous?'tv-has-previous':''}`} aria-label={courtLabel(String(court.number),board)}>
   <h2>{courtLabel(String(court.number),board)}</h2>
   {court.previous&&<TvPrevious m={court.previous.m} l={court.previous.l}/>}
   <div className="tv-current">{court.live.length?court.live.map(({m,l})=><TvMatch key={m.id} m={m} l={l}/>):<div className="tv-idle-content"><p>Brak meczu na żywo</p>{upcoming?<><strong>{upcoming.m.time||'—'}</strong><p>Najbliższy zaplanowany mecz<YoutubeLink url={upcoming.m.youtubeUrl}/></p>{upcoming.m.date!==today&&<p className="tv-next-date">{dateLabel(upcoming.m.date)}</p>}<p className="tv-level-name">{upcoming.l.name}</p><p className="tv-idle-stage">{upcoming.m.stage}</p><div className="tv-upcoming-players">{[0,1].map(index=><p className="tv-player-name" key={index}>{playerName(upcoming.m,index,upcoming.l)}</p>)}</div></>:null}</div>}</div>
   <div className="tv-next">{next?<><p className="tv-next-label"><strong>{next.m.time||'—'}</strong><span>Oczekujący</span><YoutubeLink url={next.m.youtubeUrl}/></p>{next.m.date!==today&&<p className="tv-next-date">{dateLabel(next.m.date)}</p>}<p className="tv-next-players"><span>{playerName(next.m,0,next.l)}</span><span>{playerName(next.m,1,next.l)}</span></p></>:<p className="tv-next-empty">{court.live.length?'Brak kolejnych meczów w tym dniu.':'Brak kolejnych meczów na dziś.'}</p>}</div>
  </section>;})}</div>
  <footer className="tv-footer"><span className={online?'tv-connected':'tv-disconnected'} role="status">{online?<RefreshCw size={16}/>:<WifiOff size={16}/>}<span>{online?'Automatyczne odświeżanie co 3 sekundy':'Brak połączenia — wyniki mogą być nieaktualne'}{!online&&lastSync?` · Ostatni odbiór: ${lastSync.toLocaleTimeString('pl-PL',{timeZone:'Europe/Warsaw'})}`:''}</span></span><span>Kolejne mecze: tylko z tego samego dnia · godziny według planu</span></footer>
 </main>;
}
