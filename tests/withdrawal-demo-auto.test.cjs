/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
// Deterministic hook/timer runner: execute the actual component and event handlers.
const slots=[]; let cursor=0, dirty=false, pending=[], clock=0, timerId=0;
const timers=new Map();
const same=(a,b)=>a && b && a.length===b.length && a.every((v,i)=>Object.is(v,b[i]));
const hooks={
  useId(){cursor++; return 'token-input';},
  useState(initial){const i=cursor++; if(!slots[i])slots[i]={value:initial};return [slots[i].value,value=>{const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
  useRef(value){const i=cursor++;if(!slots[i])slots[i]={current:value};return slots[i];},
  useCallback(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={deps,value:fn};return slots[i].value;},
  useEffect(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps)){const old=slots[i];slots[i]={deps};pending.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
};
let metadata={enabled:true,generation:'a',consumed_at:null,expires_at:'2030-01-01'};
let rpcCalls=0, outcome='incorrect', realtime;
let finishToggle;
const supabase={
  from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{...metadata},error:null};}};},
  channel(){return {on(_event,_filter,fn){realtime=fn;return this;},subscribe(){return this;}};},removeChannel(){},
  async rpc(_name,args){if(_name==='set_withdrawal_demo_auto_advance')return new Promise(resolve=>{finishToggle=resolve;});assert.match(args.p_code,/^DEMO-[A-F0-9]{32}$/);rpcCalls++;if(outcome==='success'){metadata={...metadata,enabled:false,demo_status:"processing"};realtime();}return {data:{status:outcome,demo_status:outcome==='success'?'processing':null},error:null};},
};
const code=ts.transpileModule(fs.readFileSync('app/components/WithdrawalDemoToken.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const mod={exports:{}};
new Function('require','module','exports','setTimeout','clearTimeout','window','document',code)(name=>name==='../../lib/copy-text'?{copyText:async()=>{}}:name==='react'?hooks:name==='@/lib/supabase'?{supabase}:require(name),mod,mod.exports,(fn,delay)=>{const id=++timerId;timers.set(id,{fn,at:clock+delay});return id;},id=>timers.delete(id),{addEventListener(){},removeEventListener(){}},{visibilityState:'visible',addEventListener(){},removeEventListener(){}});
let tree; let preview; let admin=false;
const onPreviewChange=value=>{preview=value;};
function render(){cursor=0;dirty=false;tree=mod.exports.default({withdrawalId:'w',onPreviewChange,admin});const effects=pending;pending=[];effects.forEach(fn=>fn());}
async function settle(){for(let i=0;i<15;i++){await Promise.resolve();if(dirty)render();}}
async function advance(ms){clock+=ms;for(const [id,t]of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}await settle();}
function find(type,node=tree){if(!node)return null;if(Array.isArray(node)){for(const item of node){const found=find(type,item);if(found)return found;}return null;}if(typeof node!=='object')return null;if(node.type===type)return node;return find(type,node.props?.children ?? null);}
function type(value){find('input').props.onChange({target:{value}});render();}
function inputs(node=tree){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(inputs);return node.type==='input'?[node]:inputs(node.props?.children ?? null);}
async function main(){
  render();await settle();
  type('DEMO-');await advance(1000);assert.equal(rpcCalls,0,'partial typing never spends an attempt');
  type('DEMO-'+'A'.repeat(32));await advance(499);assert.equal(rpcCalls,0);
  await advance(1);assert.equal(rpcCalls,1);assert.equal(find('input').props['aria-invalid'],true);
  assert(find('input').props.className.includes('border-rose-400'));
  assert(JSON.stringify(tree).includes('Incorrect token code'));
  realtime();await settle();await advance(1000);assert.equal(rpcCalls,1,'refresh must not resubmit rejected code');
  outcome='success';type('B'.repeat(32));await advance(500);
  assert.equal(rpcCalls,2);assert(find('input').props.className.includes('border-emerald-300'));
  assert(find('input').props.readOnly,'accepted input is read-only during green flash');
  await advance(1199);assert(find('input'));
  await advance(1);assert.equal(find('input'),null,'successful entry disappears');
  assert(JSON.stringify(tree).includes('Status: '));
  assert(JSON.stringify(tree).includes('Processing'));
  assert.equal(rpcCalls,2);
  assert.deepEqual(preview,{active:true,status:'Processing'});
  metadata={...metadata,auto_advance:false};realtime();await settle();
  assert(!JSON.stringify(tree).includes('Status: '),'client bottom bar disappears on live admin switch-off');
  assert.deepEqual(preview,{active:true,status:'Processing'},'switch-off preserves the preview already reached');
  metadata={...metadata,auto_advance:true};realtime();await settle();
  assert(JSON.stringify(tree).includes('Status: '),'switch-on restores saved status');
  admin=true;render();inputs()[1].props.onChange({target:{checked:false}});render();
  assert.equal(inputs()[1].props.checked,false);
  assert(!JSON.stringify(tree).includes('Status: '),'admin hides bar before network finishes');
  finishToggle({error:null});await settle();
  inputs()[1].props.onChange({target:{checked:true}});render();
  assert(JSON.stringify(tree).includes('Status: '));
  finishToggle({error:{message:'denied'}});await settle();
  assert.equal(inputs()[1].props.checked,false,'failed change rolls back checkbox');
  assert(!JSON.stringify(tree).includes('Status: '),'failed change rolls back bar');
  slots.forEach(slot=>slot?.cleanup?.());
  assert.equal(timers.size,0,'timers are cleaned up');
  console.log('PASS: partial typing, debounce, one attempt per value, red mismatch, no duplicate on refresh, green success despite Realtime consumption, timed dismissal, cleanup.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
