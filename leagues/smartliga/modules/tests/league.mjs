import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url), wr=createRequire(require.resolve('wrangler'));
const {Miniflare}=wr('miniflare'),{build}=wr('esbuild');
const bundle=await build({stdin:{contents:"import {GET,POST} from './app/api/league/route.ts'; export default {fetch:r=>r.method==='GET'?GET(r):POST(r)}",resolveDir:process.cwd()},bundle:true,write:false,platform:'neutral',format:'esm',external:['cloudflare:workers'],tsconfig:'tsconfig.json'});
const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings:{ADMIN_CODE:'TESTX'}});
try{
 const db=await mf.getD1Database('DB');const sql=await readFile('drizzle/0000_equal_photon.sql','utf8');for(const part of sql.split('--> statement-breakpoint'))await db.prepare(part.trim()).run();
 async function call(body,cookie=''){const r=await mf.dispatchFetch('https://test.local/api/league',{method:body?'POST':'GET',headers:{'Content-Type':'application/json',cookie,'cf-connecting-ip':'127.0.0.1'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};}
 assert.equal((await call()).data.levels.length,6);
 assert.equal((await call({action:'create'})).status,401);
 assert.equal((await call({action:'login',code:'WRONGCODE00'})).status,401);
 const admin=(await call({action:'login',code:'testx'})).cookie;assert.ok(admin);
 let result=await call({action:'create',revision:0,name:'Pro',players:['A','B','C','D'],courts:['1','2','3','5'],dates:['2026-09-27','2026-09-27','2026-09-28','2026-09-28'],times:['10:00','10:00','12:00','12:00'],format:'super'},admin);assert.equal(result.status,200);let rev=result.data.revision;
 assert.equal(result.data.levels[0].matches[3].court,'5');assert.equal(result.data.levels[0].matches[0].date,'2026-09-27');
 const matches=result.data.levels[0].matches;const ids=matches.map(x=>x.id);assert.equal(ids.length,4);assert.ok(result.data.codes[ids[0]]);assert.equal(new Set(Object.values(result.data.codes)).size,4);for(const pin of Object.values(result.data.codes))assert.match(pin,/^[0-9]{5}$/);
 const player=(await call({action:'login',code:result.data.codes[ids[0]]})).cookie;
 assert.equal((await call(undefined,admin)).data.levels[0].matches[0].currentCode,result.data.codes[ids[0]]);
 for(const cookie of ['',player]){const read=(await call(undefined,cookie)).data;assert.ok(!JSON.stringify(read).includes('savedCode'));assert.ok(!JSON.stringify(read).includes('currentCode'));assert.ok(!JSON.stringify(read).includes(result.data.codes[ids[0]]));}
 assert.equal((await call({action:'add',matchId:ids[1],revision:rev,player:0},player)).status,403);
 assert.equal((await call({action:'add',matchId:ids[0],revision:999,player:0},player)).status,409);
 const publicRead=await call();assert.ok(!JSON.stringify(publicRead.data).includes('codeHash'));assert.ok(!JSON.stringify(publicRead.data).includes('history'));
 async function action(action,id,extra={},cookie=admin){const r=await call({action,matchId:id,revision:rev,...(action==='finish'?{finishedTime:'17:35'}:{}),...extra},cookie);assert.equal(r.status,200,JSON.stringify(r.data));rev=r.data.revision;return r.data;}
 // Starting is explicit, authorized, atomic and visible publicly at 0:0.
 assert.equal((await call({action:'start',matchId:ids[0],revision:rev})).status,401);
 assert.equal((await call({action:'start',matchId:ids[1],revision:rev},player)).status,403);
 assert.equal((await call({action:'start',matchId:ids[2],revision:rev},admin)).status,400);
 assert.equal((await call({action:'add',matchId:ids[0],revision:rev,player:0},player)).status,400);
 const starting=await Promise.all([call({action:'start',matchId:ids[0],revision:rev},player),call({action:'start',matchId:ids[0],revision:rev},player)]);
 assert.deepEqual(starting.map(r=>r.status).sort(),[200,409]);rev=starting.find(r=>r.status===200).data.revision;
 let publicStarted=(await call()).data.levels[0].matches[0];assert.equal(publicStarted.status,'live');assert.deepEqual(publicStarted.sets,[[0,0]]);assert.equal(publicStarted.winner,null);
 assert.equal((await call({action:'start',matchId:ids[0],revision:rev},player)).status,400);
 await action('undo',ids[0],{},player);assert.equal((await call()).data.levels[0].matches[0].status,'scheduled');
 await action('start',ids[0],{},player);
 for(const court of ['0','6','Kort 2','abc'])assert.equal((await call({action:'details',matchId:ids[0],revision:rev,players:['A','B'],court,date:'2026-09-27',time:'10:00'},admin)).status,400);
 assert.equal((await call({action:'details',matchId:ids[0],revision:rev,players:['A','B'],court:'1',date:'2026-02-30',time:'10:00'},admin)).status,400);
 for(const field of ['court','date','time'])for(const missing of ['',null,undefined]){const before=(await call()).data;assert.equal((await call({action:'details',matchId:ids[0],revision:rev,players:['A','B'],court:'1',date:'2026-09-27',time:'10:00',[field]:missing},admin)).status,400);assert.deepEqual((await call()).data.levels,before.levels);}
 await action('details',ids[0],{players:['A','B'],court:'4',date:'2027-01-10',time:'11:30'});
 assert.equal((await call()).data.levels[0].matches[0].court,'4');assert.equal((await call()).data.levels[0].matches[0].date,'2027-01-10');
 assert.equal((await call({action:'season',revision:rev,season:'2026/4'},admin)).status,400);
 assert.equal((await call({action:'season',revision:rev,season:'2026/2'},player)).status,403);
 await action('season',undefined,{season:'2026/2'});assert.equal((await call()).data.season,'2026/2');
 await action('season',undefined,{season:'2027/3'});assert.equal((await call()).data.season,'2027/3');
 await action('add',ids[0],{player:0},player);assert.equal((await call()).data.levels[0].matches[0].sets[0][0],1);
 await action('undo',ids[0],{},player);assert.equal((await call()).data.levels[0].matches[0].sets[0][0],0);assert.equal((await call()).data.levels[0].matches[0].status,'live');
 // A wins semifinal 6:0 6:0; promotion is atomic with result confirmation.
 for(let i=0;i<12;i++)await action('add',ids[0],{player:0},player);
 for(const finishedTime of ['',null,'25:00','17:66'])assert.equal((await call({action:'finish',matchId:ids[0],revision:rev,finishedTime},player)).status,400);
 let done=await action('finish',ids[0],{finishedTime:'16:42'},player);assert.equal(done.levels[0].matches[0].finishedTime,'16:42');assert.equal((await call()).data.levels[0].matches[0].finishedTime,'16:42');assert.equal(done.levels[0].matches[2].players[0],'A');
 await action('undo',ids[0],{},player);assert.equal((await call()).data.levels[0].matches[2].players[0],'');assert.equal((await call()).data.levels[0].matches[0].finishedTime,null);await action('finish',ids[0],{},player);
 assert.equal((await call({action:'start',matchId:ids[0],revision:rev},player)).status,400);
 // Second semi ends in a super tie-break, with a two-point lead requirement.
 await action('start',ids[1]);
 for(let i=0;i<6;i++)await action('add',ids[1],{player:0});for(let i=0;i<6;i++)await action('add',ids[1],{player:1});
 for(let i=0;i<9;i++){await action('add',ids[1],{player:0});await action('add',ids[1],{player:1});}
 await action('add',ids[1],{player:0});assert.equal((await call({action:'finish',matchId:ids[1],revision:rev},admin)).status,400);
 await action('add',ids[1],{player:0});done=await action('finish',ids[1]);assert.deepEqual(done.levels[0].matches[2].players,['A','C']);assert.deepEqual(done.levels[0].matches[3].players,['B','D']);
 await action('start',ids[3]);await action('add',ids[3],{player:1});assert.equal((await call({action:'undo',matchId:ids[1],revision:rev},admin)).status,400);await action('undo',ids[3]);
 await action('start',ids[2]);await action('add',ids[2],{player:0});assert.equal((await call({action:'undo',matchId:ids[0],revision:rev},admin)).status,400);
 const rotated=await action('rotate',ids[0]);assert.equal(rotated.levels[0].matches[0].currentCode,rotated.codes[ids[0]]);assert.equal((await call(undefined,admin)).data.levels[0].matches[0].currentCode,rotated.codes[ids[0]]);assert.match(rotated.codes[ids[0]],/^[0-9]{5}$/);assert.notEqual(rotated.codes[ids[0]],result.data.codes[ids[0]]);assert.equal((await call({action:'undo',matchId:ids[0],revision:rev},player)).status,401);
 // Parallel writes cannot overwrite one another.
 const concurrent=await Promise.all([0,1].map(player=>call({action:'add',matchId:ids[2],revision:rev,player},admin)));assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
 // Upgrade an already-created legacy code without changing scores or active sessions.
 const stored=await db.prepare('SELECT data,revision FROM boards WHERE id=?').bind('main').first();const legacyBoard=JSON.parse(stored.data);rev=stored.revision;
 const legacyMatch=legacyBoard.levels[0].matches[1];delete legacyMatch.codeFormat;delete legacyMatch.savedCode;legacyMatch.codeHash=createHash('sha256').update('LEGACYCODE1').digest('hex');
 await db.prepare('UPDATE boards SET data=? WHERE id=?').bind(JSON.stringify(legacyBoard),'main').run();
 const beforeUpgrade=JSON.stringify(legacyBoard.levels.map(l=>l.matches.map(m=>({sets:m.sets,players:m.players,status:m.status,winner:m.winner}))));
 const legacySession=(await call({action:'login',code:'LEGACYCODE1'})).cookie;assert.ok(legacySession);
 assert.equal((await call()).data.levels[0].matches[1].needsCodeUpgrade,true);assert.equal((await call(undefined,admin)).data.levels[0].matches[1].currentCode,undefined);
 assert.equal((await call({action:'upgrade_codes',revision:rev},legacySession)).status,403);
 const upgraded=await action('upgrade_codes');assert.equal(Object.keys(upgraded.codes).length,1);assert.match(upgraded.codes[legacyMatch.id],/^[0-9]{5}$/);
 assert.equal(JSON.stringify(upgraded.levels.map(l=>l.matches.map(m=>({sets:m.sets,players:m.players,status:m.status,winner:m.winner})))),beforeUpgrade);
 assert.equal((await call({action:'login',code:upgraded.codes[legacyMatch.id]})).data.scope,legacyMatch.id);
 assert.equal((await call({action:'login',code:'LEGACYCODE1'})).status,401);
 assert.equal((await call(undefined,legacySession)).data.scope,legacyMatch.id);
 assert.equal((await call()).data.levels[0].matches[1].needsCodeUpgrade,false);
 const currentHashes=JSON.parse((await db.prepare('SELECT data FROM boards WHERE id=?').bind('main').first()).data).levels.flatMap(l=>l.matches.map(m=>m.codeHash).filter(Boolean));assert.equal(new Set(currentHashes).size,currentHashes.length);
 const unchanged=await action('upgrade_codes');assert.deepEqual(unchanged.codes,{});
 // Organizer configures two distinct dates; existing scores and schedules stay intact.
 const datesBefore=(await call(undefined,admin)).data.levels;
 assert.equal((await call({action:'season',revision:rev,season:'2027/3',finalsDates:['2026-09-26','2026-09-27']},legacySession)).status,403);
 for(const finalsDates of [[],['2026-09-26'],['2026-09-26','2026-09-26'],['2026-02-30','2026-09-27'],['','2026-09-27']])assert.equal((await call({action:'season',revision:rev,season:'2027/3',finalsDates},admin)).status,400);
 const configured=await action('season',undefined,{season:'2027/3',finalsDates:['2026-09-27','2026-09-26']});
 assert.deepEqual(configured.finalsDates,['2026-09-26','2026-09-27']);assert.deepEqual(configured.levels,datesBefore);assert.deepEqual((await call()).data.finalsDates,configured.finalsDates);
 const newPairs={name:'Zaawansowana',players:['E','F','G','H'],courts:['1','2','1','2'],times:['15:00','15:00','17:00','17:00'],format:'super'};
 assert.equal((await call({action:'create',revision:rev,...newPairs,dates:['2026-09-28','2026-09-26','2026-09-27','2026-09-27']},admin)).status,400);
 for(const field of ['courts','dates','times'])for(let index=0;index<4;index++){const incomplete={...newPairs,dates:['2026-09-26','2026-09-26','2026-09-27','2026-09-27']};incomplete[field]=[...incomplete[field]];incomplete[field][index]='';assert.equal((await call({action:'create',revision:rev,...incomplete},admin)).status,400);assert.equal((await call()).data.revision,rev);}
 const scheduled=await action('create',undefined,{...newPairs,dates:['2026-09-26','2026-09-26','2026-09-27','2026-09-27']});
 assert.deepEqual(scheduled.levels.find(l=>l.name==='Zaawansowana').matches.map(m=>m.date),['2026-09-26','2026-09-26','2026-09-27','2026-09-27']);
 // Organizer can correct schedules and semifinal names after later rounds start or finish.
 const protectedState=async()=>JSON.parse((await db.prepare('SELECT data FROM boards WHERE id=?').bind('main').first()).data).levels[0].matches.map(({players,court,date,time,updated,...rest})=>rest);
 let beforeDetails=await protectedState();
 await action('details',ids[0],{players:['A corrected','B corrected'],court:'5',date:'2026-09-26',time:'14:30'});
 assert.deepEqual(await protectedState(),beforeDetails);
 let corrected=(await call()).data.levels[0].matches;
 assert.equal(corrected[2].players[0],'A corrected');assert.equal(corrected[3].players[0],'B corrected');
 await action('details',ids[2],{court:'4',date:'2026-09-26',time:'18:00'});
 assert.deepEqual(await protectedState(),beforeDetails);
 for(const index of [2,3]){
  while((await call()).data.levels[0].matches[index].sets.filter(s=>s[0]>=6&&s[0]-s[1]>=2).length<2)await action('add',ids[index],{player:0});
  await action('finish',ids[index],{finishedTime:'20:15'});
 }
 beforeDetails=await protectedState();
 for(let index=0;index<4;index++)await action('details',ids[index],{players:index===0?['A renamed','B renamed']:['C renamed','D renamed'],court:String(index+1),date:'2026-09-27',time:'19:00'});
 assert.deepEqual(await protectedState(),beforeDetails);
 corrected=(await call()).data.levels[0].matches;
 assert.deepEqual(corrected[2].players,['A renamed','C renamed']);assert.deepEqual(corrected[3].players,['B renamed','D renamed']);
 assert.ok(corrected.every((m,i)=>m.court===String(i+1)&&m.time==='19:00'&&m.date==='2026-09-27'));
 assert.equal((await call({action:'details',matchId:ids[1],revision:rev,players:['Wrong','Names'],court:'1',date:'2026-09-26',time:'10:00'},legacySession)).status,403);
 assert.equal((await call({action:'undo',matchId:ids[0],revision:rev},admin)).status,400);
 assert.equal((await call({action:'details',matchId:ids[0],revision:rev,players:['A renamed','B renamed'],court:'6',date:'2026-09-27',time:'19:00'},admin)).status,400);
 assert.deepEqual(await protectedState(),beforeDetails);
 // Atomic season rollover preserves the full previous board and invalidates old editors.
 const previousBoard=JSON.parse((await db.prepare('SELECT data FROM boards WHERE id=?').bind('main').first()).data);
 const oldPin=previousBoard.levels[0].matches[1].savedCode;
 const nextSeason={action:'new_season',revision:rev,season:'2028/1',finalsDates:['2028-04-15','2028-04-16']};
 assert.equal((await call(nextSeason,legacySession)).status,403);
 for(const invalid of [{season:'2027/3'},{season:'2026/1'},{season:'2028/4'},{finalsDates:['2028-04-15','2028-04-15']},{finalsDates:['','2028-04-16']}])assert.equal((await call({...nextSeason,...invalid},admin)).status,400);
 assert.equal((await call()).data.archives.length,0);
 const rollover=await Promise.all([call(nextSeason,admin),call(nextSeason,admin)]);
 assert.deepEqual(rollover.map(r=>r.status).sort(),[200,409]);
 const next=rollover.find(r=>r.status===200).data;rev=next.revision;
 assert.equal(next.archives.length,1);assert.equal(next.season,'2028/1');assert.equal(next.levels.length,6);
 assert.ok(next.levels.flatMap(l=>l.matches).every(m=>m.status==='scheduled'&&m.players.every(p=>p==='')&&m.sets[0][0]===0&&m.sets[0][1]===0&&!m.currentCode));
 assert.ok(next.levels.flatMap(l=>l.matches).every(m=>!previousBoard.levels.flatMap(l=>l.matches).some(old=>old.id===m.id)));
 const archiveId=next.archives[0].id;
 const storedArchive=JSON.parse((await db.prepare('SELECT data FROM boards WHERE id=?').bind(archiveId).first()).data);delete storedArchive.archivedAt;assert.deepEqual(storedArchive,previousBoard);
 const getArchive=async(cookie='')=>{const r=await mf.dispatchFetch('https://test.local/api/league?archive='+encodeURIComponent(archiveId),{headers:{cookie}});return r.json();};
 for(const cookie of ['',admin]){const archive=await getArchive(cookie);assert.equal(archive.season,'2027/3');assert.equal(archive.scope,null);assert.deepEqual(archive.levels[0].matches[2].sets,previousBoard.levels[0].matches[2].sets);for(const secret of ['codeHash','savedCode','currentCode','history',oldPin])assert.ok(!JSON.stringify(archive).includes(secret));}
 assert.equal((await call(undefined,admin)).data.scope,'admin');assert.equal((await call(undefined,legacySession)).data.scope,null);
 assert.equal((await call({action:'login',code:oldPin})).status,401);
 assert.equal((await call({action:'details',matchId:ids[0],revision:rev,players:['Wrong','Change'],court:'1',date:'2028-04-15',time:'10:00'},admin)).status,404);
 assert.equal((await mf.dispatchFetch('https://test.local/api/league?archive=main')).status,404);
 assert.equal((await call({action:'season',revision:rev,season:'2027/3'},admin)).status,400);
 const newEdition=await action('create',undefined,{name:'Pro',players:['New A','New B','New C','New D'],courts:['1','2','3','4'],dates:['2028-04-15','2028-04-15','2028-04-16','2028-04-16'],times:['10:00','10:00','12:00','12:00'],format:'super'});
 const previousCodes=new Set(previousBoard.levels.flatMap(l=>l.matches).map(m=>m.savedCode).filter(Boolean));
 for(const code of Object.values(newEdition.codes)){assert.match(code,/^[0-9]{5}$/);assert.ok(!previousCodes.has(code));}
 const currentSession=(await call({action:'login',code:Object.values(newEdition.codes)[0]})).cookie;assert.ok(currentSession);
 await action('start',newEdition.levels[0].matches[0].id,{},currentSession);
 await action('add',newEdition.levels[0].matches[0].id,{player:0},currentSession);
 assert.deepEqual((await getArchive()).levels[0].matches[0].sets,previousBoard.levels[0].matches[0].sets);
 // Further seasons retain every archive and the public default remains current.
 await action('new_season',undefined,{season:'2028/2',finalsDates:['2028-08-26','2028-08-27']});
 const latest=(await call()).data;assert.equal(latest.season,'2028/2');assert.deepEqual(latest.archives.map(a=>a.season),['2028/1','2027/3']);
 console.log('PASS: atomic concurrent rollover, complete archives, read-only public archive, current-season default, old code/session invalidation, fresh unique codes, permissions and multi-season persistence.');
 console.log('PASS: organizer edits before/during/after matches, name propagation, score/history/code preservation, permissions, schedule validation, finishing time, PINs, conflict protection and scoring.');
}finally{await mf.dispose()}
