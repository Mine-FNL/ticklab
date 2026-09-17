#!/usr/bin/env node
/**
 * Generate a CJS bundle from the ESM build by stripping ESM syntax.
 *
 * Why hand-rolled and not esbuild/rollup?
 *   - Zero dev deps beyond TypeScript.
 *   - The SDK is tiny (~3 source files). A text-rewrite of import/export
 *     statements is sufficient and matches the public exports map exactly.
 *   - Consumers using `require()` get a usable surface, but bundlers will
 *     still prefer the ESM build.
 *
 * Limitations:
 *   - No tree-shaking on the CJS side (you cannot with CJS). Consumers
 *     who care about size should use the `import` export condition.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const distDir = join(here, '..', 'dist');

if (!exists(distDir)) {
  console.error('[build-cjs] dist/ not found. Run `tsc -p tsconfig.json` first.');
  process.exit(1);
}

/** Parse the ESM index.js to learn which named export lives in which module. */
const indexSrc = readFileSync(join(distDir, 'index.js'), 'utf8');
const moduleForExport = new Map();
const reExportRe = /export\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?/g;
let m;
while ((m = reExportRe.exec(indexSrc)) !== null) {
  const list = m[1];
  const spec = m[2]; // e.g. './client.js'
  const cjsSpec = spec.replace(/\.js$/, '.cjs');
  for (const part of list.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const asMatch = trimmed.match(/^(.+?)\s+as\s+(.+)$/);
    const name = asMatch ? asMatch[2] : trimmed;
    moduleForExport.set(name, cjsSpec);
  }
}
// Also support `export { ... };` style re-exports (same regex above catches them).

/* Rewrite each ESM .js file into a .cjs sibling. */
const files = walk(distDir).filter((f) => f.endsWith('.js'));
let rewrote = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const out = toCjs(src, file, distDir);
  if (out !== src) {
    const target = file.replace(/\.js$/, '.cjs');
    writeFileSync(target, out);
    rewrote += 1;
  }
}

/* Aggregate all named exports into a single index.cjs barrel. */
const namedExports = Array.from(moduleForExport.keys()).sort();
const byModule = new Map();
for (const name of namedExports) {
  const spec = moduleForExport.get(name);
  if (!byModule.has(spec)) byModule.set(spec, []);
  byModule.get(spec).push(name);
}

const barrel = [
  "'use strict';",
  ...Array.from(byModule.entries()).map(([spec, names]) => {
    return `const { ${names.join(', ')} } = require('${spec}');`;
  }),
  ...namedExports.map((n) => `exports.${n} = ${n};`),
  '',
].join('\n');
writeFileSync(join(distDir, 'index.cjs'), barrel);
rewrote += 1;

console.log(`[build-cjs] rewrote ${rewrote} files in ${distDir}`);

/* -------------------------------------------------------------------------- */

function exists(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function toCjs(src, file, root) {
  let out = src;
  const exportedNames = [];

  // `import { a, b as c } from './x.js'` → `const { a, b: c } = require('./x.cjs')`
  out = out.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?/g,
    (_match, names, spec) => {
      const mapped = names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const asMatch = s.match(/^(.+?)\s+as\s+(.+)$/);
          return asMatch ? `${asMatch[1]}: ${asMatch[2]}` : s;
        })
        .join(', ');
      return `const { ${mapped} } = require('${rewriteSpec(spec)}');`;
    },
  );

  // `import foo from './x.js'` → `const foo = require('./x.cjs')`
  out = out.replace(
    /import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/g,
    (_match, name, spec) => {
      return `const ${name} = require('${rewriteSpec(spec)}');`;
    },
  );

  // `export const|let|var|function|class|async function NAME ...` → drop `export`,
  // record the name so we can add `exports.X = X` at the bottom.
  out = out.replace(
    /^export\s+(const|let|var|function|class|async\s+function)\s+(\w+)/gm,
    (_match, _kw, name) => {
      exportedNames.push(name);
      return `${_kw} ${name}`;
    },
  );

  // `export { a, b as c };`
  out = out.replace(
    /^export\s*\{([\s\S]*?)\}\s*;?$/gm,
    (_match, names) => {
      const lines = names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const asMatch = s.match(/^(.+?)\s+as\s+(.+)$/);
          const target = asMatch ? asMatch[2] : s;
          const source = asMatch ? asMatch[1] : s;
          exportedNames.push(target);
          return `exports.${target} = ${source};`;
        });
      return lines.join('\n');
    },
  );

  // `export default EXPR`
  out = out.replace(/^export\s+default\s+/m, 'module.exports = ');

  if (out !== src) {
    if (!out.startsWith("'use strict'") && !out.startsWith('"use strict"')) {
      out = "'use strict';\n" + out;
    }
    // Append `exports.X = X` for every `export class/function/const` we saw,
    // de-duplicated.
    const footer = Array.from(new Set(exportedNames))
      .filter((n) => n !== 'default')
      .map((n) => `exports.${n} = ${n};`)
      .join('\n');
    if (footer) out += '\n' + footer + '\n';
    return out;
  }
  return src;
}

function rewriteSpec(spec) {
  if (spec.endsWith('.js')) return spec.slice(0, -3) + '.cjs';
  return spec;
}