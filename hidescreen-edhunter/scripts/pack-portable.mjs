import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const outDir = path.join(root, 'src-edhunter', 'target', 'release', 'bundle', 'portable');
mkdirSync(outDir, { recursive: true });

if (process.platform === 'win32') {
  const result = spawnSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', 'pack-portable.ps1')],
    { stdio: 'inherit' },
  );
  process.exit(result.status ?? 1);
}

if (process.platform === 'darwin') {
  const macosDir = path.join(root, 'src-edhunter', 'target', 'release', 'bundle', 'macos');
  const apps = existsSync(macosDir)
    ? readdirSync(macosDir).filter((name) => name.endsWith('.app'))
    : [];
  if (apps.length !== 1) {
    console.error('Release app not found. Run npm run tauri:build first.');
    process.exit(1);
  }
  const app = path.join(macosDir, apps[0]);
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
  const zip = path.join(outDir, `BestPerformance_${version}_${arch}-portable.zip`);
  if (existsSync(zip)) rmSync(zip);
  const result = spawnSync('ditto', ['-c', '-k', '--keepParent', app, zip], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(zip);
  process.exit(0);
}

console.error('Portable packaging is implemented for Windows and macOS.');
process.exit(1);
