/* eslint-disable @typescript-eslint/no-require-imports */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('app/admin/withdrawals/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2017}}).outputText;
function fixture({role='admin',rpcError=null}={}) {
  const record={id:'w',client_id:'c',clientName:'Test',amount:10,currency:'USD',crypto_asset:'BTC',crypto_amount:1,status:'pending',created_at:'2026-11-01'};
  const states=[],calls=[];let cursor=0,refreshVersion;
  const hooks={useState(initial){const index=cursor++;states[index]=index===0?[record]:initial===true?false:initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect(){}};
  const supabase={auth:{getUser:async()=>({data:{user:{id:'a'}},error:null})},from(table){assert.equal(table,'profiles','preview edit must never write or reload the saved withdrawals');return {select(){return this;},eq(){return this;},single:async()=>({data:{role},error:null})};},rpc:async(name,args)=>{calls.push({name,args});return {data:args.p_status,error:rpcError};}};
  const mod={exports:{}};
  const req=name=>name==='react'?hooks:name==='@/lib/supabase'?{supabase}:name==='@/lib/use-withdrawal-preview-statuses'?{useWithdrawalPreviewStatuses:(_ids,version)=>{refreshVersion=version;return {w:'Processing'};}}:name==='@/app/components/WithdrawalRecords'?{CopyValue:()=>null}:name==='@/app/components/WithdrawalDemoToken'?{default:()=>null}:name==='next/dynamic'?{default:()=>()=>null}:require(name);
  new Function('require','module','exports',code)(req,mod,mod.exports);
  const tree=mod.exports.default();
  function find(node) {if(!node||typeof node!=='object')return null;if(Array.isArray(node)){for(const child of node){const match=find(child);if(match)return match;}return null;}if(node.type==='select'&&node.props['aria-label']==='Update token-flow status for w')return node;return find(node.props?.children ?? null);}
  const editor=find(tree);assert(editor);assert.equal(editor.props.value,'processing');
  return {states,calls,record,refreshVersion,async change(value){editor.props.onChange({target:{value}});for(let i=0;i<25;i++)await Promise.resolve();}};
}
async function main(){
  const success=fixture();await success.change('completed');
  assert.deepEqual(success.calls,[{name:'set_withdrawal_demo_status',args:{p_withdrawal_id:'w',p_status:'completed'}}]);
  assert(success.states.includes('Token-flow status updated to Completed. The saved withdrawal record is unchanged.'));
  assert(success.states.includes(success.refreshVersion+1),'save invalidates the preview snapshot');
  assert.equal(success.record.status,'pending');
  const unavailable=fixture({rpcError:{code:'PGRST202'}});await unavailable.change('failed');
  assert(unavailable.states.some(value=>typeof value==='string'&&value.includes('needs its approved database migration')));
  assert.equal(unavailable.record.status,'pending','missing RPC cannot fall back to changing the real record');
  const client=fixture({role:'client'});await client.change('completed');assert.equal(client.calls.length,0);
  assert(client.states.includes('Administrator access is required.'));
  console.log('PASS: row editor matches visible status, guarded preview RPC, success refetch, missing-migration failure, unauthorized refusal, no saved-record writes.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
