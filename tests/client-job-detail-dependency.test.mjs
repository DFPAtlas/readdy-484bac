import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('job detail discards superseded reads and reads completed after cleanup', async () => {
  const source = fs.readFileSync('app/client/jobs/[id]/JobDetailClient.tsx', 'utf8');
  const body = source.slice(source.indexOf('  const requestRef ='), source.indexOf('  useEffect(() => {', source.indexOf('  const requestRef =')));
  const pending = [], updates = [], redirects = [];
  const setters = [...new Set([...body.matchAll(/\b(set[A-Z]\w*)\(/g)].map(m => m[1]))];
  const env = {
    jobId: 'job-a', router: { push: path => redirects.push(path) },
    useRef: current => ({current}), useCallback: fn => fn,
    getInitials: () => 'CL', buildTimeline: () => [],
    supabase: {
      auth: {getUser: () => new Promise(resolve => pending.push(resolve))},
      from(table) {
        const result = {data: table === 'clients' ? {id: 'client'} : table === 'jobs' ? {id: 'job-a'} : []};
        const query = new Proxy({}, {get: (_, key) => key === 'then' ? Promise.resolve(result).then.bind(Promise.resolve(result)) : () => query});
        return query;
      },
      schema() { return this; },
    },
    ...Object.fromEntries(setters.map(name => [name, value => updates.push([name, value])])),
  };
  const js = ts.transpileModule(body + '\nreturn {loadJobDetail, mountedRef, requestRef};', {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const api = new Function(...Object.keys(env), js)(...Object.values(env));
  api.mountedRef.current = true;
  const older = api.loadJobDetail(), newer = api.loadJobDetail();
  pending[1]({data:{user:{id:'new-user'}}}); await newer;
  assert(updates.some(([name]) => name === 'setJob'));
  const count = updates.length;
  pending[0]({data:{user:null}}); await older;
  assert.equal(updates.length, count); assert.deepEqual(redirects, []);
  const closing = api.loadJobDetail(); api.mountedRef.current = false;
  pending[2]({data:{user:null}}); await closing;
  assert.equal(updates.length, count); assert.deepEqual(redirects, []);
});
