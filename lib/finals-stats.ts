import {entryMatches,isDoubles,matchFormat,setWinner,type Board,type Level,type Match} from './tennis';

export function participants(levels:Level[]){
 const people=new Set<string>(),unnamedPairs=new Set<string>();
 const key=(name:string)=>name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pl-PL');
 for(const l of levels)for(const m of entryMatches(l))for(const player of m.players){
  const name=key(player);if(!name)continue;
  if(!isDoubles(l)){people.add(name);continue;}
  const pair=name.split(/\s*(?:\/|&|\+)\s*|\s+i\s+/).filter(Boolean);
  if(pair.length===2)pair.forEach(p=>people.add(key(p)));else unnamedPairs.add(name);
 }
 return {count:people.size+unnamedPairs.size*2,estimated:unnamedPairs.size>0};
}

export function hasPlayoffs(l:Level){return !!l.bracketConfigured||l.matches.some(m=>m.configured||m.players.some(p=>p.trim())||m.court||m.date||m.time||m.status!=='scheduled');}
export function completedDuration(m:Match,now=Date.now()):number|null{
 if(m.status!=='finished')return null;
 const start=Date.parse(m.actualStartedAt||m.startedAt||''),end=Date.parse(m.finishedAt||'');
 return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end<=now?end-start:null;
}
export type MatchRecord={match:Match;level:string;value:number};
export function summarizeLevels(levels:Level[],now=Date.now()){
 let played=0,total=0,durationMs=0,timed=0,sets=0,games=0,deciders=0,comebacks=0,tieBreaks=0,superTieBreaks=0;
 const scores=new Map<string,number>();let longest:MatchRecord|null=null,shortest:MatchRecord|null=null,mostGames:MatchRecord|null=null,longestSuper:MatchRecord|null=null;
 for(const l of levels){total+=l.matches.length;for(const m of l.matches){
  if(m.status!=='finished')continue;played++;
  const first=m.sets[0]?setWinner(m.sets[0]):null,second=m.sets[1]?setWinner(m.sets[1]):null;
  if(first!==null&&m.winner!==null&&m.winner!==first)comebacks++;
  if(first!==null&&second!==null&&first!==second&&m.sets[2]&&setWinner(m.sets[2],matchFormat(l,m)==='super')!==null)deciders++;
  const duration=completedDuration(m,now);
  if(duration!==null){durationMs+=duration;timed++;const r={match:m,level:l.name,value:duration};if(!longest||duration>longest.value)longest=r;if(!shortest||duration<shortest.value)shortest=r;}
  let matchGames=0,regularSets=0;
  m.sets.forEach((s,i)=>{
   const superSet=matchFormat(l,m)==='super'&&i===2;
   if(s.length!==2||s.some(n=>!Number.isInteger(n)||n<0)||setWinner(s,superSet)===null)return;
   sets++;
   // The deciding match tie-break replaces a set; its points are never games.
   if(superSet){superTieBreaks++;const value=s[0]+s[1];if(!longestSuper||value>longestSuper.value)longestSuper={match:m,level:l.name,value};return;}
   if(Math.max(...s)===7&&Math.min(...s)===6)tieBreaks++;
   regularSets++;matchGames+=s[0]+s[1];const result=Math.max(...s)+':'+Math.min(...s);scores.set(result,(scores.get(result)||0)+1);
  });
  games+=matchGames;if(regularSets&&(!mostGames||matchGames>mostGames.value))mostGames={match:m,level:l.name,value:matchGames};
 }}
 const frequency=Math.max(0,...scores.values());
 const frequent=[...scores].filter(([,n])=>n===frequency).map(([s])=>s).sort((a,b)=>a.localeCompare(b,'pl',{numeric:true}));
 return {played,total,durationMs,timed,sets,games,frequency,frequent,longest,shortest,mostGames,deciders,comebacks,tieBreaks,superTieBreaks,longestSuper};
}
export function finalsStats(board:Board,now=Date.now()){
 const levels=board.levels.filter(hasPlayoffs);
 return {participants:participants(levels),total:summarizeLevels(levels,now),levels:levels.map(l=>({id:l.id,name:l.name,...summarizeLevels([l],now)}))};
}
