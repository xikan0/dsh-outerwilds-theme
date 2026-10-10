import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const zig = process.env.OUTERWILDS_ZIG ?? resolve('.sandbox/tools/zig-x86_64-windows-0.15.2/zig.exe');
const directory = resolve('native/bin');
await mkdir(directory, { recursive: true });
await mkdir('.sandbox/zig-cache', { recursive: true });
const version = execFileSync(zig, ['version'], { encoding: 'utf8' }).trim();
if (version !== '0.15.2') throw new Error(`Expected Zig 0.15.2, got ${version}`);
execFileSync(zig, ['cc', '-target', 'x86_64-windows-gnu', '-std=c17', '-Os', '-s', '-Wall', '-Wextra', 'native/loopback.c', '-lole32', '-luuid', '-o', resolve(directory, 'outerwilds-audio.exe')], {
  stdio: 'inherit', env: { ...process.env, ZIG_GLOBAL_CACHE_DIR: resolve('.sandbox/zig-cache'), ZIG_LOCAL_CACHE_DIR: resolve('.sandbox/zig-local-cache') },
});
const hash = data => createHash('sha256').update(data).digest('hex');
const binary = await readFile(resolve(directory, 'outerwilds-audio.exe'));
await writeFile(resolve(directory, 'manifest.json'), JSON.stringify({ protocol: 1, platform: 'win32', arch: 'x64', compiler: `Zig ${version}`, sourceSha256: hash(await readFile('native/loopback.c')), binarySha256: hash(binary), bytes: binary.length }, null, 2) + '\n');
console.log(`Built Windows x64 audio component: ${binary.length} bytes`);
