const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loader,hooks,deferred,nodes,text,flush}=require('./helpers/finish-test-runtime.cjs');
for(const [name,helper]of [['DocumentImage','getDocumentSignedUrl'],['SIALicenceImage','getSIALicenceSignedUrl']]){
  function fixture(){const h=hooks(),pending=deferred();const Component=loader({react:h.react,'@/components/QuickGuardImage':{default:()=>null},'@/lib/supabase-storage':{[helper]:()=>pending.promise}})('components/'+name+'.tsx').default;return{h,pending,render:path=>h.render(Component,{path,label:'Synthetic document'})};}
  test(name+' displays loading before URL creation and renders the successful preview without a false error',async()=>{
    const f=fixture();let tree=f.render('owner/synthetic.png');assert.doesNotMatch(text(tree),/Failed to load/);assert.equal(nodes(tree).some(n=>[true,'true'].includes(n.props?.['aria-busy'])),true);await f.h.effects();f.pending.resolve('https://example.invalid/synthetic.png');await flush();tree=f.render('owner/synthetic.png');assert.equal(nodes(tree).some(n=>n.props?.src==='https://example.invalid/synthetic.png'),true);assert.doesNotMatch(text(tree),/Failed to load/);f.h.unmount();
  });
  test(name+' reports a real URL failure and does not update after unmount',async()=>{
    const f=fixture();f.render('owner/synthetic.png');await f.h.effects();f.pending.reject(Error('private provider detail'));await flush();assert.match(text(f.render('owner/synthetic.png')),/Failed to load/);f.h.unmount();
    const g=fixture();g.render('owner/other.png');await g.h.effects();g.h.unmount();const writes=g.h.writes;g.pending.resolve('https://example.invalid/private.png');await flush();assert.equal(g.h.writes,writes);
  });
  test(name+' without a path renders no preview or failure',()=>{const f=fixture();assert.equal(f.render(null),null);f.h.unmount();});
}
