import assert from 'node:assert/strict';
import path from 'node:path';
import {materialize,root} from '../scripts/league.mjs';
import support from './support.cjs';
const rtlDir=materialize('relaksmisja',path.join(root,'.generated/relaksmisja'));
const smartDir=materialize('smartliga',path.join(root,'.generated/smartliga'));
const rtl=support.app(rtlDir,'RTLADMIN'),smart=support.app(smartDir,'SMARTADMIN');
const oldError=console.error;console.error=()=>{};
const ok=async req=>{const r=await req;assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
const dates=Array.from({length:11},(_,i)=>`2026-10-${String(i+1).padStart(2,'0')}`);
try{
 await ok(rtl.post('login',{code:'RTLADMIN'}));
 await ok(rtl.post('season',{season:'Rozstawienie',finalsDates:dates.slice(0,10)}));
 let before=rtl.stored();assert.equal((await rtl.post('season',{season:'Rozstawienie',finalsDates:dates})).status,400);assert.equal(rtl.stored(),before);
 assert.equal((await rtl.post('new_season',{season:'Nowy',finalsDates:dates})).status,400);assert.equal(rtl.stored(),before);
 const tennis=rtl.load('lib/tennis.ts'),levelId=rtl.board().levels[0].id;
 for(const size of [8,16]){const sample=tennis.makeLevel('Pro',size);tennis.entryMatches(sample).forEach((m,i)=>{m.players=[`Jan A${i}`,`Piotr B${i}`];m.seeds=[i*2+1,i*2+2];});for(const round of tennis.bracketRounds(sample).filter(r=>r.size>2)){round.matches.forEach(m=>{m.status='finished';m.winner=0;});tennis.propagatePlayers(sample);}assert.equal(sample.matches.find(m=>m.roundSize===2).seeds[0],1);}

 for(const size of [2,4,8,16]){const b=await ok(rtl.post('create_bracket',{levelId,startSize:size}));assert.equal(tennis.seedLimit(b.levels[0]),size);}
 let b=await ok(rtl.post('create_bracket',{levelId,startSize:4}));const [m0,m1,final,bronze]=b.levels[0].matches;
 const details=(m,players,seeds,session)=>rtl.post('details',{matchId:m.id,players,court:'1',date:dates[0],time:m.id===m0.id?'10:00':'12:00',...(seeds===undefined?{}:{seeds})},session);
 await ok(details(m0,['Jan Kowalski','Piotr Nowak'],[1,null]));
 assert.deepEqual(rtl.board().levels[0].matches[0].seeds,[1,null]);assert.equal(tennis.seededPlayerName(rtl.board().levels[0].matches[0],0),'Jan Kowalski [1]');
 assert.equal(tennis.seededPlayerName(rtl.board().levels[0].matches[0],1),'Piotr Nowak');
 const pub=await ok(rtl.get('', ''));assert.deepEqual(pub.levels[0].matches[0].seeds,[1,null]);
 assert.equal(tennis.playerPlaceholder(pub.levels[0],pub.levels[0].matches[2],0),'Kowalski [1]/Nowak');
 before=rtl.stored();
 for(const seeds of [[0,null],[5,null],[1.5,null],['1',null],[1,1],[1],null]){assert.equal((await details(m0,['Jan Kowalski','Piotr Nowak'],seeds)).status,400);assert.equal(rtl.stored(),before);}
 assert.equal((await details(m1,['Adam Lis','Marek Kot'],[1,2])).status,400);assert.equal(rtl.stored(),before);
 assert.equal((await details(final,['','',''],[2,3])).status,400);assert.equal(rtl.stored(),before);
 assert.equal((await details(m0,['Jan Kowalski','Piotr Nowak'],[2,3],'')).status,401);assert.equal(rtl.stored(),before);
 await ok(details(m1,['Adam Lis','Marek Kot'],[2,3]));
 await ok(details(m0,['Jan Kowalski','Piotr Nowak'],undefined));assert.deepEqual(rtl.board().levels[0].matches[0].seeds,[1,null]);
 await ok(rtl.post('start',{matchId:m0.id}));let scoring=rtl.board();scoring.levels[0].matches[0].sets=[[6,0],[6,0]];rtl.db.prepare("UPDATE boards SET data=? WHERE id='main'").run(JSON.stringify(scoring));
 await ok(rtl.post('finish',{matchId:m0.id,finishedTime:'11:00'}));let l=rtl.board().levels[0];assert.deepEqual(l.matches[2].seeds,[1,null]);assert.equal(l.matches[2].players[0],'Jan Kowalski');assert.equal(l.matches[3].players[0],'Piotr Nowak');assert.equal(l.matches[3].seeds,undefined);
 await ok(details(m0,['Jan Kowalski','Piotr Nowak'],[4,1]));l=rtl.board().levels[0];assert.deepEqual(l.matches[2].seeds,[4,null]);assert.deepEqual(l.matches[3].seeds,[1,null]);
 const loader=support.loader(rtlDir),React=loader.requireAt('react'),render=loader.requireAt('react-dom/server').renderToStaticMarkup;
 const Bracket=loader.load('components/tennis/horizontal-bracket.tsx').HorizontalBracket;
 const html=render(React.createElement(Bracket,{level:l}));assert(html.includes('Jan Kowalski [4]'));assert(html.includes('Piotr Nowak [1]'));
 let backup=await ok(rtl.get('backup=download'));assert.equal(backup.version,3);
 await ok(rtl.post('restore_backup',{backup,confirm:true}));assert.deepEqual(rtl.board().levels[0].matches[2].seeds,[4,null]);
 const malformed=structuredClone(backup);malformed.records[0].data.levels[0].matches[1].seeds=[4,3];assert.equal((await rtl.post('restore_backup',{backup:malformed,confirm:true})).status,400);
 await ok(rtl.post('undo',{matchId:m0.id}));l=rtl.board().levels[0];assert.deepEqual(l.matches[2].players,['','']);assert.equal(l.matches[2].seeds,undefined);assert.equal(l.matches[3].seeds,undefined);
 await ok(details(m0,['Jan Kowalski','Piotr Nowak'],[null,null]));assert.equal(rtl.board().levels[0].matches[0].seeds,undefined);
 backup=await ok(rtl.get('backup=download'));const backups=rtl.load('lib/backups.ts');for(const version of [1,2])assert.equal(backups.validateBackup({...backup,version}).version,version);
 // Historical backups can retain >10 days; new configuration cannot create them.
 const legacy=structuredClone(backup);legacy.records[0].data.finalsDates=dates;assert.equal(backups.validateBackup({...legacy,version:2}).records[0].data.finalsDates.length,11);
 await ok(details(m0,['Jan Kowalski','Piotr Nowak'],[1,null]));
 await ok(rtl.post('new_season',{season:'Nowe finały',finalsDates:dates.slice(0,2)}));const current=await ok(rtl.get());const archived=await ok(rtl.get('archive='+current.archives[0].id,''));assert.deepEqual(archived.levels[0].matches[0].seeds,[1,null]);
 await ok(smart.post('login',{code:'SMARTADMIN'}));const smartTennis=smart.load('lib/tennis.ts'),smartMatch=(await ok(smart.get())).levels[0].matches[0];
 assert.equal((await smart.post('details',{matchId:smartMatch.id,players:['Jan Kowalski','Piotr Nowak'],seeds:[1,null],court:'1',date:dates[0],time:'10:00'})).status,400);
 assert.equal(smartTennis.seededPlayerName({players:['Jan Kowalski',''],seeds:[1,null]},0),'Jan Kowalski');assert.equal((await ok(smart.get('backup=download'))).version,1);
 console.log('PASS: optional seeds, limits 2/4/8/16, unique per level, permissions, public names and bracket, winner/loser propagation, seed correction/removal, undo, archive and v3 backup roundtrip, legacy v1/v2 backups, maximum 10 new finals dates, SmartLiga unchanged.');
}finally{console.error=oldError;rtl.db.close();smart.db.close();}
