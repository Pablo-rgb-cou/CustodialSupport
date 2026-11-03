/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
const source = fs.readFileSync('lib/map-client-withdrawal.ts', 'utf8');
new Function('exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(moduleUnderTest.exports);
const { mapClientWithdrawal } = moduleUnderTest.exports;
const row = { id: 'withdrawal-1', client_id: 'client-1', amount: '436784', currency: 'USD', crypto_asset: 'USDT', crypto_amount: '436784', status: 'pending', created_at: '2026-11-03T12:00:00Z', wallet_address: '0x123', transaction_reference: 'REF-1' };
for (const bad of [{}, { id: row.id }, { ...row, id: undefined }, { ...row, amount: undefined }, { ...row, amount: 'invalid' }, { ...row, status: undefined }, { ...row, created_at: 'invalid' }]) assert.equal(mapClientWithdrawal(bad), null);
let records = [mapClientWithdrawal(row)];
for (const status of ['processing', 'completed', 'failed', 'cancelled', 'pending']) {
  const updated = mapClientWithdrawal({ ...row, status });
  records = [updated, ...records.filter((record) => record.id !== updated.id)];
  assert.equal(records.length, 1, 'an update replaces the existing withdrawal');
  assert.equal(records[0].status.toLowerCase(), status);
  assert.equal(records[0].walletAddress, row.wallet_address);
  assert.equal(records[0].fiatAmount, 436784);
  assert.equal(records.filter((record) => ['Pending', 'Processing'].includes(record.status)).length, ['pending', 'processing'].includes(status) ? 1 : 0);
}
assert.equal(mapClientWithdrawal({ ...row, crypto_amount: 'invalid' }).cryptoAmount, null);
console.log('PASS: empty/partial Realtime records rejected; all status transitions preserve identity, amount and wallet; active badge counts follow status.');
