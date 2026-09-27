import {database} from '@/db/raw';
export async function organizer(req:Request){
 const token=req.headers.get('cookie')?.match(/(?:^|; )tennis_session=([^;]+)/)?.[1];if(!token)return false;
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const row=await database().prepare('SELECT scope FROM sessions WHERE token=? AND expires>?').bind(hash,Date.now()).first<{scope:string}>();return row?.scope==='admin';
}
