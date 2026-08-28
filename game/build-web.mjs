// Bundle the ES-module game into a single classic script (ironline.js).
// Plain <script src> — no importmap, no ES modules — so it runs on
// file:// origins and older Android WebViews.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2017'],
  outfile: join(here, 'ironline.js'),
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

const { statSync } = await import('node:fs');
console.log('ironline.js built:', (statSync(join(here, 'ironline.js')).size / 1024).toFixed(0), 'KB');
