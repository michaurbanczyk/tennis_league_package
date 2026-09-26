import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const root=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!existsSync(path.join(root,'.league-source.json')))throw Error('Najpierw przygotuj wybraną ligę.');
const tests=['tests/referee.cjs','tests/schedule-backups.cjs','tests/reset-league.cjs','tests/level-management.cjs','tests/live-expiry.cjs','tests/horizontal-bracket.cjs','tests/live-courts.mjs','tests/league.mjs'];
for(const test of tests){
 if(!existsSync(path.join(root,test))){if(test==='tests/league.mjs')continue;throw Error('Brak testu: '+test);}
 console.log('\n'+test);
 const result=spawnSync(process.execPath,[test],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
}
