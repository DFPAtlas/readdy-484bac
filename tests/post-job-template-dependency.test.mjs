import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('URL templates and sites apply once across list refreshes and reapply for a new selection',()=>{
 const source=fs.readFileSync('app/client/post-job/page.tsx','utf8');
 const body=source.slice(source.indexOf('  const appliedUrlTemplateRef'),source.indexOf('  const saveTemplate'));
 const refs=[],calls=[];let cursor=0;const params=new Map([['template','one'],['site','site']]);
 const js=ts.transpileModule(body,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const render=(clientId,templates,savedSites)=>{cursor=0;const env={clientId,templates,savedSites,searchParams:{get:key=>params.get(key)},useRef:value=>{const i=cursor++;return refs[i]??(refs[i]={current:value})},useEffect:fn=>fn(),loadTemplate:t=>calls.push(['template',t.id]),applySavedSite:s=>calls.push(['site',s.id]),setStartFrom:()=>{}};new Function(...Object.keys(env),js)(...Object.values(env));};
 render('client',[],[]);assert.equal(calls.length,0);
 render('client',[{id:'one'}],[{id:'site'}]);assert.equal(calls.length,2);
 render('client',[{id:'one',use_count:2}],[{id:'site'}]);assert.equal(calls.length,2,'list refresh must preserve edits');
 params.set('template','two');render('client',[{id:'two'}],[{id:'site'}]);assert.deepEqual(calls.at(-1),['template','two']);
 render('other-client',[{id:'two'}],[{id:'site'}]);assert.equal(calls.length,5);
});
