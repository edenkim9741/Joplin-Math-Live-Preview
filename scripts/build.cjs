const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const tar = require('tar');
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

function requireFiles(directory, files, label) {
  const missing = files.filter((file) => {
    try {
      return !fs.statSync(path.join(directory, file)).isFile();
    } catch {
      return true;
    }
  });
  if (missing.length) {
    throw new Error(`${label} is missing required file(s): ${missing.join(', ')}`);
  }
}

requireFiles(src, ['manifest.json', 'index.js', 'contentScript.js', 'math-live-preview.css'], 'Source');
requireFiles(path.join(root, 'api'), ['index.js'], 'Joplin API bridge');
const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
if (manifest.main !== 'index.js') {
  throw new Error('src/manifest.json must set "main" to "index.js".');
}

const katex = path.join(root, 'node_modules', 'katex', 'dist');
requireFiles(katex, ['katex.min.css'], 'KaTeX distribution');
requireFiles(path.join(katex, 'fonts'), ['KaTeX_Main-Regular.woff2'], 'KaTeX fonts');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
async function main() {
  const common = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'es2020',
    logLevel: 'info',
    alias: { api: path.join(root, 'api', 'index.js') },
    external: ['api/*', '@codemirror/*', '@lezer/*'],
  };
  await esbuild.build({ ...common, entryPoints: [path.join(src, 'index.js')], outfile: path.join(dist, 'index.js') });
  await esbuild.build({ ...common, entryPoints: [path.join(src, 'contentScript.js')], outfile: path.join(dist, 'contentScript.js') });
  for (const name of ['manifest.json', 'math-live-preview.css']) fs.copyFileSync(path.join(src, name), path.join(dist, name));
  fs.copyFileSync(path.join(katex, 'katex.min.css'), path.join(dist, 'katex.min.css'));
  fs.cpSync(path.join(katex, 'fonts'), path.join(dist, 'fonts'), { recursive: true });

  const mainBundle = fs.readFileSync(path.join(dist, manifest.main), 'utf8');
  if (/require\(["']api["']\)/.test(mainBundle)) {
    throw new Error('The main bundle still requires Joplin API as an unresolved "api" module.');
  }

  requireFiles(dist, [
    'manifest.json',
    'index.js',
    'contentScript.js',
    'math-live-preview.css',
    'katex.min.css',
    'fonts/KaTeX_Main-Regular.woff2',
  ], 'Build output');

  const out = path.join(root, 'com.example.joplin-math-live-preview.jpl');
  const entries = fs.readdirSync(dist);
  if (entries.length === 0) throw new Error('Build output is empty; refusing to create a plugin archive.');
  await tar.create({ cwd: dist, file: out, portable: true, noMtime: true }, entries);
  console.log(`Built ${out}`);
}
main().catch(err => { console.error(err); process.exitCode = 1; });
