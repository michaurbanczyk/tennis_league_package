const {createRequire}=require('node:module');
const {readFileSync,existsSync}=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
function loader(root,raw,overrides={}){
 const requireAt=createRequire(path.join(root,'package.json')),ts=requireAt('typescript'),cache=new Map();
 function load(file){
  if(cache.has(file))return cache.get(file).exports;
  const mod={exports:{}};cache.set(file,mod);
  const source=ts.transpileModule(readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const req=id=>{
   if(Object.hasOwn(overrides,id))return overrides[id];
   if(id==='@/db/raw'&&raw)return raw;
   if(!id.startsWith('@/')&&!id.startsWith('.'))return requireAt(id);
   const base=id.startsWith('@/')?id.slice(2):path.join(path.dirname(file),id);
   const resolved=['','.ts','.tsx','.mjs'].map(ext=>base+ext).find(f=>existsSync(path.join(root,f)));
   if(!resolved)throw Error('Missing module '+id+' from '+file);
   return load(resolved);
  };
  new Function('require','module','exports',source)(req,mod,mod.exports);
  return mod.exports;
 }
 return {load,requireAt};
}
function app(root,secret){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE boards(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL); CREATE TABLE sessions(token TEXT PRIMARY KEY,scope TEXT,expires INTEGER); CREATE TABLE attempts(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);');
 const adapter={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}},async batch(statements){db.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());db.exec('COMMIT');return out;}catch(error){db.exec('ROLLBACK');throw error;}}};
 const {load}=loader(root,{database:()=>adapter,adminCode:()=>secret});
 const api=load('app/api/league/route.ts');let cookie='';
 async function get(query='',session=cookie){const r=await api.GET(new Request('https://test.invalid/api/league'+(query?'?'+query:''),{headers:{cookie:session}}));return {status:r.status,data:await r.json()};}
 async function post(action,extra={},session=cookie){const revision=db.prepare("SELECT revision FROM boards WHERE id='main'").get()?.revision||0;const r=await api.POST(new Request('https://test.invalid/api/league'+(action==='restore_backup'?'?restore=1':''),{method:'POST',headers:{'content-type':'application/json',cookie:session},body:JSON.stringify({action,revision,...extra})}));const set=r.headers.get('set-cookie');if(action==='login'&&set)cookie=set.split(';')[0];return {status:r.status,data:await r.json(),setCookie:set};}
 return {db,load,get,post,cookie:()=>cookie,stored:()=>db.prepare("SELECT data FROM boards WHERE id='main'").get()?.data,board:()=>JSON.parse(db.prepare("SELECT data FROM boards WHERE id='main'").get().data)};
}
module.exports={loader,app};
