'use client';
import {matchFormat} from '@/lib/tennis';
import {RefereePoints} from './referee';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Search,X} from 'lucide-react';
import {seededPlayerName,courtLabel,dateLabel,type Board} from '@/lib/tennis';
import {normalizePlayerName,searchMatches} from '@/lib/match-search';
import {YoutubeLink} from './youtube-link';
import {playerPlaceholder} from '@/lib/tennis';
import {LiveBall} from './live-ball';
function PlayerName({name,query}:{name:string;query:string}){
 const normalized=normalizePlayerName(name),words=normalizePlayerName(query).split(/\s+/).filter(Boolean);
 const marked=Array.from({length:name.length},()=>false);
 for(const word of words){let at=normalized.indexOf(word);while(at!==-1){for(let i=at;i<at+word.length;i++)marked[i]=true;at=normalized.indexOf(word,at+word.length);}}
 const parts=[];let start=0;
 while(start<name.length){let end=start+1;while(end<name.length&&marked[end]===marked[start])end++;parts.push(marked[start]?<mark key={start}>{name.slice(start,end)}</mark>:<span key={start}>{name.slice(start,end)}</span>);start=end;}
 return <>{parts}</>;
}
export function MatchSearch({board,loading,archived,isDemo,error,navigation}:{board:Board;loading:boolean;archived:boolean;isDemo:boolean;error?:string;navigation:ReactNode}){
 const [query,setQuery]=useState(''),[expanded,setExpanded]=useState(false);const input=useRef<HTMLInputElement>(null),toggle=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(expanded)input.current?.focus();},[expanded]);
 function close(){setExpanded(false);setQuery('');if(toggle.current?.offsetParent)toggle.current.focus();}
 const results=searchMatches(board,query),searching=!!query.trim();
 return <section className="navigation-search" aria-label="Nawigacja i wyszukiwanie meczów">
  <div className="navigation-search-row">
   {navigation}
   <button ref={toggle} type="button" className="navigation-search-toggle" aria-label={expanded?'Zamknij wyszukiwanie':'Szukaj zawodnika'} aria-expanded={expanded} aria-controls="navigation-search-field" onClick={()=>expanded?close():setExpanded(true)}>{expanded?<X size={21}/>:<Search size={21}/>}</button>
   <div id="navigation-search-field" className={`match-search-field navigation-search-field ${expanded?'is-expanded':''}`}><Search size={18} aria-hidden="true"/><input ref={input} id="player-search" type="search" aria-label="Szukaj zawodnika po imieniu lub nazwisku" placeholder="Szukaj zawodnika…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){close();}}} autoComplete="off"/>{query&&<button type="button" aria-label="Wyczyść wyszukiwanie" onClick={()=>{setQuery('');input.current?.focus();}}><X size={18}/></button>}</div>
  </div>
  {searching&&<div className="navigation-search-results"><p className="match-search-scope">Wszystkie poziomy i korty · {archived?`archiwum ${board.season||''}`:isDemo?'przykładowe mecze':'bieżący sezon'}</p><p role="status" className="match-search-count">{loading?'Wczytywanie meczów…':error?'Nie udało się pobrać meczów.':`Znalezione mecze: ${results.length}`}</p>{!loading&&!error&&(results.length?<div className="match-search-results">{results.map(({m,l})=><article className="match-search-result" key={m.id}>
   <div className="match-search-meta"><span>{l.name}</span><span className={`status ${m.status}`}>{m.status==='live'&&<LiveBall/>}{m.status==='live'?'W grze':m.status==='finished'?'Zakończony':m.status==='unfinished'?'Mecz rozpoczęty, ale niedokończony':'Oczekujący'}</span></div>
   <h3 className="match-stage-name">{m.stage}<YoutubeLink url={m.youtubeUrl}/></h3>
   {m.players.map((name,index)=><p key={index} className={`match-search-player ${m.winner===index?'search-winner':''}`}><PlayerName name={seededPlayerName(m,index)||playerPlaceholder(l,m,index)} query={query}/>{m.winner===index&&<span className="winner-check" role="img" aria-label="Zwycięzca"> ✓</span>}</p>)}
   <RefereePoints match={m} format={matchFormat(l,m)}/><div className="match-search-details"><span>{courtLabel(m.court,board)}</span><span>{m.date?dateLabel(m.date):'Data do ustalenia'} · {m.time||'Godzina do ustalenia'}</span>{m.status==='finished'&&m.finishedTime&&<span className="finished-time">Zakończono o {m.finishedTime}</span>}</div>
  </article>)}</div>:<p className="match-search-empty">Brak pasujących meczów. Spróbuj wpisać samo nazwisko lub jego fragment.</p>)}</div>}
 </section>;
}
