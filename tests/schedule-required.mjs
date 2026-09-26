import assert from 'node:assert/strict';
import path from 'node:path';
import {materialize,root} from '../scripts/league.mjs';
import support from './support.cjs';
const rtl=support.app(materialize('relaksmisja',path.join(root,'.generated/relaksmisja')),'RTLADMIN');
const smart=support.app(materialize('smartliga',path.join(root,'.generated/smartliga')),'SMARTADMIN');
const ok=async p=>{const r=await p;assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
const oldError=console.error;console.error=()=>{};
try{
 await ok(rtl.post('login',{code:'RTLADMIN'}));const admin=rtl.cookie();
 await ok(rtl.post('season',{season:'Terminy',finalsDates:['2026-10-01']}));
 let b=await ok(rtl.post('create_bracket',{levelId:rtl.board().levels[0].id,startSize:2}));
 const matchId=b.levels[0].matches[0].id;
 const full={matchId,players:['Jan Kowalski','Piotr Nowak'],date:'2026-10-01',time:'10:00',court:'1'};
 const details=extra=>rtl.post('details',{...full,...extra},admin);
 await ok(details({court:''}));
 await ok(rtl.post('login',{code:rtl.board().levels[0].matches[0].savedCode}));const player=rtl.cookie();
 await ok(rtl.post('referee',{matchId,enabled:true},admin));
 await ok(rtl.post('login',{code:rtl.board().levels[0].matches[0].refereeSavedCode,role:'referee'}));const referee=rtl.cookie();
 const {MATCH_SCHEDULE_REQUIRED,hasMatchSchedule}=rtl.load('lib/tennis.ts');
 for(const missing of ['date','time','court']){
  await ok(details({[missing]:''}));
  const before=rtl.stored(),revision=rtl.db.prepare("SELECT revision FROM boards WHERE id='main'").get().revision;
  for(const session of [admin,player,referee])for(const action of ['start','add','point','finish','undo']){
   const r=await rtl.post(action,{matchId,player:0,finishedTime:'11:00'},session);
   assert.equal(r.status,400);assert.equal(r.data.error,MATCH_SCHEDULE_REQUIRED);
   assert.equal(rtl.stored(),before);assert.equal(rtl.db.prepare("SELECT revision FROM boards WHERE id='main'").get().revision,revision);
  }
 }
 await ok(details({}));
 await ok(rtl.post('start',{matchId},referee));await ok(rtl.post('point',{matchId,player:0},referee));
 assert.deepEqual(rtl.board().levels[0].matches[0].points,[1,0]);
 await ok(details({court:''}));const liveBefore=rtl.stored();
 assert.equal((await rtl.post('point',{matchId,player:0},referee)).data.error,MATCH_SCHEDULE_REQUIRED);
 assert.equal(rtl.stored(),liveBefore);
 await ok(details({}));await ok(rtl.post('undo',{matchId},referee));
 await ok(rtl.post('referee',{matchId,enabled:false},admin));
 await ok(rtl.post('add',{matchId,player:0},player));await ok(rtl.post('add',{matchId,player:1},admin));
 assert.deepEqual(rtl.board().levels[0].matches[0].sets[0],[1,1]);
 b=rtl.board();assert.equal(hasMatchSchedule({...b.levels[0].matches[0],court:'999'},b),false);
 // Existing SmartLiga scoring rules stay independent of the RTL requirement.
 await ok(smart.post('login',{code:'SMARTADMIN'}));
 const legacy=await ok(smart.get()),m=legacy.levels[0].matches[0];
 Object.assign(m,{players:['Jan Kowalski','Piotr Nowak'],date:'',time:'',court:'',status:'scheduled',sets:[[0,0]],history:[]});
 smart.db.prepare("INSERT INTO boards(id,data,revision) VALUES ('main',?,1)").run(JSON.stringify(legacy));
 await ok(smart.post('start',{matchId:m.id}));
 console.log('PASS: date/time/court required for all RTL scoring actions and roles; rejected writes preserve scores, history and revision; organizer can complete schedule; referee/player/admin scoring resumes; existing live scores preserved; SmartLiga unchanged.');
}finally{console.error=oldError;rtl.db.close();smart.db.close();}
