const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const { resolve, dirname } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');
const root = resolve(__dirname, '../..');
const requireProject = createRequire(root + '/package.json');
const ts = requireProject('typescript');

function leagueApp(runtimeDb) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE boards(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL);
    CREATE TABLE match_rows(board_id TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(board_id,id));
    CREATE TABLE sessions(token TEXT PRIMARY KEY,scope TEXT,expires INTEGER);
    CREATE TABLE attempts(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);
  `);
  let returnedBytes = 0;
  const queries = [];
  const record = (rows) => {
    returnedBytes += Buffer.byteLength(JSON.stringify(rows));
    return rows;
  };
  let queue = Promise.resolve();
  const adapter = {
    beforeBatch: null,
    failAt: null,
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          queries.push(sql);
          return record(db.prepare(sql).get(...args) || null);
        },
        async all() {
          queries.push(sql);
          return { results: record(db.prepare(sql).all(...args)) };
        },
        async run() {
          queries.push(sql);
          const statement = db.prepare(sql);
          if (/\bRETURNING\b/i.test(sql)) {
            const results = record(statement.all(...args));
            return { results, meta: { changes: db.prepare('SELECT changes() AS n').get().n } };
          }
          return { results: [], meta: { changes: Number(statement.run(...args).changes) } };
        },
      };
    },
    batch(statements) {
      // D1 serializes batches; simulate interleaving before a transaction, never inside it.
      const operation = queue.then(async () => {
        const callback = adapter.beforeBatch;
        adapter.beforeBatch = null;
        if (callback) callback();
        db.exec('BEGIN');
        try {
          const results = [];
          for (const statement of statements) {
            if (adapter.failAt === results.length) {
              adapter.failAt = null;
              throw Error('D1 simulated failure');
            }
            results.push(await statement.run());
          }
          db.exec('COMMIT');
          return results;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
  const modules = new Map();
  function load(relative) {
    const file = resolve(root, relative);
    if (modules.has(file)) return modules.get(file);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const module = { exports: {} };
    const localRequire = (name) => {
      if (name === '@/db/raw')
        return { database: () => runtimeDb ?? adapter, adminCode: () => 'TEST-ADMIN' };
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      if (name.startsWith('.')) return load(resolve(dirname(file), name + '.ts'));
      return requireProject(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    modules.set(file, module.exports);
    return module.exports;
  }
  const api = load('src/app/api/league/route.ts');
  const tennis = load('src/lib/tennis.ts');
  function session(scope) {
    const token = crypto.randomUUID();
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
      createHash('sha256').update(token).digest('hex'),
      scope,
      Date.now() + 3600000,
    );
    return 'tennis_session=' + token;
  }
  const admin = session('admin');
  const board = () => JSON.parse(db.prepare("SELECT data FROM boards WHERE id='main'").get().data);
  async function post(action, extra, cookie = admin) {
    const response = await api.POST(
      new Request(
        'https://example.test/api/league' + (action === 'restore_backup' ? '?restore=1' : ''),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ action, response: 'match-delta', ...extra }),
        },
      ),
    );
    return { status: response.status, data: await response.json() };
  }
  async function get(cookie = admin) {
    const response = await api.GET(
      new Request('https://example.test/api/league', { headers: { cookie } }),
    );
    return { status: response.status, data: await response.json() };
  }
  return {
    db,
    adapter,
    tennis,
    board,
    post,
    get,
    session,
    load,
    resetMetrics() {
      returnedBytes = 0;
      queries.length = 0;
    },
    metrics() {
      return { returnedBytes, queries: [...queries] };
    },
  };
}
module.exports = { leagueApp };
