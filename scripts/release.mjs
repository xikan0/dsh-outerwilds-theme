import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const PACKAGE = 'dsh-outerwilds-theme';
export const REPOSITORY = 'xikan0/dsh-outerwilds-theme';
const REGISTRY = 'https://registry.npmjs.org';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED_FILES = ['package.json', 'lib/client.js', 'lib/index.js', 'lib/native/outerwilds-audio.exe', 'lib/native/manifest.json', 'NATIVE-AUDIO.md', 'cordis.patch.yml', 'README.md', 'CHANGELOG.md', 'LICENSE'];
const ALLOWED_FILES = new Set([...REQUIRED_FILES, 'lib/index.js.map', 'FONTS.md', 'ARTWORK.md', 'docs/screenshots/preview.png', 'licenses/Jost-OFL.txt', 'licenses/SourceHanSans-OFL.txt', 'licenses/MinGW-w64-COPYING.txt', 'licenses/Zig-MIT.txt']);
const digest = (data, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(data).digest(encoding);
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const saveJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);

function command(executable, args, { capture = true } = {}) {
  return execFileSync(executable, args, { cwd: ROOT, maxBuffer: 40 * 1024 * 1024, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
}
function npm(args, options) {
  if (!process.env.npm_execpath) throw new Error('Run this script through npm run release:<command>.');
  return command(process.execPath, [process.env.npm_execpath, ...args], options);
}

export function stableVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '')) throw new Error('A stable x.y.z version is required.');
  const parts = version.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version components are too large.');
  return parts;
}
export function compareVersions(left, right) {
  const a = stableVersion(left), b = stableVersion(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
export function validateInput({ version, commit, reviewedClientSha256 = '' }, requireReview = false) {
  stableVersion(version);
  if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('The approved commit must be a full, lowercase Git SHA.');
  if ((requireReview || reviewedClientSha256) && !/^[a-f0-9]{64}$/.test(reviewedClientSha256)) throw new Error('A reviewed client SHA256 is required for publishing.');
}
export function validateFiles(files) {
  const paths = files.map((file) => typeof file === 'string' ? file : file.path);
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate package entries.');
  for (const path of paths) if (!ALLOWED_FILES.has(path)) throw new Error(`Unexpected package file: ${path}`);
  for (const path of REQUIRED_FILES) if (!paths.includes(path)) throw new Error(`Missing package file: ${path}`);
}
export function releaseNotes(changelog, version) {
  stableVersion(version);
  const lines = changelog.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => new RegExp(`^## ${version.replaceAll('.', '\\.')}($|[ \\u00b7])`).test(line));
  if (start < 0) throw new Error(`CHANGELOG has no section for ${version}.`);
  const next = lines.findIndex((line, index) => index > start && /^## /.test(line));
  const notes = lines.slice(start, next < 0 ? undefined : next).join('\n').trim();
  if (!notes.includes('验收')) throw new Error('Release notes must record the acceptance scope.');
  return `${notes}\n`;
}
export function registryDecision(manifest, metadata, latest) {
  if (latest && compareVersions(manifest.version, latest) < 0) throw new Error(`Refusing to release below npm latest ${latest}.`);
  if (!metadata) {
    if (latest && compareVersions(manifest.version, latest) === 0) throw new Error('npm latest exists but its version metadata is missing.');
    return 'publish';
  }
  if (metadata.name !== manifest.name || metadata.version !== manifest.version || metadata.dist?.integrity !== manifest.integrity || metadata.dist?.shasum !== manifest.shasum) throw new Error('This npm version already exists with a different package.');
  return 'resume';
}
export function assertPublishContext(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== REPOSITORY || env.RELEASE_PUBLISH !== 'true') throw new Error('Publishing is allowed only by an explicitly requested main-branch GitHub Actions run.');
}
function outputDirectory(output) {
  const sandbox = resolve(ROOT, '.sandbox');
  const directory = resolve(ROOT, output);
  const child = relative(sandbox, directory);
  if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error('Release output must be a child of the project .sandbox directory.');
  return directory;
}
async function options() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { version: { type: 'string' }, commit: { type: 'string' }, 'reviewed-client-sha256': { type: 'string' }, output: { type: 'string' } } });
  return {
    command: positionals[0], version: values.version ?? process.env.RELEASE_VERSION,
    commit: values.commit ?? process.env.RELEASE_APPROVED_SHA,
    reviewedClientSha256: values['reviewed-client-sha256'] ?? process.env.RELEASE_REVIEWED_CLIENT_SHA256 ?? '',
    directory: outputDirectory(values.output ?? process.env.RELEASE_OUTPUT ?? '.sandbox/release-automation'),
  };
}
async function validateSource(input) {
  validateInput(input, process.env.RELEASE_PUBLISH === 'true');
  const head = command('git', ['rev-parse', 'HEAD']).toString().trim();
  if (head !== input.commit || (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== head)) throw new Error('The source commit differs from the approved workflow commit.');
  if (command('git', ['status', '--porcelain', '--untracked-files=no']).toString().trim()) throw new Error('Commit tracked changes before preparing a release.');
  const pkg = await json(resolve(ROOT, 'package.json'));
  const lock = await json(resolve(ROOT, 'package-lock.json'));
  if (pkg.name !== PACKAGE || pkg.version !== input.version || lock.version !== input.version || lock.packages?.['']?.version !== input.version) throw new Error('Package name or package/lock versions do not match the requested release.');
  if (pkg.repository?.url !== `git+https://github.com/${REPOSITORY}.git`) throw new Error('The npm repository URL must match the trusted publisher repository.');
  releaseNotes(await readFile(resolve(ROOT, 'CHANGELOG.md'), 'utf8'), input.version);
}
async function prepare(input) {
  await validateSource(input);
  await mkdir(input.directory, { recursive: true });
  const filename = `${PACKAGE}-${input.version}.tgz`;
  if ((await readdir(input.directory)).length) throw new Error('Use a fresh output directory; existing release files are preserved.');
  npm(['run', 'build'], { capture: false });
  const packed = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', input.directory]).toString());
  const info = Array.isArray(packed) ? packed[0] : packed[PACKAGE];
  if (info?.name !== PACKAGE || info.version !== input.version || info.filename !== filename) throw new Error('Unexpected npm pack identity.');
  validateFiles(info.files);
  const tarball = await readFile(resolve(input.directory, filename));
  const notes = releaseNotes(await readFile(resolve(ROOT, 'CHANGELOG.md'), 'utf8'), input.version);
  const manifest = { schema: 1, name: PACKAGE, version: input.version, sourceCommit: input.commit, filename, sha256: digest(tarball), integrity: `sha512-${digest(tarball, 'sha512', 'base64')}`, shasum: digest(tarball, 'sha1'), clientSha256: digest(command('tar', ['-xOzf', resolve(input.directory, filename), 'package/lib/client.js'])), notesSha256: digest(notes), reviewedClientSha256: input.reviewedClientSha256 };
  if (info.integrity !== manifest.integrity || info.shasum !== manifest.shasum) throw new Error('npm pack metadata does not match the tarball.');
  if (input.reviewedClientSha256 && manifest.clientSha256 !== input.reviewedClientSha256) throw new Error('Built client differs from the reviewed Web client.');
  await writeFile(resolve(input.directory, 'release-notes.md'), notes);
  await writeFile(resolve(input.directory, 'SHA256SUMS.txt'), `${manifest.sha256}  ${filename}\n`);
  await saveJson(resolve(input.directory, 'manifest.json'), manifest);
  await validateArtifact(input.directory, input);
  console.log(`Prepared ${PACKAGE}@${input.version}; client SHA256 ${manifest.clientSha256}`);
}
export async function validateArtifact(directory, input) {
  const manifest = await json(resolve(directory, 'manifest.json'));
  validateInput(input);
  if (manifest.schema !== 1 || manifest.name !== PACKAGE || manifest.version !== input.version || manifest.sourceCommit !== input.commit || manifest.filename !== `${PACKAGE}-${input.version}.tgz`) throw new Error('Artifact identity differs from the approved release.');
  const file = resolve(directory, manifest.filename);
  const data = await readFile(file);
  if (digest(data) !== manifest.sha256 || `sha512-${digest(data, 'sha512', 'base64')}` !== manifest.integrity || digest(data, 'sha1') !== manifest.shasum) throw new Error('Release tarball checksum mismatch.');
  const entries = command('tar', ['-tzf', file]).toString().trim().split(/\r?\n/).filter((entry) => !entry.endsWith('/'));
  if (entries.some((entry) => !entry.startsWith('package/'))) throw new Error('Unexpected archive root.');
  validateFiles(entries.map((entry) => entry.slice('package/'.length)));
  const pkg = JSON.parse(command('tar', ['-xOzf', file, 'package/package.json']).toString());
  if (pkg.name !== PACKAGE || pkg.version !== input.version || pkg.repository?.url !== `git+https://github.com/${REPOSITORY}.git`) throw new Error('Packed package identity does not match.');
  const clientHash = digest(command('tar', ['-xOzf', file, 'package/lib/client.js']));
  if (clientHash !== manifest.clientSha256 || (input.reviewedClientSha256 && clientHash !== input.reviewedClientSha256)) throw new Error('Packed client differs from the reviewed client.');
  const notes = await readFile(resolve(directory, 'release-notes.md'));
  if (digest(notes) !== manifest.notesSha256) throw new Error('Release notes checksum mismatch.');
  const sums = await readFile(resolve(directory, 'SHA256SUMS.txt'), 'utf8');
  if (sums.trim() !== `${manifest.sha256}  ${manifest.filename}`) throw new Error('SHA256SUMS does not match the artifact.');
  return manifest;
}
async function requestJson(url, allowMissing = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'Cache-Control': 'no-cache' } });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`Registry request failed with HTTP ${response.status}.`);
  return response.json();
}
async function registryState(manifest) {
  const metadata = await requestJson(`${REGISTRY}/${PACKAGE}/${manifest.version}`, true);
  const tags = await requestJson(`${REGISTRY}/-/package/${PACKAGE}/dist-tags`);
  return { metadata, latest: tags.latest };
}
function remoteTag(version) {
  const ref = `refs/tags/${version}`;
  const rows = command('git', ['ls-remote', '--tags', 'origin', ref, `${ref}^{}`]).toString().trim().split(/\r?\n/).filter(Boolean).map((line) => line.split(/\s+/));
  return rows.find((row) => row[1] === `${ref}^{}`)?.[0] ?? rows.find((row) => row[1] === ref)?.[0] ?? null;
}
async function preflight(input) {
  await validateSource(input);
  const manifest = await validateArtifact(input.directory, input);
  const state = await registryState(manifest);
  const tagCommit = remoteTag(manifest.version);
  const publishing = process.env.RELEASE_PUBLISH === 'true';
  let decision = 'preview';
  if (publishing) {
    assertPublishContext(process.env);
    decision = registryDecision(manifest, state.metadata, state.latest);
    if (tagCommit && tagCommit !== manifest.sourceCommit) throw new Error('The remote release tag points to a different commit.');
  }
  if (!state.metadata) npm(['publish', resolve(input.directory, manifest.filename), '--dry-run', '--ignore-scripts', '--access', 'public', '--tag', 'latest', '--registry', REGISTRY], { capture: false });
  else console.log('npm version already exists; skipping its publish dry-run. Artifact checks have passed.');
  await saveJson(resolve(input.directory, 'preflight.json'), { mode: decision, npmVersionExists: !!state.metadata, npmDryRunPerformed: !state.metadata, npmLatest: state.latest, tagCommit, requestedCommit: input.commit });
  console.log(publishing ? `Preflight passed: ${decision}.` : 'Preview passed; no version, tag or release was published.');
}
async function waitForNpm(manifest) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const state = await registryState(manifest);
    if (state.metadata) {
      registryDecision(manifest, state.metadata, state.latest);
      if (state.latest === manifest.version) return state.metadata;
    }
    await new Promise((done) => setTimeout(done, 15_000));
  }
  throw new Error('npm processing did not finish within five minutes; check the registry before retrying.');
}
async function downloadHash(url, expectedOrigin) {
  const uri = new URL(url);
  if (uri.protocol !== 'https:' || uri.hostname !== expectedOrigin) throw new Error('Unexpected download origin.');
  const response = await fetch(uri, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`);
  return digest(Buffer.from(await response.arrayBuffer()));
}
function releaseView(version) {
  const result = command('gh', ['api', `repos/${REPOSITORY}/releases/tags/${version}`]).toString();
  return JSON.parse(result);
}
async function publish(input) {
  assertPublishContext(process.env);
  await validateSource(input);
  const manifest = await validateArtifact(input.directory, input);
  const state = await registryState(manifest);
  const decision = registryDecision(manifest, state.metadata, state.latest);
  const tagCommit = remoteTag(manifest.version);
  if (tagCommit && tagCommit !== manifest.sourceCommit) throw new Error('The remote release tag points to a different commit.');
  const resultPath = resolve(input.directory, 'publication.json');
  const result = { version: manifest.version, sourceCommit: manifest.sourceCommit, sha256: manifest.sha256, npmSubmitted: decision === 'resume', npmVerified: false, githubVerified: false };
  await saveJson(resultPath, result);
  if (decision === 'publish') {
    npm(['publish', resolve(input.directory, manifest.filename), '--ignore-scripts', '--access', 'public', '--tag', 'latest', '--registry', REGISTRY, '--loglevel', 'verbose'], { capture: false });
    result.npmSubmitted = true;
    await saveJson(resultPath, result);
  } else console.log('npm already contains this exact package; completing remaining steps.');
  const published = await waitForNpm(manifest);
  if (await downloadHash(published.dist.tarball, 'registry.npmjs.org') !== manifest.sha256) throw new Error('Downloaded npm package checksum mismatch.');
  result.npmVerified = true;
  await saveJson(resultPath, result);
  if (!tagCommit) {
    command('git', ['tag', '-a', manifest.version, manifest.sourceCommit, '-m', `Release ${PACKAGE} ${manifest.version}`]);
    command('git', ['push', 'origin', `refs/tags/${manifest.version}`], { capture: false });
  }
  let release;
  try { release = releaseView(manifest.version); }
  catch (error) {
    if (!error.stderr?.toString().includes('HTTP 404')) throw error;
  }
  const notesFile = resolve(input.directory, 'release-notes.md');
  const assetNames = [manifest.filename, 'SHA256SUMS.txt'];
  if (!release) {
    command('gh', ['release', 'create', manifest.version, ...assetNames.map((name) => resolve(input.directory, name)), '--repo', REPOSITORY, '--verify-tag', '--title', `${PACKAGE} ${manifest.version}`, '--notes-file', notesFile, '--latest'], { capture: false });
  } else {
    if (release.draft || release.prerelease || release.body?.trim() !== (await readFile(notesFile, 'utf8')).trim()) throw new Error('Existing GitHub release differs from the prepared release.');
    for (const name of assetNames) {
      const asset = release.assets.find((entry) => entry.name === name);
      const expected = `sha256:${digest(await readFile(resolve(input.directory, name)))}`;
      if (asset && asset.digest !== expected) throw new Error(`Existing GitHub asset differs: ${name}`);
      if (!asset) command('gh', ['release', 'upload', manifest.version, resolve(input.directory, name), '--repo', REPOSITORY], { capture: false });
    }
  }
  release = releaseView(manifest.version);
  if (remoteTag(manifest.version) !== manifest.sourceCommit || release.draft || release.prerelease) throw new Error('GitHub tag or release state differs from the approved release.');
  for (const name of assetNames) {
    const asset = release.assets.find((entry) => entry.name === name);
    const expected = digest(await readFile(resolve(input.directory, name)));
    if (!asset || asset.digest !== `sha256:${expected}` || await downloadHash(asset.browser_download_url, 'github.com') !== expected) throw new Error(`GitHub downloaded asset checksum mismatch: ${name}`);
  }
  result.githubVerified = true;
  result.githubRelease = release.html_url;
  result.npmPackage = `https://www.npmjs.com/package/${PACKAGE}/v/${manifest.version}`;
  await saveJson(resultPath, result);
  console.log(`Published and verified ${PACKAGE}@${manifest.version}.`);
}
async function main() {
  const input = await options();
  if (input.command === 'validate') await validateSource(input);
  else if (input.command === 'prepare') await prepare(input);
  else if (input.command === 'preflight') await preflight(input);
  else if (input.command === 'publish') await publish(input);
  else throw new Error('Expected validate, prepare, preflight or publish.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`Release failed: ${error.message}`); process.exitCode = 1; });
}
