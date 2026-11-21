const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const resolve = name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file), name);
      const target = [base, base + '.ts', base + '.tsx', base + '.cjs'].find(value => fs.existsSync(value) && fs.statSync(value).isFile());
      if (!target) throw new Error('Missing test import ' + name + ' from ' + file);
      return target.endsWith('.cjs') ? require(path.resolve(target)) : load(target, mocks, globals);
    }
    return require(name);
  };
  new Function('module', 'exports', 'require', ...Object.keys(globals), code)(module, module.exports, resolve, ...Object.values(globals));
  return module.exports;
}
module.exports = { load };
