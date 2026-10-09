import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PACKAGE, REPOSITORY, stableVersion, compareVersions, validateInput, validateFiles, releaseNotes, registryDecision, assertPublishContext, validateArtifact } from '../scripts/release.mjs';

const commit = 'a'.repeat(40);
const hash = (value, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(value).digest(encoding);
const files = ['package.json', 'lib/client.js', 'lib/index.js', 'cordis.patch.yml', 'README.md', 'CHANGELOG.md', 'LICENSE'];
const input = { version: '0.1.3', commit };

test('release inputs reject prereleases, command text, branch aliases and incomplete review evidence', () => {
  assert.deepEqual(stableVersion('0.1.3'), [0, 1, 3]);
  for (const version of ['0.1.3-beta.1', '01.2.3', '1.2.3;echo unsafe', 'v1.2.3']) assert.throws(() => validateInput({ version, commit }));
  assert.throws(() => validateInput({ ...input, commit: 'main' }));
  assert.throws(() => validateInput(input, true), /reviewed client/);
  validateInput({ ...input, reviewedClientSha256: 'b'.repeat(64) }, true);
});
test('release ordering compares semantic versions numerically and prevents downgrades', () => {
  assert.equal(compareVersions('0.1.10', '0.1.9'), 1);
  assert.equal(compareVersions('0.2.0', '0.1.99'), 1);
  assert.throws(() => registryDecision({ version: '0.1.3' }, null, '0.2.0'), /below npm latest/);
});
test('package validation excludes credentials, source and archive traversal', () => {
  validateFiles(files);
  for (const extra of ['.npmrc', 'src/client.tsx', '../package.json', 'licenses/secret.txt']) assert.throws(() => validateFiles([...files, extra]), /Unexpected/);
  assert.throws(() => validateFiles(files.slice(1)), /Missing/);
  assert.throws(() => validateFiles([...files, 'LICENSE']), /Duplicate/);
});
test('release notes select only the intended Chinese acceptance section', () => {
  const notes = '# 更新记录\r\n\r\n## 0.1.30 · 新版本\r\n验收：其他版本\r\n\r\n## 0.1.3 · 2026-10-09\r\n- 修复\r\n验收：Web 已通过\r\n\r\n## 0.1.2 · 旧版本\r\n验收：旧版\r\n';
  assert.equal(releaseNotes(notes, '0.1.3'), '## 0.1.3 · 2026-10-09\n- 修复\n验收：Web 已通过\n');
  assert.throws(() => releaseNotes('## 0.1.3\n- 修复', '0.1.3'), /acceptance/);
  assert.throws(() => releaseNotes(notes, '0.1.4'), /no section/);
});
test('an existing identical npm version resumes instead of publishing again', () => {
  const manifest = { name: PACKAGE, version: '0.1.3', integrity: 'sha512-test', shasum: 'test' };
  const metadata = { name: PACKAGE, version: '0.1.3', dist: { integrity: 'sha512-test', shasum: 'test' } };
  assert.equal(registryDecision(manifest, null, '0.1.2'), 'publish');
  assert.equal(registryDecision(manifest, metadata, '0.1.3'), 'resume');
  assert.throws(() => registryDecision(manifest, { ...metadata, dist: { ...metadata.dist, integrity: 'different' } }, '0.1.3'), /different package/);
  assert.throws(() => registryDecision(manifest, null, '0.1.3'), /metadata is missing/);
});
test('publishing requires explicit authorization on the intended main-branch workflow', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: REPOSITORY, RELEASE_PUBLISH: 'true' };
  assertPublishContext(env);
  for (const [key, value] of [['GITHUB_ACTIONS', 'false'], ['GITHUB_EVENT_NAME', 'pull_request'], ['GITHUB_REF', 'refs/heads/test'], ['GITHUB_REPOSITORY', 'someone/fork'], ['RELEASE_PUBLISH', 'false']]) assert.throws(() => assertPublishContext({ ...env, [key]: value }));
});

async function fixture() {
  await mkdir('.sandbox', { recursive: true });
  const directory = await mkdtemp(resolve('.sandbox', 'release-tests-'));
  const source = resolve(directory, 'source');
  const pkg = { name: PACKAGE, version: input.version, repository: { url: `git+https://github.com/${REPOSITORY}.git` } };
  const client = 'window.syntheticReviewedClient = true;\n';
  for (const file of files) {
    const destination = resolve(source, 'package', file);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, file === 'package.json' ? JSON.stringify(pkg) : file === 'lib/client.js' ? client : 'synthetic fixture\n');
  }
  const filename = `${PACKAGE}-${input.version}.tgz`;
  execFileSync('tar', ['-czf', resolve(directory, filename), '-C', source, 'package']);
  const data = await readFile(resolve(directory, filename));
  const notes = '## 0.1.3\n验收：固定测试数据\n';
  const manifest = { schema: 1, name: PACKAGE, version: input.version, sourceCommit: commit, filename, sha256: hash(data), integrity: `sha512-${hash(data, 'sha512', 'base64')}`, shasum: hash(data, 'sha1'), clientSha256: hash(client), notesSha256: hash(notes) };
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(resolve(directory, 'release-notes.md'), notes);
  await writeFile(resolve(directory, 'SHA256SUMS.txt'), `${manifest.sha256}  ${filename}\n`);
  return { directory, manifest };
}
test('the prepared archive is independently checked against the approved client', async () => {
  const { directory, manifest } = await fixture();
  assert.equal((await validateArtifact(directory, { ...input, reviewedClientSha256: manifest.clientSha256 })).sha256, manifest.sha256);
  await assert.rejects(validateArtifact(directory, { ...input, reviewedClientSha256: '0'.repeat(64) }), /reviewed client/);
});
test('tampered archive bytes are rejected before publication', async () => {
  const { directory, manifest } = await fixture();
  await writeFile(resolve(directory, manifest.filename), 'replaced package');
  await assert.rejects(validateArtifact(directory, input), /checksum mismatch/);
});
test('artifacts cannot be reused for a different commit or version', async () => {
  const { directory } = await fixture();
  await assert.rejects(validateArtifact(directory, { ...input, commit: 'b'.repeat(40) }), /identity/);
  await assert.rejects(validateArtifact(directory, { ...input, version: '0.1.4' }), /identity/);
});
test('modified release notes or checksum files invalidate the artifact', async () => {
  const first = await fixture();
  await writeFile(resolve(first.directory, 'release-notes.md'), 'unreviewed notes');
  await assert.rejects(validateArtifact(first.directory, input), /notes checksum/);
  const second = await fixture();
  await writeFile(resolve(second.directory, 'SHA256SUMS.txt'), 'incorrect');
  await assert.rejects(validateArtifact(second.directory, input), /SHA256SUMS/);
});
