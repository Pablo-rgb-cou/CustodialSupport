/* eslint-disable @typescript-eslint/no-require-imports */
// Run with PGLITE_MODULE_PATH pointing to an installed @electric-sql/pglite.
// Uses an isolated in-memory database. Never connects to Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE_PATH || path.join(require('node:os').tmpdir(), 'custodial-demo-db-test/node_modules/@electric-sql/pglite'));
async function main() {
  const db = new PGlite();
  const admin = '10000000-0000-0000-0000-000000000001';
  const client = '20000000-0000-0000-0000-000000000002';
  const other = '30000000-0000-0000-0000-000000000003';
  const withdrawal = '40000000-0000-0000-0000-000000000004';
  await db.exec(`create role anon; create role authenticated;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create table public.profiles(id uuid primary key,role text);
    create table public.withdrawals(id uuid primary key,client_id uuid,status text);
    insert into profiles values('${admin}','admin'),('${client}','client'),('${other}','client');
    insert into withdrawals values('${withdrawal}','${client}','pending');
    grant select on profiles,withdrawals to authenticated;
    alter table withdrawals enable row level security;
    create policy own_withdrawal on withdrawals for select to authenticated using(client_id=auth.uid());
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261110124047_withdrawal_demo_tokens.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261110183442_withdrawal_demo_status.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261111222345_admin_withdrawal_demo_status.sql'), 'utf8'));
  async function user(id) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  }
  const issue = async () => {
    await user(admin);
    return (await db.query('select public.configure_withdrawal_demo_token($1,true) as result', [withdrawal])).rows[0].result;
  };
  const verify = async (id, code, generation) => {
    await user(id);
    return (await db.query('select public.verify_withdrawal_demo_token($1,$2,$3) as result', [withdrawal, generation, code])).rows[0].result.status;
  };
  let issued = await issue();
  assert.match(issued.code, /^DEMO-[A-F0-9]{32}$/);
  await user(other);
  assert.equal((await db.query('select * from withdrawal_demo_tokens')).rows.length, 0);
  await assert.rejects(verify(other, issued.code, issued.generation), /Withdrawal unavailable/);
  await user(client);
  assert.equal((await db.query('select * from withdrawal_demo_tokens')).rows.length, 1);
  await assert.rejects(db.query('select * from support_private.withdrawal_demo_secrets'), /permission denied/);
  await assert.rejects(db.query('update withdrawal_demo_tokens set enabled=false'), /permission denied/);
  await assert.rejects(db.query('select configure_withdrawal_demo_token($1,true)', [withdrawal]), /Administrator access required/);
  assert.equal(await verify(client, 'WRONG', issued.generation), 'incorrect');
  assert.equal(await verify(client, issued.code.toLowerCase(), issued.generation), 'success');
  assert.equal(await verify(client, issued.code, issued.generation), 'inactive');
  await user(admin);
  const consumed = (await db.query('select * from withdrawal_demo_tokens')).rows[0];
  assert.equal(consumed.enabled, false); assert(consumed.consumed_at);
  assert.equal(consumed.demo_status, 'processing');
  await user(client);
  await assert.rejects(db.query('select set_withdrawal_demo_auto_advance($1,false)', [withdrawal]), /Administrator access required/);
  await user(admin);
  await db.query('select set_withdrawal_demo_auto_advance($1,false)', [withdrawal]);
  issued = await issue();
  assert.equal(await verify(client, issued.code, issued.generation), 'success');
  await user(admin);
  assert.equal((await db.query('select demo_status from withdrawal_demo_tokens')).rows[0].demo_status, 'processing', 'switch off prevents advancement');
  await db.query('select set_withdrawal_demo_auto_advance($1,true)', [withdrawal]);
  issued = await issue();
  assert.equal(await verify(client, issued.code, issued.generation), 'success');
  await user(admin);
  assert.equal((await db.query('select demo_status from withdrawal_demo_tokens')).rows[0].demo_status, 'completed');
  issued = await issue();
  assert.equal(await verify(client, issued.code, issued.generation), 'success');
  await user(admin);
  assert.equal((await db.query('select demo_status from withdrawal_demo_tokens')).rows[0].demo_status, 'completed', 'terminal status stays terminal');
  const previous = await issue(); issued = await issue();
  assert.equal(await verify(client, previous.code, previous.generation), 'inactive');
  for (let i=0; i<5; i++) assert.equal(await verify(client, 'WRONG', issued.generation), i===4 ? 'locked' : 'incorrect');
  assert.equal(await verify(client, issued.code, issued.generation), 'locked');
  issued = await issue();
  await db.exec("reset role; update withdrawal_demo_tokens set expires_at=now()-interval '1 second'");
  assert.equal(await verify(client, issued.code, issued.generation), 'expired');
  issued = await issue();
  await user(admin);
  await db.query('select configure_withdrawal_demo_token($1,false)', [withdrawal]);
  assert.equal(await verify(client, issued.code, issued.generation), 'inactive');
  for (const identity of [client,other]) {
    await user(identity);
    await assert.rejects(db.query('select set_withdrawal_demo_status($1,$2)', [withdrawal,'completed']), /Administrator access required/);
  }
  await user(admin);
  const beforeManual=(await db.query('select * from withdrawal_demo_tokens')).rows[0];
  for (const value of ['pending','processing','completed','failed','cancelled']) {
    const result=await db.query('select set_withdrawal_demo_status($1,$2) as status',[withdrawal,value]);
    assert.equal(result.rows[0].status,value);
    assert.equal((await db.query('select demo_status from withdrawal_demo_tokens')).rows[0].demo_status,value);
  }
  for (const value of ['unknown',null]) await assert.rejects(db.query('select set_withdrawal_demo_status($1,$2)',[withdrawal,value]), /Choose a valid status/);
  await assert.rejects(db.query('select set_withdrawal_demo_status($1,$2)',[other,'pending']), /Withdrawal unavailable/);
  const afterManual=(await db.query('select * from withdrawal_demo_tokens')).rows[0];
  for (const field of ['generation','enabled','auto_advance','consumed_at','expires_at']) assert.deepEqual(afterManual[field],beforeManual[field],'manual status preserves '+field);
  await db.exec('reset role');
  assert.equal((await db.query('select status from withdrawals')).rows[0].status, 'pending');
  await db.exec('set role anon');
  await assert.rejects(db.query('select configure_withdrawal_demo_token($1,true)', [withdrawal]), /permission denied/);
  await assert.rejects(db.query('select verify_withdrawal_demo_token($1,$2,$3)', [withdrawal, issued.generation, issued.code]), /permission denied/);
  await assert.rejects(db.query('select set_withdrawal_demo_status($1,$2)',[withdrawal,'completed']), /permission denied/);
  await db.close();
  console.log('PASS: migration executes; admin authorization, client isolation, private hash protection, write restrictions, wrong code, one-time use, regeneration, five-attempt lock, expiry, disabling, anonymous denial, and unchanged withdrawal status.');
}
main().catch(error => { console.error(error); process.exitCode=1; });
