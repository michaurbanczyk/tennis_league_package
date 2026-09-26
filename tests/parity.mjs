import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {root,configFor} from '../scripts/league.mjs';
import support from './support.cjs';
const originals={smartliga:process.argv[2],relaksmisja:process.argv[3]};
if(!originals.smartliga||!originals.relaksmisja)throw Error('Podaj katalogi obu wersji sprzed migracji.');
for(const id of ['smartliga','relaksmisja']){
 const before=path.resolve(originals[id]),after=path.join(root,'.generated',id),old=support.loader(before),next=support.loader(after);
 const React=next.requireAt('react'),{renderToStaticMarkup}=next.requireAt('react-dom/server'),tOld=old.load('lib/tennis.ts'),tNew=next.load('lib/tennis.ts'),theme=configFor(id).theme;
 for(const file of ['app/globals.css','app/league-theme.css','app/page.tsx','components/tennis/tv-view.tsx','components/tennis/match-search.tsx','db/schema.ts','drizzle/0000_equal_photon.sql','db/raw.ts'])assert.equal(readFileSync(path.join(after,file),'utf8'),readFileSync(path.join(before,file),'utf8'),id+' '+file);
 function compareComponent(file,component,props){
  const a=renderToStaticMarkup(React.createElement(old.load(file)[component],props));
  const b=renderToStaticMarkup(React.createElement(next.load(file)[component],props));
  assert.equal(b,a,id+' rendered '+component);
 }
 compareComponent('app/page.tsx','default',{});
 compareComponent('components/tennis/backup-panel.tsx','BackupPanel',{revision:1,disabled:false,onRestore:async()=>true});
 for(const size of [4,8,16]){
  const a=tOld.makeLevel('Test',size),b=tNew.makeLevel('Test',size);assert.deepEqual(b,a);
  const board={theme,season:theme==='smart'?'2026/1':'Lato 2026',finalsDates:['2026-09-26'],levels:[a]};
  for(const [i,m] of a.matches.entries()){m.players=['Gracz '+i+' A','Gracz '+i+' B'];m.court=String(i%configFor(id).courtCount+1);m.date='2026-09-26';m.time=String(i+6).padStart(2,'0')+':00';}
  compareComponent('components/tennis/bracket-setup.tsx','BracketSetup',{board,names:['Test'],name:'Test',onName:()=>{},size,onSize:()=>{},format:'super',onFormat:()=>{},busy:false,revision:1,onManage:async()=>{},onSubmit:()=>{}});
  compareComponent('components/tennis/horizontal-bracket.tsx','HorizontalBracket',{level:a});
  for(const status of ['scheduled','live','finished','unfinished']){
   a.matches[0].status=status;a.matches[0].sets=[[6,4],[3,2]];a.matches[0].refereeEnabled=true;a.matches[0].points=[3,3];a.matches[0].winner=status==='finished'?0:null;
   assert.deepEqual(tNew.courtSchedule(board),tOld.courtSchedule(board));assert.deepEqual(tNew.liveCourts(board,'2026-09-26'),tOld.liveCourts(board,'2026-09-26'));
   compareComponent('components/tennis/tv-view.tsx','TvView',{board,today:'2026-09-26',online:true,lastSync:null,isDemo:false,onExit:()=>{}});
  }
 }
 for(const input of ['','1','5','6','9','10','Kort 1','kort 5','Kort nr 1 FAME','Kort nr 3 FLEX',' 1 ']){assert.equal(tNew.courtNumber(input),tOld.courtNumber(input));assert.equal(tNew.courtLabel(input),tOld.courtLabel(input));}
 for(const mode of ['classic','super']){
  const a=tOld.makeLevel('Test').matches[0],b=structuredClone(a);a.players=b.players=['A','B'];a.refereeEnabled=b.refereeEnabled=true;
  tOld.startMatch(a,1000000);tNew.startMatch(b,1000000);
  for(let i=0;i<60;i++){const player=i%7===0?1:0;tOld.addPoint(a,player,mode);tNew.addPoint(b,player,mode);assert.deepEqual(b,a);if(i%13===0){tOld.undoScore(a);tNew.undoScore(b);assert.deepEqual(b,a);}}
 }
 console.log('PASS '+id+': byte-identical main view, styles, TV, search, schema and DB adapter; identical rendered Home/backup/bracket/TV; same 4/8/16 draws, court parsing, schedule, scoring and undo.');
}
