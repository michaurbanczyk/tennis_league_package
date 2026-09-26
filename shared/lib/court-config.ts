import {COURTS,courtNumber as legacyNumber,courtLabel as legacyLabel,DEFAULT_COURT_GROUPS} from './courts';
export type CourtGroup={id:string;name:string;courts:string[]};
type Config={courtGroups?:CourtGroup[]};
export function courtGroups(board?:Config):CourtGroup[]{return board?.courtGroups||DEFAULT_COURT_GROUPS;}
export function courtEntries(board?:Config){
 if(!board?.courtGroups)return COURTS.map(c=>({...c,groupId:DEFAULT_COURT_GROUPS.find(g=>g.courts.includes(c.id))!.id}));
 return board.courtGroups.flatMap(g=>g.courts.map((id,i)=>({id,label:`Kort nr ${i+1}${g.name?' '+g.name:''}`,groupId:g.id})));
}
export function courtNumber(value:string,board?:Config):string{
 if(!board?.courtGroups)return legacyNumber(value);
 return courtEntries(board).find(c=>c.id===value||c.label.toLocaleLowerCase('pl-PL')===value.toLocaleLowerCase('pl-PL'))?.id||'';
}
export function courtLabel(value:string,board?:Config):string{return board?.courtGroups?courtEntries(board).find(c=>c.id===courtNumber(value,board))?.label||'Kort: do ustalenia':legacyLabel(value);}
export function validateCourtGroups(value:unknown):CourtGroup[]{
 if(!Array.isArray(value)||!value.length||value.length>16)throw Error('Ustaw od 1 do 16 grup kortów.');
 const ids=new Set<string>(),names=new Set<string>(),courts=new Set<string>();
 const groups=value.map(g=>{
  if(!g||typeof g.id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(g.id)||ids.has(g.id))throw Error('Nieprawidłowa grupa kortów.');
  ids.add(g.id);
  if(typeof g.name!=='string'||g.name.trim().length>60)throw Error('Nazwa grupy kortów może mieć maksymalnie 60 znaków.');
  const name=g.name.trim(),key=name.toLocaleLowerCase('pl-PL');if(names.has(key))throw Error('Grupy kortów muszą mieć różne nazwy.');names.add(key);
  if(!Array.isArray(g.courts)||!g.courts.length||g.courts.length>32)throw Error('Ustaw od 1 do 32 kortów w grupie.');
  for(const id of g.courts){if(typeof id!=='string'||! /^[1-9]\d{0,5}$/.test(id)||courts.has(id))throw Error('Nieprawidłowe lub powtórzone oznaczenie kortu.');courts.add(id);}
  return {id:g.id,name,courts:[...g.courts]};
 });
 if(courts.size>64)throw Error('Liga może mieć maksymalnie 64 korty.');return groups;
}
export function validCourt(value:unknown,board?:Config){const s=String(value??'');if(!s)return '';const id=courtNumber(s,board);if(!id)throw Error('Wybierz kort skonfigurowany dla tego sezonu.');return id;}
export function finalsDates(value:unknown,validDate:(v:unknown)=>string){if(!Array.isArray(value)||!value.length||value.length>10)throw Error('Wybierz od 1 do 10 dni finałów.');const dates=value.map(validDate);if(dates.some(d=>!d)||new Set(dates).size!==dates.length)throw Error('Wpisz różne, prawidłowe daty finałów.');return dates.sort();}
