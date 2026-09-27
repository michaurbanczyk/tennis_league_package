import {courtNumber,liveCourts,type Board,type Match} from './tennis';
import {localMatchDate,localMatchTime} from './match-timing';
function endKey(m:Match){const t=Date.parse(m.finishedAt||'');return Number.isFinite(t)?localMatchDate(t)+'T'+localMatchTime(t)+':'+new Date(t).getUTCSeconds().toString().padStart(2,'0'):(m.date||'')+'T'+(m.finishedTime||m.time||'00:00')+':00';}
export function tvCourts(board:Board,today:string){
 const finished=board.levels.flatMap(l=>l.matches.filter(m=>m.status==='finished').map(m=>({m,l,key:endKey(m)})));
 return liveCourts(board,today).map(c=>{
  const days=new Set([today,...c.live.map(({m})=>m.date).filter(Boolean)]);
  const previous=finished.filter(({m,key})=>courtNumber(m.court,board)===String(c.number)&&days.has(key.slice(0,10))).sort((a,b)=>b.key.localeCompare(a.key))[0];
  return {...c,previous};
 });
}
