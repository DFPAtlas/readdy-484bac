const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function loader(mocks={},globals={}){
 const cache=new Map();
 const load=file=>{const absolute=path.resolve(file);if(cache.has(absolute))return cache.get(absolute).exports;const m={exports:{}};cache.set(absolute,m);
  const local=name=>{
   if(Object.hasOwn(mocks,name))return mocks[name];
   if(name.startsWith('.')||name.startsWith('@/')){
    const target=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(absolute),name);
    const found=[target,target+'.ts',target+'.tsx',target+'.cjs',target+'/index.ts'].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());
    if(found)return load(found);
   }
   return require(name);
  };
  new Function('module','exports','require',...Object.keys(globals),compile(fs.readFileSync(absolute,'utf8')))(m,m.exports,local,...Object.values(globals));return m.exports;
 };return load;
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=async()=>{for(let n=0;n<80;n++)await Promise.resolve();};
function hooks(){
 const slots=[],effects=[],pending=[];let cursor=0,writes=0;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((x,n)=>Object.is(x,b[n]));
 const react={...React,useState(initial){const n=cursor++;if(!(n in slots))slots[n]=typeof initial==='function'?initial():initial;return[slots[n],value=>{writes++;slots[n]=typeof value==='function'?value(slots[n]):value;}];},useRef(initial){const n=cursor++;if(!(n in slots))slots[n]={current:initial};return slots[n];},useCallback(fn,deps){const n=cursor++;if(!slots[n]||!same(slots[n].deps,deps))slots[n]={fn,deps};return slots[n].fn;},useEffect(fn,deps){const n=cursor++;if(!effects[n]||!same(effects[n].deps,deps))pending.push(()=>{effects[n]?.cleanup?.();effects[n]={deps,cleanup:fn()};});}};
 return{react,get writes(){return writes;},render(fn,props){cursor=0;return fn(props);},async effects(){pending.splice(0).forEach(fn=>fn());await flush();},unmount(){effects.forEach(e=>e?.cleanup?.());}};
}
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function text(tree){return Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?text(tree.props?.children):tree==null||typeof tree==='boolean'?'':String(tree);}
module.exports={loader,hooks,deferred,flush,nodes,text};
