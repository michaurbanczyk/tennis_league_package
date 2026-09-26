import assert from 'node:assert/strict';
import path from 'node:path';
import {materialize,root} from '../scripts/league.mjs';
import support from './support.cjs';
const {app}=support;
const cases=['smartliga','relaksmisja'].map(id=>({id,a:app(materialize(id,path.join(root,'.generated',id)),id.toUpperCase()+'ADMIN')}));
const originalError=console.error;console.error=()=>{};
const ok=async request=>{const r=await request;assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
const rows=a=>a.db.prepare('SELECT * FROM boards ORDER BY id').all();
try{
 for(const {id,a} of cases){
  const secret=id.toUpperCase()+'ADMIN';await ok(a.post('login',{code:secret}));
  const dates=['2026-09-26','2026-09-27',...(id==='relaksmisja'?['2026-10-03','2026-10-04']:[])];
  await ok(a.post('season',{season:id==='smartliga'?'2026/1':'Lato 2026',finalsDates:dates}));
  await ok(a.post('new_season',{season:id==='smartliga'?'2026/2':'Jesień 2026',finalsDates:dates}));
  await ok(a.post('new_season',{season:id==='smartliga'?'2026/3':'Zima 2026',finalsDates:dates}));
 }
 for(const {id,a} of cases){
  const secret=id.toUpperCase()+'ADMIN',admin=a.cookie(),other=cases.find(c=>c.a!==a).a;
  const state=await ok(a.get()),archiveId=state.archives[0].id,remainingId=state.archives[1].id;
  const before=rows(a),otherBefore=rows(other),mainBefore=a.stored();
  const args={archiveId,adminPassword:secret,confirm:true};
  assert.equal((await a.post('delete_archive',args,'')).status,401);
  assert.equal((await a.post('delete_archive',args,other.cookie())).status,401);
  // A valid current player session still has no organizer authority.
  const board=a.board();board.levels[0].matches[0].codeHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('12345')))).map(n=>n.toString(16).padStart(2,'0')).join('');
  a.db.prepare("UPDATE boards SET data=? WHERE id='main'").run(JSON.stringify(board));
  await ok(a.post('login',{code:'12345'}));const player=a.cookie();
  assert.equal((await a.post('delete_archive',args,player)).status,403);
  a.db.prepare("UPDATE boards SET data=? WHERE id='main'").run(mainBefore);
  assert.equal((await a.post('delete_archive',{...args,confirm:false},admin)).status,400);
  assert.equal((await a.post('delete_archive',{...args,adminPassword:'WRONG'},admin)).status,401);
  for(const target of ['main','backup:before-restore',"archive:' OR 1=1 --",'archive:'+crypto.randomUUID()])assert.equal((await a.post('delete_archive',{...args,archiveId:target},admin)).status,404);
  assert.equal((await a.post('delete_archive',{...args,revision:state.revision-1},admin)).status,409);
  assert.deepEqual(rows(a),before);
  const backup=await ok(a.get('backup=download',admin));
  // A failed deletion rolls back the revision update as well.
  a.db.exec("CREATE TRIGGER reject_archive_delete BEFORE DELETE ON boards WHEN old.id LIKE 'archive:%' BEGIN SELECT RAISE(ABORT,'test rollback'); END");
  assert.equal((await a.post('delete_archive',args,admin)).status,400);assert.deepEqual(rows(a),before);
  a.db.exec('DROP TRIGGER reject_archive_delete');
  const deleted=await ok(a.post('delete_archive',args,admin));
  assert.equal(deleted.revision,state.revision+1);
  assert.deepEqual(deleted.archives.map(x=>x.id),[remainingId]);
  assert.equal((await a.get('archive='+archiveId)).status,404);
  assert.equal((await a.get('archive='+remainingId)).status,200);
  assert.equal(a.stored(),mainBefore);
  assert.deepEqual(rows(a).filter(x=>x.id!== 'main'),before.filter(x=>x.id!== 'main'&&x.id!==archiveId));
  assert.equal((await a.post('delete_archive',args,admin)).status,404);
  assert.deepEqual(rows(other),otherBefore);
  await ok(a.post('restore_backup',{backup,confirm:true},admin));
  assert.equal((await a.get('archive='+archiveId)).status,200);
  const {restoreToken,...restored}=a.board();assert.deepEqual(restored,JSON.parse(mainBefore));
  // Password re-confirmation attempts are bounded independently per league.
  for(let n=0;n<7;n++)assert.equal((await a.post('delete_archive',{...args,adminPassword:'WRONG'},admin)).status,401);
  assert.equal((await a.post('delete_archive',{...args,adminPassword:'WRONG'},admin)).status,429);
  assert.equal((await a.get('archive='+archiveId)).status,200);
  console.log('PASS '+id+': selected archive deletion, admin/password/confirmation, invalid IDs, stale revisions, transaction rollback, current board and other archives unchanged, other league isolated, backup recovery, rate limit.');
 }
}finally{console.error=originalError;for(const {a} of cases)a.db.close();}
