import esbuild from 'esbuild';
import fs from 'node:fs';

// Clean entire dist before bundling
if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true });

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'bundle',
  // node-machine-id has native bindings — keep external, it's a real runtime dep
  external: ['node:*', 'node-machine-id'],
};

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.js',
  }),
  esbuild.build({
    ...shared,
    entryPoints: ['src/setup.ts'],
    outfile: 'dist/setup.js',
    // shebang already in setup.ts line 1
  }),
]);

console.log('bundled dist/index.js and dist/setup.js');
