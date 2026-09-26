import {LEAGUE_FEATURES} from './site-league';
import {courtEntries,courtNumber} from './court-config';
export {courtNumber,courtLabel} from './court-config';
export type Score = { sets: number[][]; status: 'scheduled'|'live'|'finished'|'unfinished'; startedAt?:string|null; unfinishedAt?:string|null; winner: number|null; finishedTime?:string|null; points?:number[]; tieBreaks?:Record<string,number[]> };
export type MatchSource={matchId:string;outcome:'winner'|'loser'};
export type Match = Score & { id:string; stage:string; roundSize?:number; sources?:MatchSource[]; players:string[]; seeds?:(number|null)[]; court:string; date?:string; time:string; youtubeUrl?:string; refereeEnabled?:boolean; refereeCodeHash?:string; refereeSavedCode?:string; refereeCurrentCode?:string; refereeToken?:string; codeHash?:string; savedCode?:string; currentCode?:string; codeFormat?:'pin5'; needsCodeUpgrade?:boolean; history?:Score[]; configured?:boolean; updated?:string };
export type Level = { id:string; name:string; doubles?:boolean; startSize?:number; bracketConfigured?:boolean; format:'super'|'classic'; matches:Match[] };
export type Board = { levels:Level[]; courtGroups?:import('./court-config').CourtGroup[]; season?:string|null; finalsDates?:string[]; theme?:import('./league-theme').LeagueTheme };
export function setWinner(s:number[], superSet=false):number|null {
 const [a,b]=s;
 if(superSet) return Math.max(a,b)>=10 && Math.abs(a-b)>=2 ? (a>b?0:1):null;
 return (Math.max(a,b)>=6 && Math.abs(a-b)>=2 || Math.max(a,b)===7) ? (a>b?0:1):null;
}
export function matchWinner(sets:number[][],format:string):number|null {
 const wins=[0,0]; sets.forEach((s,i)=>{const w=setWinner(s,format==='super'&&i===2);if(w!==null)wins[w]++});
 return wins[0]>=2?0:wins[1]>=2?1:null;
}
export function scoreSnapshot(m:Match):Score {
 return {sets:structuredClone(m.sets),startedAt:m.startedAt??null,unfinishedAt:m.unfinishedAt??null,status:m.status,winner:m.winner,finishedTime:m.finishedTime??null,points:[...(m.points||[0,0])],tieBreaks:structuredClone(m.tieBreaks||{})};
}
export function pointMode(m:Match,format:string):'game'|'tie-break'|'super' {
 let index=m.sets.length-1;
 if(setWinner(m.sets[index],format==='super'&&index===2)!==null&&matchWinner(m.sets,format)===null)index++;
 if(format==='super'&&index===2)return 'super';
 const set=m.sets[index];return set?.[0]===6&&set?.[1]===6?'tie-break':'game';
}
export function pointLabels(m:Match,format:string):string[] {
 const mode=pointMode(m,format);
 if(mode==='super')return (m.sets[2]||[0,0]).map(String);
 const [a,b]=m.points||[0,0];
 if(mode==='tie-break')return [String(a),String(b)];
 if(a>=3&&b>=3)return a===b?['40','40']:a>b?['AD','40']:['40','AD'];
 return [a,b].map(p=>['0','15','30','40'][p]);
}
export function scopeMatchId(scope?:string|null):string|null {
 return !scope||scope==='admin'?null:scope.startsWith('referee:')?scope.split(':')[1]:scope;
}
export function canEditMatch(m:Match,scope?:string|null):boolean {
 return scope==='admin'||(scopeMatchId(scope)===m.id&&(!m.refereeEnabled||!!scope?.startsWith('referee:')));
}
export function refereeScope(m:Match):string {return `referee:${m.id}:${m.refereeToken||''}`;}
export function addPoint(m:Match,player:number,format:string):void {
 if(!m.refereeEnabled)throw Error('Ten mecz nie ma włączonego sędziowania.');
 if(player!==0&&player!==1)throw Error('Wybierz zawodnika.');
 if(m.status!=='live')throw Error('Najpierw rozpocznij mecz.');
 if(!m.players.every(Boolean))throw Error('Poczekaj na ustalenie zawodników.');
 if(matchWinner(m.sets,format)!==null)throw Error('Wynik jest kompletny. Zatwierdź zakończenie meczu.');
 m.history??=[];m.history.push(scoreSnapshot(m));if(m.history.length>500)m.history.shift();
 let index=m.sets.length-1;
 if(setWinner(m.sets[index],format==='super'&&index===2)!==null){m.sets.push([0,0]);index++;m.points=[0,0];}
 const mode=pointMode(m,format);
 if(mode==='super'){m.sets[index][player]++;m.points=[0,0];return;}
 m.points??=[0,0];m.points[player]++;
 const [a,b]=m.points,target=mode==='tie-break'?7:4;
 if(Math.max(a,b)>=target&&Math.abs(a-b)>=2){
  if(mode==='tie-break'){m.tieBreaks??={};m.tieBreaks[String(index)]=[a,b];}
  m.sets[index][player]++;m.points=[0,0];
 }
}
export function startMatch(m:Match,now=Date.now()):void {
 if(m.status!=='scheduled'&&m.status!=='unfinished')throw Error(m.status==='finished'?'Mecz jest już zakończony.':'Mecz już trwa.');
 if(m.players.length!==2||!m.players.every(Boolean))throw Error('Poczekaj na ustalenie obydwu zawodników.');
 m.history??=[];m.history.push(scoreSnapshot(m));
 m.status='live';m.startedAt=new Date(now).toISOString();m.unfinishedAt=null;
}
// Actual start/resume time is independent of the scheduled date and never
// extended by points, score corrections or changes to match details.
export const LIVE_LIMIT_MS=12*60*60*1000;
export function normalizeLiveMatches(board:Board,now=Date.now()):boolean {
 let changed=false;
 for(const level of board.levels)for(const m of level.matches){
  if(m.status!=='live')continue;
  let start=Date.parse(m.startedAt||'');
  if(!Number.isFinite(start)){
   // Legacy boards did not store a start time. The last persisted activity is
   // the latest possible start; pin this fallback once, never on each poll.
   start=Date.parse(m.updated||'');
   m.startedAt=Number.isFinite(start)?new Date(start).toISOString():null;
   changed=true;
  }
  if(!Number.isFinite(start)||now>=start+LIVE_LIMIT_MS){
   m.status='unfinished';m.winner=null;m.finishedTime=null;
   m.unfinishedAt=new Date(Number.isFinite(start)?start+LIVE_LIMIT_MS:now).toISOString();
   changed=true;
  }
 }
 return changed;
}
export function undoScore(m:Match):void {
 const last=m.history?.pop();if(!last)throw Error('Nie ma zmiany do cofnięcia.');
 const startedAt=last.startedAt===undefined&&last.status!=='scheduled'?m.startedAt:last.startedAt;
 Object.assign(m,last);m.startedAt=startedAt??null;m.unfinishedAt=last.unfinishedAt??null;
 m.finishedTime=last.finishedTime??null;m.points=last.points||[0,0];m.tieBreaks=last.tieBreaks||{};
}
export function addScore(m:Match,player:number,format:string):void {
 if(m.status==='finished')throw Error('Mecz jest zakończony. Najpierw cofnij ostatnią zmianę.');
 if(m.status!=='live')throw Error('Najpierw kliknij „Rozpocznij mecz”.');
 if(!m.players.every(Boolean))throw Error('Poczekaj na rozstrzygnięcie półfinałów.');
 if(matchWinner(m.sets,format)!==null)throw Error('Wynik jest kompletny. Zatwierdź zakończenie meczu.');
 m.history??=[];m.history.push(scoreSnapshot(m));
 if(m.history.length>300)m.history.shift();
 let i=m.sets.length-1;
 if(setWinner(m.sets[i],format==='super'&&i===2)!==null){m.sets.push([0,0]);i++;}
 m.sets[i][player]++;m.status='live';
}
export const demo:Board={levels:[{id:'demo-pro',name:'PRO',format:'super',matches:[{id:'d1',stage:'Półfinał 1',players:['Michał Nowak','Tomasz Kowalski'],court:'Kort 1',time:'10:00',sets:[[6,4],[3,2]],status:'live',winner:null},{id:'d2',stage:'Półfinał 2',players:['Adam Wiśniewski','Marcin Wójcik'],court:'Kort 2',time:'10:00',sets:[[4,6],[6,3],[7,5]],status:'live',winner:null},{id:'d3',stage:'Finał',players:['',''],court:'Kort 1',time:'13:00',sets:[[0,0]],status:'scheduled',winner:null},{id:'d4',stage:'O 3. miejsce',players:['',''],court:'Kort 2',time:'13:00',sets:[[0,0]],status:'scheduled',winner:null}]}]};
export const levelNames=['Pro','Zaawansowana+','Zaawansowana','Średnio-zaawansowana','Kobiety: średnio-zaawansowana+','Kobiety: średnio-zaawansowana'];
export const relaksmisjaLevels=['Top Pro','Pro','Pro Kobiet','Zaawansowane','Zaawansowane Kobiet','Średniozaawansowane wyższe','Średniozaawansowane wyższe Kobiet','Średniozaawansowane','Średniozaawansowane Kobiet','Deblowe Pro','Deblowe Zaawansowane','Deblowe Średniozaawansowane Wyższe','Deblowe Średniozaawansowane','Debel Kobiet','+50'];
export function levelsForTheme(theme?:string){return theme==='relaksmisja'?relaksmisjaLevels:levelNames;}
export function isDoubles(value:string|Pick<Level,'name'|'doubles'>):boolean{if(typeof value!=='string')return value.doubles??isDoubles(value.name);return value.startsWith('Deblowe ')||value==='Debel Kobiet';}
export function roundTitle(size:number){return size===16?'1/8 finału':size===8?'Ćwierćfinały':size===4?'Półfinały':size===2?'Finał':'O 3. miejsce';}
export function makeLevel(name:string,size=4,id='draft',matchId?:(index:number)=>string):Level{
 const level:Level={id,name,startSize:size,format:'super',matches:[]};let previous:Match[]=[];let semis:Match[]=[];
 for(let n=size;n>=2;n/=2){
  const current:Match[]=[];
  for(let i=0;i<n/2;i++){
   const m:Match={id:matchId?matchId(level.matches.length):`${id}-match-${level.matches.length}`,stage:n===16?`1/8 finału ${i+1}`:n===8?`Ćwierćfinał ${i+1}`:n===4?`Półfinał ${i+1}`:'Finał',roundSize:n,players:['',''],court:'',time:'',sets:[[0,0]],status:'scheduled',winner:null,history:[]};
   if(previous.length)m.sources=previous.slice(i*2,i*2+2).map(p=>({matchId:p.id,outcome:'winner'}));
   level.matches.push(m);current.push(m);
  }
  if(n===4)semis=current;previous=current;
 }
 if(semis.length)level.matches.push({id:matchId?matchId(level.matches.length):`${id}-match-${level.matches.length}`,stage:'O 3. miejsce',roundSize:0,sources:semis.map(m=>({matchId:m.id,outcome:'loser'})),players:['',''],court:'',time:'',sets:[[0,0]],status:'scheduled',winner:null,history:[]});
 return level;
}
export function initialBoard(theme:import('./league-theme').LeagueTheme='smart'):Board{return {theme,levels:levelsForTheme(theme).map((name,i)=>makeLevel(name,4,theme==='smart'?`level-${i}`:`rtl-level-${i}`))};}
// Old four-match boards keep their match IDs, scores, codes and history.
export function matchSources(level:Level,m:Match):MatchSource[]{
 if(m.sources)return m.sources;
 if(level.matches.length===4&&(m.stage==='Finał'||m.stage==='O 3. miejsce'))return level.matches.slice(0,2).map(s=>({matchId:s.id,outcome:m.stage==='Finał'?'winner':'loser'}));
 return [];
}
export function entryMatches(level:Level){return level.matches.filter(m=>!matchSources(level,m).length);}
export function seededPlayerName(m:Match,index:number){const name=m.players[index]||'',seed=LEAGUE_FEATURES.bracketEditor?m.seeds?.[index]:null;return name&&seed?`${name} [${seed}]`:name;}
export function seedLimit(level:Level){return entryMatches(level).length*2;}
export function validateLevelSeeds(level:Level){
 const used=new Set<number>(),max=seedLimit(level);
 for(const m of level.matches){
  if(m.seeds===undefined)continue;
  if(!LEAGUE_FEATURES.bracketEditor||!Array.isArray(m.seeds)||m.seeds.length!==2||m.seeds.some(n=>n!==null&&(typeof n!=='number'||!Number.isInteger(n)||n<1||n>max)))throw Error(`Numer rozstawienia musi być liczbą od 1 do ${max}.`);
  if(!matchSources(level,m).length)for(const n of m.seeds)if(n!==null){if(used.has(n))throw Error(`Numer rozstawienia ${n} jest już użyty na tym poziomie.`);used.add(n);}
 }
}
export function playerPlaceholder(level:Level,m:Match,index:number){const source=matchSources(level,m)[index];if(!source)return `${isDoubles(level)?'Para':'Zawodnik'} ${index+1}`;const prior=level.matches.find(s=>s.id===source.matchId);if(LEAGUE_FEATURES.bracketEditor&&prior?.players.every(p=>p.trim()))return prior.players.map((p,i)=>(p.trim().split(/\s+/).slice(1).join(' ')||p)+(prior.seeds?.[i]?` [${prior.seeds[i]}]`:'')).join('/');return `${source.outcome==='winner'?'Zwycięzca':'Przegrany'}: ${prior?.stage||'poprzedni mecz'}`;}
export function bracketRounds(level:Level){return [16,8,4,2,0].map(size=>({size,title:roundTitle(size),matches:level.matches.filter(m=>(m.roundSize??(m.stage==='Finał'?2:m.stage==='O 3. miejsce'?0:4))===size)})).filter(r=>r.matches.length);}
export function propagatePlayers(level:Level){for(const m of level.matches){
 const sources=matchSources(level,m);if(!sources.length)continue;
 const origins=sources.map(s=>{const prior=level.matches.find(p=>p.id===s.matchId);return {prior,index:prior?.status==='finished'&&prior.winner!==null?(s.outcome==='winner'?prior.winner:1-prior.winner):null};});
 m.players=origins.map(({prior,index})=>prior&&index!==null?prior.players[index]:'');
 if(LEAGUE_FEATURES.bracketEditor){const seeds=origins.map(({prior,index})=>prior&&index!==null?(prior.seeds?.[index]??null):null);if(seeds.some(n=>n!==null))m.seeds=seeds;else delete m.seeds;}
}}

export function hasStartedDescendant(level:Level,id:string){const affected=new Set([id]);for(const m of level.matches)if(matchSources(level,m).some(s=>affected.has(s.matchId))){if(m.status!=='scheduled')return true;affected.add(m.id);}return false;}

export function dateLabel(value?:string):string{return value?value.split('-').reverse().join('.'):'';}

export function courtSchedule(board:Board){
 const entries=board.levels.flatMap(l=>l.matches.filter(m=>courtNumber(m.court,board)).map(m=>({m,l})));
 const dates=[...new Set((board.finalsDates||[]).filter(Boolean))].sort();
 return dates.map(date=>({date,courts:courtEntries(board).map(c=>Number(c.id)).map(n=>({number:n,matches:entries.filter(({m})=>(m.date||'')===date&&courtNumber(m.court,board)===String(n)).sort((a,b)=>(a.m.time||'99:99').localeCompare(b.m.time||'99:99')||a.l.name.localeCompare(b.l.name,'pl')||a.m.stage.localeCompare(b.m.stage,'pl'))}))}));
}

export function polishDate(now=new Date()):string {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');
}

export function liveCourts(board:Board,today:string){
 const entries=board.levels.flatMap(l=>l.matches.map(m=>({m,l})));
 const bySchedule=(a:typeof entries[number],b:typeof entries[number])=>(a.m.date||'').localeCompare(b.m.date||'')||(a.m.time||'99:99').localeCompare(b.m.time||'99:99')||a.l.name.localeCompare(b.l.name,'pl')||a.m.stage.localeCompare(b.m.stage,'pl');
 return courtEntries(board).map(c=>Number(c.id)).map(number=>{
  const onCourt=entries.filter(({m})=>courtNumber(m.court,board)===String(number));
  const live=onCourt.filter(({m})=>m.status==='live').sort(bySchedule);
  const waiting=onCourt.filter(({m})=>m.status==='scheduled'&&!!m.date&&(live.length?live.some(({m:current})=>m.date===current.date&&(m.time||'99:99')>=(current.time||'00:00')):m.date===today)).sort(bySchedule);
  const day=live[0]?.m.date||today;
  const previous=onCourt.filter(({m})=>m.status==='finished'&&m.date===day).sort((a,b)=>(b.m.finishedTime||b.m.time||'').localeCompare(a.m.finishedTime||a.m.time||'')||bySchedule(b,a))[0];
  return {number,live,waiting,previous};
 });
}

export const MATCH_SCHEDULE_REQUIRED='Wpisywanie wyniku jest zablokowane. Organizator musi przypisać datę, godzinę i kort.';
export function hasMatchSchedule(m:Match,board:Board){return !!(m.date?.trim()&&m.time?.trim()&&courtNumber(m.court||'',board));}
export function incompleteMatch(level:Level,m:Match){return (LEAGUE_FEATURES.bracketEditor||!!m.configured)&&(!m.date||!m.time||!m.court||(!matchSources(level,m).length&&m.players.some(p=>!p.trim())));}
