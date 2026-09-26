import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {materialize,configFor,sourceFiles,root} from '../scripts/league.mjs';
import support from './support.cjs';
const {app,loader}=support;
const oldLog=console.error;console.error=()=>{};
async function ok(request){const r=await request;assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
try{
 const dirs=Object.fromEntries(['smartliga','relaksmisja'].map(id=>[id,materialize(id,path.join(root,'.generated',id))]));
 const s=app(dirs.smartliga,'SMART-ADMIN'.replaceAll('-','')),r=app(dirs.relaksmisja,'RTLADMIN');
 assert.notEqual(configFor('smartliga').projectId,configFor('relaksmisja').projectId);
 assert.equal((await ok(s.get())).levels.length,6);assert.equal((await ok(r.get())).levels.length,15);
 assert.equal((await s.post('login',{code:'RTLADMIN'})).status,401);assert.equal((await r.post('login',{code:'SMARTADMIN'})).status,401);
 const sl=await s.post('login',{code:'SMARTADMIN'}),rl=await r.post('login',{code:'RTLADMIN'});assert.equal(sl.status,200);assert.equal(rl.status,200);assert(!/Domain=/i.test(sl.setCookie));assert(!/Domain=/i.test(rl.setCookie));
 assert.equal((await ok(r.get('',s.cookie()))).scope,null);assert.equal((await ok(s.get('',r.cookie()))).scope,null);
 const dates=['2026-09-26','2026-09-27','2026-10-03','2026-10-04'];
 await ok(s.post('season',{season:'2026/1',finalsDates:dates.slice(0,2)}));await ok(r.post('season',{season:'Lato 2026',finalsDates:dates}));
 let smartBefore=s.stored();await ok(r.post('season',{season:'Jesień 2026',finalsDates:dates}));assert.equal(s.stored(),smartBefore);
 assert.equal((await s.post('season',{season:'Dowolna nazwa',finalsDates:dates.slice(0,2)})).status,400);
 assert.equal((await r.post('season',{season:'Jesień 2026',finalsDates:dates.slice(0,2)})).status,200);
 for(const [id,a] of [['smartliga',s],['relaksmisja',r]]){
  const leagueBefore=(a===s?r:s).stored();
  const board=await ok(a.get()),name=board.levels[0].name;
  const created=await ok(a.post('create',{name,startSize:16,format:'super',players:Array.from({length:16},(_,i)=>'Gracz '+(i+1)),courts:Array(16).fill('1'),dates:Array(16).fill(dates[0]),times:Array.from({length:16},(_,i)=>String(i+6).padStart(2,'0')+':00'),referees:Array(16).fill(true)}));
  const m=created.levels[0].matches[0];assert(m.refereeCurrentCode);const admin=a.cookie();
  await ok(a.post('login',{code:m.refereeCurrentCode,role:'referee'}));const referee=a.cookie();
  assert.equal((await ok((a===s?r:s).get('',referee))).scope,null);
  await ok(a.post('start',{matchId:m.id},referee));await ok(a.post('point',{matchId:m.id,player:0},referee));
  const before=a.stored();assert.equal((await a.post('details',{matchId:m.id,players:m.players,court:'1',date:dates[0],time:'07:00'},admin)).status,400);assert.equal(a.stored(),before);
  await ok(a.post('details',{matchId:m.id,players:m.players,court:id==='smartliga'?'5':'9',date:dates[0],time:'22:00'},admin));
  const level=()=>a.board().levels[0];
  // Complete the entire 16-player bracket, including the bronze match.
  for(const match of [...level().matches]){
   if(level().matches.find(x=>x.id===match.id).status==='scheduled')await ok(a.post('start',{matchId:match.id},admin));
   // Seed only the test DB's completed score; the real API controls finishing,
   // permissions and propagation into every following round.
   const current=a.board(),target=current.levels[0].matches.find(x=>x.id===match.id);target.sets=[[6,0],[6,0]];target.points=[0,0];
   a.db.prepare("UPDATE boards SET data=? WHERE id='main'").run(JSON.stringify(current));
   await ok(a.post('finish',{matchId:match.id,finishedTime:'23:00'},admin));
  }
  assert(level().matches.every(x=>x.status==='finished'&&x.winner===0));
  assert(level().matches.find(x=>x.stage==='Finał').players.every(Boolean));assert(level().matches.find(x=>x.stage==='O 3. miejsce').players.every(Boolean));
  const backup=await ok(a.get('backup=download',admin)),exactBefore=a.board();await ok(a.post('restore_backup',{backup,confirm:true},admin));
  assert.deepEqual(a.board().levels,exactBefore.levels);
  const other=a===s?r:s,otherBefore=other.stored();assert.equal((await other.post('restore_backup',{backup,confirm:true},other===s?sl.setCookie.split(';')[0]:rl.setCookie.split(';')[0])).status,400);assert.equal(other.stored(),otherBefore);assert.equal(other.stored(),leagueBefore);
 }
 const temp=mkdtempSync(path.join(tmpdir(),'league-export-'));
 try{materialize('smartliga',temp);assert.throws(()=>materialize('relaksmisja',temp),/innej ligi/);}finally{rmSync(temp,{recursive:true,force:true});}
 for(const id of ['smartliga','relaksmisja']){
  const files=sourceFiles(id),config=configFor(id);assert.equal(JSON.parse(readFileSync(files.get('.openai/hosting.json'))).project_id,config.projectId);
  assert(files.get('lib/tennis.ts').includes('/shared/'));assert(files.get('app/api/league/route.ts').includes('/shared/'));
  assert(files.get('components/tennis/tv-view.tsx').includes('/'+id+'/modules/'));
  const t=loader(dirs[id]).load('lib/tennis.ts');assert.equal(t.liveCourts(t.initialBoard(config.theme),'2026-09-26').length,config.courtCount);
 }
 console.log('PASS: separate projects, host-only sessions, separate admin credentials, isolated mutations, 16-player playoffs and bronze in both leagues, scoring, edits, court conflicts, own backups, cross-league restore rejection and wrong-target export protection.');
}finally{console.error=oldLog;}
