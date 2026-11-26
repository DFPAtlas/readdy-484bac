const {test}=require('node:test'),assert=require('node:assert/strict');
const {loader,hooks,nodes}=require('./helpers/finish-test-runtime.cjs');
test('all guard document inputs reject files exceeding the private bucket limit before preview or upload',()=>{
  for(const index of [0,1,2]){const h=hooks(),errors=[],files=[],previews=[];const Component=loader({react:h.react,'@/components/QuickGuardImage':{default:()=>null}},{URL:{createObjectURL(file){previews.push(file);return'blob:synthetic';}}})('components/GuardDocumentsUploader.tsx').default;const tree=h.render(Component,{drivingFrontFile:null,drivingBackFile:null,proofOfAddressFile:null,drivingFrontPreview:'',drivingBackPreview:'',proofOfAddressPreview:'',error:'',onError:e=>errors.push(e),onDrivingFrontChange:f=>files.push(f),onDrivingBackChange:f=>files.push(f),onProofOfAddressChange:f=>files.push(f)});const inputs=nodes(tree).filter(n=>n.type==='input'&&n.props.type==='file');assert.equal(inputs.length,3);const change=inputs[index].props.onChange;
    change({target:{files:[{name:'synthetic.png',type:'image/png',size:5*1024*1024+1}]}});assert.match(errors.at(-1),/5MB/);assert.equal(files.length,0);assert.equal(previews.length,0);
    change({target:{files:[{name:'synthetic.png',type:'image/png',size:5*1024*1024}]}});assert.equal(errors.at(-1),'');assert.equal(files.length,1);assert.equal(previews.length,1);h.unmount();
  }
});
