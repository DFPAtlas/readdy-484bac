const {test} = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(saved) {
  const scripts = new Map(); const cookies = [];
  const document = { getElementById: id => scripts.get(id), createElement: () => ({remove(){scripts.delete(this.id)}}), head: {appendChild: script => scripts.set(script.id,script)} };
  Object.defineProperty(document,'cookie',{get:()=> '_ga=old; _ga_GYTYP412SF=old; session=keep',set:v=>cookies.push(v)});
  const context={exports:{},window:{},localStorage:{getItem:()=>saved},document,location:{hostname:'quickguard.uk'},Date};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/cookie-consent.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
  return {...context,scripts,cookies,api:context.exports};
}
test('fresh, malformed, legacy and expired preferences fail closed',()=> {
  for(const value of [null,'bad',JSON.stringify({analytics:true}),JSON.stringify({version:2,necessary:true,analytics:true,marketing:false,functional:false,timestamp:'2020-01-01'})]) assert.equal(setup(value).api.readCookiePreferences(),null);
});
test('valid rejection is remembered without loading analytics',()=> {
  const c=setup(JSON.stringify({version:2,necessary:true,analytics:false,marketing:false,functional:false,timestamp:new Date().toISOString()}));
  assert.equal(c.api.readCookiePreferences().analytics,false);
  c.api.applyAnalyticsConsent(false); assert.equal(c.scripts.size,0); assert.equal(c.window['ga-disable-G-GYTYP412SF'],true);
});
test('accept loads once, withdrawal disables and clears analytics cookies, reaccept works',()=> {
  const c=setup(null); c.api.applyAnalyticsConsent(true); c.api.applyAnalyticsConsent(true);
  assert.equal(c.scripts.size,1); assert.match(c.scripts.get('quickguard-analytics').src,/G-GYTYP412SF/);
  c.api.applyAnalyticsConsent(false); assert.equal(c.scripts.size,0); assert.equal(c.window['ga-disable-G-GYTYP412SF'],true);
  assert.ok(c.cookies.some(v=>v.startsWith('_ga='))); assert.ok(!c.cookies.some(v=>v.startsWith('session=')));
  c.api.applyAnalyticsConsent(true); assert.equal(c.scripts.size,1); assert.equal(c.window['ga-disable-G-GYTYP412SF'],false);
});
