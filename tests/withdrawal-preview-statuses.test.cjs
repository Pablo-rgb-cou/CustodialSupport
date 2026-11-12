/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const slots = []; let cursor = 0; let effects = [];
const hooks = {
  useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
  useEffect(fn, deps) { const i = cursor++; if (JSON.stringify(slots[i]?.deps) !== JSON.stringify(deps)) { const old = slots[i]; slots[i] = { deps }; effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
};
const requests = [], channels = [], removed = [], listeners = new Map();
const supabase = {
  from(table) { assert.equal(table, 'withdrawal_demo_tokens'); return { select(columns) { assert.equal(columns, 'withdrawal_id,demo_status'); return this; }, in(column, ids) { assert.equal(column, 'withdrawal_id'); return new Promise(resolve => requests.push({ ids, resolve })); } }; },
  channel() { const channel = { handlers: [], on(_event, filter, fn) { this.handlers.push({ filter, fn }); return this; }, subscribe(fn) { this.status = fn; return this; } }; channels.push(channel); return channel; },
  removeChannel(channel) { removed.push(channel); },
};
const surface = { visibilityState: 'visible', addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name); } };
const source = fs.readFileSync('lib/use-withdrawal-preview-statuses.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', 'window', 'document', 'crypto', code)(name => name === 'react' ? hooks : name === './supabase' ? { supabase } : require(name), mod, mod.exports, surface, surface, { randomUUID: () => String(channels.length) });
function render(ids = ['a']) { cursor = 0; const value = mod.exports.useWithdrawalPreviewStatuses(ids); const pending = effects; effects = []; pending.forEach(fn => fn()); return value; }
async function resolve(index, data, error = null) { requests[index].resolve({ data, error }); await Promise.resolve(); await Promise.resolve(); }
async function main() {
  assert.deepEqual(render(), {}); assert.deepEqual(requests[0].ids, ['a']);
  await resolve(0, [{ withdrawal_id: 'a', demo_status: 'processing' }, { withdrawal_id: 'other-client', demo_status: 'completed' }]);
  assert.deepEqual(render(), { a: 'Processing' });
  channels[0].status('SUBSCRIBED'); const stale = requests.length - 1;
  channels[0].handlers[0].fn({ eventType: 'UPDATE', new: { withdrawal_id: 'a', demo_status: 'completed' } });
  assert.deepEqual(render(), { a: 'Completed' }, 'event updates list without opening details');
  await resolve(stale, [{ withdrawal_id: 'a', demo_status: 'pending' }]);
  assert.deepEqual(render(), { a: 'Completed' }, 'old snapshot cannot revert a newer event');
  await resolve(requests.length - 1, null, { message: 'offline' });
  assert.deepEqual(render(), { a: 'Completed' }, 'transient errors preserve confirmed status');
  listeners.get('online')();
  await resolve(requests.length - 1, [{ withdrawal_id: 'a', demo_status: 'processing' }]);
  assert.deepEqual(render(), { a: 'Processing' }, 'reconnection reconciles');
  channels[0].handlers[0].fn({ eventType: 'DELETE', old: { withdrawal_id: 'a' } });
  assert.deepEqual(render(), {}, 'deleted preview falls back to stored status');
  const late = requests.length - 1;
  assert.deepEqual(render(['b']), {}, 'record change cannot display another account preview');
  assert.equal(removed.length, 1);
  await resolve(late, [{ withdrawal_id: 'a', demo_status: 'completed' }]);
  assert.deepEqual(render(['b']), {}, 'late response after cleanup ignored');
  const ids = Array.from({ length: 101 }, (_, i) => String(i)); render(ids);
  assert.equal(channels.at(-1).handlers.length, 2);
  assert(channels.at(-1).handlers.every(h => h.filter.filter.startsWith('withdrawal_id=in.(')));
  slots.forEach(slot => slot?.cleanup?.()); assert.equal(listeners.size, 0);
  console.log('PASS: scoped initial fetch, immediate live status, stale-fetch protection, error preservation, reconnection, delete fallback, account change, IN-filter batching, cleanup.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
