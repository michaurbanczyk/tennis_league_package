import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync,copyFileSync,chmodSync,statSync,rmSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const leagueIds=['smartliga','relaksmisja'];
export function configFor(id){
 if(!leagueIds.includes(id))throw Error('Wybierz ligę: smartliga lub relaksmisja. Nie ma ligi domyślnej.');
 const config=JSON.parse(readFileSync(path.join(root,'leagues',id,'league.config.json'),'utf8'));
 if(config.id!==id)throw Error('Niezgodna konfiguracja ligi.');
 return config;
}
function walk(dir,base=''){
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  if(entry.isSymbolicLink())throw Error('Źródła nie mogą zawierać symlinków: '+path.join(dir,entry.name));
  const rel=path.join(base,entry.name);
  return entry.isDirectory()?walk(path.join(dir,entry.name),rel):[rel];
 }).sort();
}
export function sourceFiles(id){
 const config=configFor(id),sources=new Map();
 for(const directory of ['shared',`leagues/${id}/modules`])for(const relative of walk(path.join(root,directory))){
  if(sources.has(relative))throw Error('Plik ma dwóch właścicieli — przenieś go ze shared do modułów ligi: '+relative);
  sources.set(relative,path.join(root,directory,relative));
 }
 const hosting=JSON.parse(readFileSync(sources.get('.openai/hosting.json'),'utf8'));
 if(hosting.project_id!==config.projectId||hosting.d1!==config.databaseBinding)throw Error('Manifest wdrożenia nie pasuje do ligi.');
 const other=configFor(leagueIds.find(other=>other!==id));
 if(config.projectId===other.projectId||new URL(config.deploymentUrl).hostname===new URL(other.deploymentUrl).hostname)throw Error('Ligi wymagają odrębnych projektów i domen.');
 const site=readFileSync(sources.get('lib/site-league.ts'),'utf8');
 if(!site.includes(`SITE_LEAGUE:LeagueTheme='${config.theme}'`))throw Error('Motyw aplikacji nie pasuje do konfiguracji.');
 // These capabilities already exist in both variants. Do not silently disable
 // working code by changing a documentary flag without an implementation.
 if(!config.features.refereeMode||!config.features.roundOf16Bracket)throw Error('Wyłączanie istniejących funkcji wymaga jawnej zmiany i testów.');
 const tv=readFileSync(sources.get('components/tennis/tv-view.tsx'),'utf8');
 if(!site.includes('bracketEditor:'+String(config.features.bracketEditor)))throw Error('Moduł edycji drabinki nie pasuje do konfiguracji.');
 if(tv.includes('tv-venue-filter')!==config.features.tvCourtFilters)throw Error('Wybrany moduł TV nie pasuje do konfiguracji filtrów kortów.');
 return sources;
}
export function materialize(id,destination){
 const config=configFor(id),sources=sourceFiles(id),target=path.resolve(destination);
 for(const protectedPath of [root,path.join(root,'shared'),path.join(root,'leagues'),path.join(root,'scripts'),path.join(root,'docs'),path.join(root,'tests')]){
  if(target===protectedPath||target.startsWith(protectedPath+path.sep)&&protectedPath!==root)throw Error('Nie można nadpisać źródeł: '+target);
 }
 if(target===path.parse(target).root)throw Error('Nieprawidłowy katalog docelowy.');
 mkdirSync(target,{recursive:true});
 if(realpathSync(target)!==target)throw Error('Katalog eksportu nie może być symlinkiem.');
 const markerPath=path.join(target,'.league-source.json');
 const marker=existsSync(markerPath)?JSON.parse(readFileSync(markerPath,'utf8')):null;
 const hostingPath=path.join(target,'.openai/hosting.json');
 if(marker&&marker.league!==id)throw Error('Ten katalog należy do innej ligi.');
 if(existsSync(hostingPath)&&JSON.parse(readFileSync(hostingPath,'utf8')).project_id!==config.projectId)throw Error('Ten katalog ma manifest innej ligi. Eksport przerwany.');
 // Only empty outputs, previously generated outputs, or this exact Site's
 // existing checkout can be updated. Database state and secrets are untouched.
 if(!marker&&!existsSync(hostingPath)&&readdirSync(target).length)throw Error('Eksport wymaga pustego katalogu.');
 const priorFiles=marker?.files||[];
 for(const relative of priorFiles){
  if(!sources.has(relative)&&!relative.startsWith('..')&&!path.isAbsolute(relative))rmSync(path.join(target,relative),{force:true});
 }
 for(const [relative,source] of sources){
  const dest=path.join(target,relative);mkdirSync(path.dirname(dest),{recursive:true});
  if(existsSync(dest)&&realpathSync(dest)!==dest)throw Error('Plik docelowy jest symlinkiem: '+relative);
  copyFileSync(source,dest);chmodSync(dest,statSync(source).mode&0o777);
 }
 // This file is provenance, not a runtime configuration or secret.
 const digest=createHash('sha256');for(const [relative,source] of [...sources].sort(([a],[b])=>a.localeCompare(b))){digest.update(relative);digest.update('\0');digest.update(readFileSync(source));}
 writeFileSync(markerPath,JSON.stringify({format:1,league:id,projectId:config.projectId,sourceDigest:digest.digest('hex'),files:[...sources.keys()].sort()},null,2)+'\n');
 return target;
}
function run(args,cwd){const child=spawnSync(args[0],args.slice(1),{cwd,stdio:'inherit',env:process.env});if(child.error)throw child.error;if(child.status!==0)process.exit(child.status??1);}
export function main(args){
 const [command,id,...rest]=args;
 if(!['prepare','export','install','build','dev','test','check'].includes(command))throw Error('Użycie: node scripts/league.mjs prepare|export|install|build|dev|test|check smartliga|relaksmisja [katalog eksportu]');
 configFor(id);
 if(command==='export'){
  if(rest.length>1)throw Error('Podaj jeden katalog eksportu.');
  console.log(materialize(id,rest[0]||path.join(root,'.exports',id)));return;
 }
 if(rest.length)throw Error('Nieoczekiwane argumenty.');
 const dir=materialize(id,path.join(root,'.generated',id));
 if(command==='prepare'){console.log(dir);return;}
 if(command==='install'){run(['pnpm','install','--frozen-lockfile'],dir);return;}
 if(!existsSync(path.join(dir,'node_modules')))throw Error(`Najpierw uruchom: npm run install:${id}`);
 if(command==='test'){run([process.execPath,path.join(root,'scripts/test-league.mjs'),dir],root);return;}
 if(command==='check'){run([process.execPath,'node_modules/typescript/bin/tsc','--noEmit','--incremental','false'],dir);return;}
 run(['pnpm','run',command],dir);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
}
