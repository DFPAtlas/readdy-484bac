// Check the Edge handler with real installed Supabase types. The remote pinned
// import is resolved to its installed package; only Deno's two used globals are declared.
const ts=require('typescript'),path=require('node:path');const cwd=process.cwd(),files=['guest-booking','send-job-posted-email'].map(name=>path.join(cwd,'supabase/functions',name,'index.ts'));
const options={noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowImportingTsExtensions:true,lib:['lib.es2022.d.ts','lib.dom.d.ts'],types:[]};
const host=ts.createCompilerHost(options),read=host.getSourceFile.bind(host);
host.getSourceFile=(name,version,...rest)=>{if(files.includes(name)){const code=ts.sys.readFile(name).replace("from 'https://esm.sh/@supabase/supabase-js@2.39.3'","from '@supabase/supabase-js'").replace("import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';","declare function serve(handler:(req:Request)=>Promise<Response>):void;");return ts.createSourceFile(name,"declare const Deno:{serve:(handler:(req:Request)=>Promise<Response>)=>void;env:{get:(name:string)=>string|undefined}};\n"+code,version,true);}return read(name,version,...rest);};
const errors=ts.getPreEmitDiagnostics(ts.createProgram(files,options,host));
if(errors.length){console.error(ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>cwd,getNewLine:()=> '\n'}));process.exitCode=1;}else console.log('Guest booking and job confirmation Edge handlers strict TypeScript passed.');
