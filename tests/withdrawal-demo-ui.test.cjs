/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
function render(file, props, values = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} }; let index=0;
  const mockRequire = name => {
    if (name==='react') return {...React, useState(initial) { const value = Object.hasOwn(values, ++index) ? values[index] : initial; return [value,()=>{}]; }};
    if (name==='../../lib/copy-text') return {copyText:async()=>{}};
    if (name==='@/lib/supabase') return {supabase:{}};
    if (name==='./CryptoAssetIcon') return {default:()=>null};
    if (name==='./WithdrawalRecords') return {CopyValue:({value})=>React.createElement('span',null,value)};
    return require(name);
  };
  new Function('require','module','exports',code)(mockRequire,mod,mod.exports);
  return renderToStaticMarkup(React.createElement(mod.exports.default,props));
}
const fee='app/components/WithdrawalFeeDemo.tsx';
let html=render(fee,{audience:'client'});
assert(html.includes('Demo preview · Demo only')); assert(!html.includes('Demo tokens ('));
assert(html.includes('token-driven withdrawal statuses, token codes, and the fee flow are simulations'));
assert(html.includes('Code acceptance does not confirm a payment or release funds'));
html=render(fee,{},{}); assert(html.includes('Admin preview')); assert(html.includes('Demo tokens ('));
html=render(fee,{audience:'client'},{2:true,3:'pending'});
assert(!html.includes('Simulate admin approval')); assert(html.includes('no request was sent'));
assert(html.includes('Restart demo'));
html=render(fee,{audience:'admin'},{2:true,3:'pending'});
assert(html.includes('Simulate admin approval'));
const token='app/components/WithdrawalDemoToken.tsx';
const state={generation:'generation-a',enabled:true,consumed_at:null,expires_at:'2030-01-01'};
html=render(token,{withdrawalId:'withdrawal-a'},{1:state});
assert(!html.includes('Check demo code')); assert(!html.includes('Generate a new code'));
assert(html.includes('Enter token to complete transaction'));
assert(html.includes('text-center'));
assert(html.includes('placeholder="*****"'));
assert(!html.includes('A preview exercise.'));
assert(!html.includes('Demo only · Token code'));
assert(!html.includes('Paste the demo token code'));
html=render(token,{withdrawalId:'withdrawal-a'},{1:{...state,enabled:false},6:'generation-a'});
assert.equal(html,'');
html=render(token,{withdrawalId:'withdrawal-a'},{1:{...state,enabled:false},6:'generation-a',9:true});
assert(html.includes('Token code accepted')); assert(html.includes('border-emerald-300'));
html=render(token,{withdrawalId:'withdrawal-a'},{1:state,7:'Incorrect token code'});
assert(html.includes('Incorrect token code')); assert(html.includes('border-rose-400'));
html=render(token,{withdrawalId:'withdrawal-a'},{1:{...state,enabled:false}});
assert.equal(html,'');
html=render(token,{withdrawalId:'withdrawal-a',admin:true},{1:state,2:false});
assert(html.includes('Enable code for this withdrawal')); assert(html.includes('Generate a new code'));
html=render(token,{withdrawalId:'withdrawal-a',admin:true},{1:{...state,auto_advance:false},2:false});
assert(html.includes('Advance status automatically'));
assert(!html.includes('Copy code')); // No code is fetched from the public metadata table.
html=render(token,{withdrawalId:'withdrawal-a',admin:true},{1:state,2:false,5:{code:'DEMO-'+'A'.repeat(32),generation:'generation-a'}});
assert(html.includes('A'.repeat(32))); assert(!html.includes('DEMO-')); assert(html.includes('Copy code'));
console.log('PASS: client/admin demo separation, admin-only approval, client entry, hidden inactive form, success without entry form, and generation controls without exposing stored codes.');

html=render(token,{withdrawalId:'withdrawal-a',showNotice:false},{1:{...state,enabled:false,demo_status:'processing'}});
assert(html.includes('Status: ')); assert(html.includes('Processing')); assert(!html.includes('Demo preview'));
html=render(token,{withdrawalId:'withdrawal-a',admin:true},{1:{...state,demo_status:'processing',auto_advance:true}});
assert.equal((html.match(/Demo preview/g)||[]).length,1); assert(!html.includes('Demo status:'));
for (const admin of [false, true]) {
  html=render(token,{withdrawalId:'withdrawal-a',admin},{1:{...state,enabled:false,demo_status:'processing',auto_advance:false}});
  assert(!html.includes('Status: '), 'unchecked advancement hides bottom bar for client and admin');
  if (!admin) assert.equal(html,'','no empty client token footer after consumption');
  html=render(token,{withdrawalId:'withdrawal-a',admin},{1:{...state,enabled:false,demo_status:'processing',auto_advance:true}});
  assert(html.includes('Status: '), 'checking advancement restores the saved status bar');
}
