/* eslint-disable @typescript-eslint/no-require-imports -- This Node render test harness executes CommonJS modules. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..') + path.sep;
const req = createRequire(root+'package.json');
const ts = req('typescript');
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const draft = fs.readFileSync(path.join(root,'app/components/WithdrawalRecords.tsx'),'utf8');
const virtual = root+'app/components/WithdrawalRecords.tsx';
const options = {target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,strict:true,noEmit:true,skipLibCheck:true,typeRoots:[root+'node_modules/@types']};
const host=ts.createCompilerHost(options);
const originalSource=host.getSourceFile.bind(host);
host.getSourceFile=(file,lang,onError,create)=>path.resolve(file)===path.resolve(virtual)?ts.createSourceFile(file,draft,lang,true):originalSource(file,lang,onError,create);
const program=ts.createProgram([virtual],options,host);
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length) {console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=>"\n"}));process.exit(1);}

const row={id:'record-a',reference:'REF-12345',asset:'ETH',cryptoAmount:5.7,walletAddress:'0x1234567890123456789012345678901234567890',fiatAmount:13246,currency:'USD',status:'Pending',date:'10/30/2026, 8:23:32 PM',createdAtISO:'2026-10-30T20:23:32Z'};
function load(source, selected=false){
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};
 let count=0;
 const r=(name)=>name==='react'&&selected?{...React,useState(initial){count++;return count===2?[row.id,()=>{}]:React.useState(initial);}}:name==='./CryptoAssetIcon'?load(fs.readFileSync(root+'app/components/CryptoAssetIcon.tsx','utf8')):req(name);
 new Function('require','module','exports',code)(r,mod,mod.exports);return mod.exports;
}
function render(records,extra={},selected=false){const component=load(draft,selected).default;return renderToStaticMarkup(React.createElement(component,{records,loading:false,error:'',...extra}));}
for(const count of [0,1,2,5,6,12]){
 const html=render(Array.from({length:count},(_,i)=>({...row,id:'record-'+i})));
 assert(html.includes('h-[27.5rem]'));
 assert(html.includes('sm:h-[30rem]'));
 assert.equal((html.match(/aria-haspopup="dialog"/g)||[]).length,count);
 assert.equal((html.match(/h-\[5\.5rem\] border-b border-white/g)||[]).length,count);
 assert(html.includes('scrollbar-hide'));
}
const dialog=render([row],{},true);
assert(dialog.includes('<dialog'));
assert(!dialog.includes('>Reference</th>'));
assert(dialog.includes('Recipient wallet'));
assert(!dialog.includes(row.walletAddress));
assert(dialog.includes('0x12345…567890'));
assert(!dialog.includes('Record ID'));
assert(dialog.includes('Record reference'));
assert(dialog.includes('Copy wallet address'));
assert(dialog.includes('max-w-2xl'));
assert(!dialog.includes('bottom-0 top-auto'));
assert(dialog.includes('safe-area-inset-bottom'));
assert(dialog.includes('Close withdrawal details'));
for(const state of [{loading:true},{error:'Test error'}])assert(render([],state).includes('h-[27.5rem]'));
console.log('PASS: strict TypeScript check; 0/1/2/5/6/12 rows, fixed five-slot viewport, separators, loading/error states, centered modal, shortened wallet with copy control, record ID removed, record reference displayed, safe area and close control.');
