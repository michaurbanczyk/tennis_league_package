// SmartLiga keeps its original court IDs, labels and accepted input.
export const COURTS=[1,2,3,4,5].map(n=>({id:String(n),label:String(n)}));
export function courtNumber(value:string):string{return value.match(/^(?:Kort\s*)?([1-5])$/i)?.[1]||'';}
export function courtLabel(value:string):string{const n=courtNumber(value);return n?`Numer kortu: ${n}`:'Numer kortu: do ustalenia';}

export const DEFAULT_COURT_GROUPS=[{id:'courts',name:'',courts:['1','2','3','4','5']}];
