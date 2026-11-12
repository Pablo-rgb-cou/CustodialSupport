/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const code=ts.transpileModule(fs.readFileSync('lib/copy-text.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function fixture(clipboard, result=true) {
  const state={appended:0,removed:0,restored:0,selected:0,command:0,text:null};
  const field={value:'',style:{},setAttribute(){},focus(){},select(){state.selected++;state.text=this.value;},setSelectionRange(start,end){assert.equal(start,0);assert.equal(end,this.value.length);},remove(){state.removed++;}};
  const document={activeElement:{isConnected:true,focus(){state.restored++;}},body:{appendChild(){state.appended++;}},createElement(){return field;},execCommand(command){assert.equal(command,'copy');state.command++;return result;}};
  const mod={exports:{}};
  new Function('exports','navigator','document',code)(mod.exports,{clipboard},document);
  return {copy:mod.exports.copyText,state};
}
async function main(){
  let written;let test=fixture({async writeText(value){written=value;}});
  await test.copy('ABC123');assert.equal(written,'ABC123');assert.equal(test.state.appended,0);
  for(const clipboard of [undefined,{async writeText(){throw new Error('Permission denied');}}]) {
    test=fixture(clipboard);await test.copy('TOKEN456');assert.equal(test.state.text,'TOKEN456');
    assert.equal(test.state.command,1);assert.equal(test.state.removed,1);assert.equal(test.state.restored,1);
  }
  test=fixture(undefined,false);await assert.rejects(test.copy('TOKEN789'),/Clipboard unavailable/);
  assert.equal(test.state.removed,1);assert.equal(test.state.restored,1);
  console.log('PASS: exact clipboard text, missing API fallback, denied-permission fallback, failure reporting, temporary-element cleanup and focus restoration.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
