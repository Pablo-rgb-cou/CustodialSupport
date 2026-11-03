/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const brand = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync('lib/server/email-brand.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(brand.exports);
assert.equal(brand.exports.escapeEmailHtml('<img src="x">&'), '&lt;img src=&quot;x&quot;&gt;&amp;');
const manifest = JSON.parse(fs.readFileSync('supabase/templates/manifest.json', 'utf8'));
assert.equal(manifest.length, 13);
for (const entry of manifest) {
  const html = fs.readFileSync('supabase/templates/' + entry.file, 'utf8');
  assert(html.includes('name="color-scheme" content="dark"'));
  assert(html.includes('bgcolor="#061321"'));
  assert(html.includes('linear-gradient(#061321,#061321)'));
  assert(html.includes('#49e2e9') && html.includes('#65edd0'));
  assert(html.includes('support@custodialmanagement.net'));
  assert(!html.includes('<script'));
  if (['confirm-signup.html', 'reauthentication.html'].includes(entry.file)) assert(html.includes('{{ .Token }}'));
  if (['reset-password.html', 'invite-user.html', 'magic-link.html', 'change-email.html'].includes(entry.file)) assert(html.includes('href="{{ .ConfirmationURL }}"'));
}
console.log('PASS: all 13 branded templates preserve action/code placeholders, dark backgrounds, cyan/mint accents and support address; dynamic HTML escaping verified.');
