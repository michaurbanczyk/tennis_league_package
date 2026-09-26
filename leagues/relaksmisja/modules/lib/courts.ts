// Stable IDs keep existing courts 1–5 assigned to FAME.
export const COURTS=Array.from({length:9},(_,i)=>({id:String(i+1),label:`Kort nr ${i<6?i+1:i-5} ${i<6?'FAME':'FLEX'}`}));
export const FINALS_DATE_LABELS=['Weekend 1 · dzień 1','Weekend 1 · dzień 2','Weekend 2 · dzień 1','Weekend 2 · dzień 2'];
export function courtNumber(value:string):string {
 const exact=COURTS.find(c=>c.id===value||c.label.toLowerCase()===value.toLowerCase());
 return exact?.id||value.match(/^Kort\s*([1-9])$/i)?.[1]||'';
}
export function courtLabel(value:string):string {return COURTS.find(c=>c.id===courtNumber(value))?.label||'Kort: do ustalenia';}

export const DEFAULT_COURT_GROUPS=[{id:'fame',name:'FAME',courts:['1','2','3','4','5','6']},{id:'flex',name:'FLEX',courts:['7','8','9']}];
