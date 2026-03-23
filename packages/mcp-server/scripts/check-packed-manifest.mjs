import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orderfood-pack-check-'));
const packDir = path.join(tempDir, 'pack');
const cacheDir = path.join(tempDir, 'npm-cache');

fs.mkdirSync(packDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const importPattern = /(?:from\s+['"]@orderfood\/|import\(\s*['"]@orderfood\/|require\(\s*['"]@orderfood\/)/;

function extractFile(tarballPath, archivePath) {
  return execFileSync('tar', ['-xOf', tarballPath, archivePath], {
    cwd: packageDir,
    encoding: 'utf8',
  });
}

try {
  const packJson = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', packDir, '--cache', cacheDir],
    {
      cwd: packageDir,
      encoding: 'utf8',
    },
  );
  const [{ filename }] = JSON.parse(packJson);
  const tarballPath = path.join(packDir, filename);
  const packedPackage = JSON.parse(extractFile(tarballPath, 'package/package.json'));

  const leakedDependencies = ['dependencies', 'optionalDependencies', 'peerDependencies']
    .flatMap((field) =>
      Object.entries(packedPackage[field] ?? {})
        .filter(([name]) => name.startsWith('@orderfood/'))
        .map(([name, version]) => `${field}:${name}@${version}`),
    );

  if (leakedDependencies.length > 0) {
    throw new Error(
      `Packed manifest leaks internal workspace packages as runtime dependencies: ${leakedDependencies.join(', ')}`,
    );
  }

  for (const archivePath of ['package/dist/index.js', 'package/dist/setup.js']) {
    const bundledFile = extractFile(tarballPath, archivePath);
    if (importPattern.test(bundledFile)) {
      throw new Error(`Packed artifact still imports @orderfood/* modules: ${archivePath}`);
    }
  }

  console.log('Packed npm artifact has no leaked @orderfood/* runtime dependencies or imports.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
