import type {Board} from './tennis';
export function normalizePlayerName(value:string){
 return value.toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').trim();
}
export function searchMatches(board:Board,query:string){
 const words=normalizePlayerName(query).split(/\s+/).filter(Boolean);
 if(!words.length)return [];
 return board.levels.flatMap(l=>l.matches.filter(m=>m.players.some(p=>words.every(w=>normalizePlayerName(p).includes(w)))).map(m=>({m,l})))
  .sort((a,b)=>(a.m.date||'9999').localeCompare(b.m.date||'9999')||(a.m.time||'99:99').localeCompare(b.m.time||'99:99')||a.l.name.localeCompare(b.l.name,'pl'));
}
