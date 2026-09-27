import {organizer} from '@/lib/organizer-session';
import {sponsorStorage} from '@/lib/sponsor-storage';
export const dynamic='force-dynamic';
const INDEX='announcements/index-v1.json',MAX=10*1024*1024;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
type Notice={id:string;title:string;description:string;uploadedAt:string;size:number};
async function index(){const object=await sponsorStorage().get(INDEX);return {version:object?.etag||'',items:object?await object.json<Notice[]>():[]};}
export async function GET(req:Request){try{
 const id=new URL(req.url).searchParams.get('id');
 if(!id)return json(await index());
 if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Nie znaleziono dokumentu.'},404);
 if(!(await index()).items.some(n=>n.id===id))return json({error:'Nie znaleziono dokumentu.'},404);
 const o=await sponsorStorage().get('announcements/pdf/'+id);if(!o)return json({error:'Nie znaleziono dokumentu.'},404);
 return new Response(o.body,{headers:{...headers,'Content-Type':'application/pdf','Content-Length':String(o.size),'Content-Disposition':`inline; filename="komunikat-${id}.pdf"`,'Content-Security-Policy':"sandbox; default-src 'none'"}});
 }catch(e){console.error('announcements read failed',e);return json({error:'Nie można wczytać komunikatów. Spróbuj ponownie.'},503);}}
export async function POST(req:Request){try{
 if(req.headers.get('sec-fetch-site')==='cross-site'||req.headers.has('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Niedozwolone żądanie.'},403);
 if(!await organizer(req))return json({error:'Tylko organizator może dodawać komunikaty.'},403);
 const expected=req.headers.get('x-announcements-version');if(expected===null)return json({error:'Odśwież listę komunikatów.'},409);
 if(!req.headers.get('content-type')?.startsWith('multipart/form-data;'))return json({error:'Wybierz PDF i uzupełnij tytuł.'},400);
 const reader=req.body?.getReader();if(!reader)return json({error:'Brak pliku.'},400);const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>MAX+16384){await reader.cancel();return json({error:'PDF może mieć maksymalnie 10 MB.'},400);}chunks.push(value);}}finally{reader.releaseLock();}
 const body=new Uint8Array(total);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.length;}
 const form=await new Response(body,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData();
 const title=String(form.get('title')||'').trim(),description=String(form.get('description')||'').trim(),file=form.get('file');
 if(!title||title.length>120||description.length>1000)return json({error:'Podaj tytuł do 120 znaków i opis do 1000 znaków.'},400);
 if(!(file instanceof File)||file.size>MAX||file.size<12)return json({error:'Wybierz PDF o rozmiarze do 10 MB.'},400);
 const bytes=new Uint8Array(await file.arrayBuffer()),decoder=new TextDecoder();
 if(!decoder.decode(bytes.slice(0,8)).startsWith('%PDF-')||!decoder.decode(bytes.slice(-1024)).includes('%%EOF'))return json({error:'Plik nie jest prawidłowym dokumentem PDF.'},400);
 const current=await index();if(current.version!==expected)return json({error:'Lista komunikatów zmieniła się. Odśwież ją i ponów zapis.'},409);
 if(current.items.length>=200)return json({error:'Osiągnięto limit 200 komunikatów.'},400);
 const id=crypto.randomUUID(),key='announcements/pdf/'+id;const notice:Notice={id,title,description,uploadedAt:new Date().toISOString(),size:file.size};
 const storage=sponsorStorage();await storage.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
 try{const saved=await storage.put(INDEX,JSON.stringify([notice,...current.items]),{httpMetadata:{contentType:'application/json'},onlyIf:expected?{etagMatches:expected}:{etagDoesNotMatch:'*'}});
  if(!saved){await storage.delete(key);return json({error:'Inny organizator dodał komunikat. Odśwież listę i ponów zapis.'},409);}
  return json({version:saved.etag,items:[notice,...current.items]});
 }catch(e){throw e;} // Keep the PDF if a storage timeout leaves the index write outcome unknown.
 }catch(e){console.error('announcements save failed',e);return json({error:'Nie udało się dodać komunikatu. Spróbuj ponownie.'},503);}}

export async function DELETE(req:Request){try{
 if(req.headers.get('sec-fetch-site')==='cross-site'||req.headers.has('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Niedozwolone żądanie.'},403);
 if(!await organizer(req))return json({error:'Tylko organizator może usuwać komunikaty.'},403);
 const expected=req.headers.get('x-announcements-version'),id=new URL(req.url).searchParams.get('id');
 if(expected===null)return json({error:'Odśwież listę komunikatów.'},409);
 if(!id||!/^[a-f0-9-]{36}$/.test(id))return json({error:'Nie znaleziono komunikatu.'},404);
 const current=await index();if(current.version!==expected)return json({error:'Lista komunikatów zmieniła się. Spróbuj ponownie.'},409);
 if(!current.items.some(n=>n.id===id))return json({error:'Nie znaleziono komunikatu.'},404);
 const items=current.items.filter(n=>n.id!==id),storage=sponsorStorage();
 const saved=await storage.put(INDEX,JSON.stringify(items),{httpMetadata:{contentType:'application/json'},onlyIf:{etagMatches:expected}});
 if(!saved)return json({error:'Lista komunikatów zmieniła się. Spróbuj ponownie.'},409);
 // The index controls public access, including when PDF cleanup must be retried later.
 try{await storage.delete('announcements/pdf/'+id);}catch(e){console.error('announcement PDF cleanup failed',e);}
 return json({version:saved.etag,items});
 }catch(e){console.error('announcement delete failed',e);return json({error:'Nie udało się usunąć komunikatu. Spróbuj ponownie.'},503);}}
