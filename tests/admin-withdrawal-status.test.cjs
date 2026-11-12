/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync('app/admin/withdrawals/page.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const record = { id:'withdrawal-a',client_id:'client-a',clientName:'Test client',amount:123,currency:'USD',crypto_asset:'BTC',crypto_amount:1,wallet_address:'test-wallet',status:'pending',transaction_reference:'test-ref',created_at:'2026-11-01T12:00:00Z',admin_note:null };
function render(previews, filter='all') {
  const mod={exports:{}};let index=0;
  const req=name=>{
    if(name==='react')return {...React,useState(initial){index++;return [index===1?[record]:index===4?filter:initial===true?false:initial,()=>{}];}};
    if(name==='@/lib/use-withdrawal-preview-statuses')return {useWithdrawalPreviewStatuses:ids=>{assert.deepEqual(ids,[record.id]);return previews;}};
    if(name==='@/lib/supabase')return {supabase:{}};
    if(name==='@/app/components/WithdrawalRecords')return {CopyValue:()=>null};
    if(name==='@/app/components/WithdrawalDemoToken')return {default:()=>null};
    if(name==='next/dynamic')return {default:()=>()=>null};
    return require(name);
  };
  new Function('require','module','exports',code)(req,mod,mod.exports);
  return renderToStaticMarkup(React.createElement(mod.exports.default));
}
const html=render({[record.id]:'Processing'});
assert(html.includes('>Processing</span>'),'admin row matches the client token-flow status');
assert(!html.includes('>Pending</span>'),'stored status is not mistaken for the displayed badge');
assert(html.includes('Update token-flow status for withdrawal-a'));
assert(html.includes('<option value="processing" selected="">'),'editor matches badge and client status');
assert(render({[record.id]:'Processing'},'processing').includes('Test client'));
assert(!render({[record.id]:'Processing'},'pending').includes('Test client'),'filter follows visible status');
const stored=render({});
assert(stored.includes('>Pending</span>'),'missing preview falls back to saved status');
assert(stored.includes('Update saved record status for withdrawal-a'));
assert(stored.includes('<option value="pending" selected="">'));
assert.equal(record.status,'pending','display mapping never changes the source record');
const cards=[...html.matchAll(/<article[^>]*>(.*?)<\/article>/g)].map(match=>match[1]);
assert(cards.find(card=>card.includes('>Processing</p>')).includes('>1</p>'));
assert(cards.find(card=>card.includes('>Pending</p>')).includes('>0</p>'));
console.log('PASS: admin/client status parity, visible-status filters and counts, saved-status editing retained, no source mutation, fallback without metadata.');
