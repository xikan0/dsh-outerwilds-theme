import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

await mkdir('.sandbox/test/native-audio', { recursive: true });
for (const entry of ['native-host', 'host-input', 'sidebar-session', 'analysis']) {
  const result = await build({ entryPoints: [`src/audio-wave/${entry}.ts`], outdir: '.sandbox/test/native-audio', bundle: true, platform: 'node', format: 'esm', write: false });
  for (const file of result.outputFiles) await writeFile(file.path, file.contents);
}
const moduleAt = name => import(pathToFileURL(resolve(`.sandbox/test/native-audio/${name}.js`)));
const { NativeAudioHost } = await moduleAt('native-host');
const { HostAudioInput } = await moduleAt('host-input');
const { createSidebarAudio } = await moduleAt('sidebar-session');
const { frameFromPowers, readSpectrum } = await moduleAt('analysis');
const hostBuild = await build({ entryPoints: ['src/index.ts'], outfile: '.sandbox/test/native-audio/host-entry.js', bundle: true, platform: 'node', format: 'esm', external: ['@deepseek-ai/schemastery'], write: false });
await writeFile(hostBuild.outputFiles[0].path, hostBuild.outputFiles[0].contents);
const { apply: applyHost } = await moduleAt('host-entry');
const a = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const tone = { type: 'frame', sampleRate: 48000, rms: .1, peak: .2, powers: [.001, 0, 0, 0, 0, 0] };
function fakeChild() {
  const child = new EventEmitter();
  Object.assign(child, { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null,
    kill() { this.exitCode = 1; this.emit('exit', 1); } });
  child.stdin.on('finish', () => { child.exitCode = 0; child.emit('exit', 0); });
  return child;
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('host API routes use the authenticated api namespace and validate RPC envelopes before capture', async () => {
  const routes = [], cleanups = [];
  const ctx = { fiber: {}, inject(names, callback) { if (names.includes('connection')) callback(this); },
    effect(callback) { cleanups.push(callback()); }, connection: { fetch: { register(route) { routes.push(route); } } } };
  const ref = value => ({ get: () => value });
  applyHost(ctx, { enabled: ref(true), audioAuto: ref(false) });
  try {
    assert.deepEqual(routes.map(r => r.path), ['/api/outerwilds-audio/read', '/api/outerwilds-audio/release']);
    const request = body => new Request('http://localhost/api/outerwilds-audio/read', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body) });
    const envelope = { type:'client-request', rpcId:a, method:'outerwilds-audio/read', payload:{session:a} };
    const response = await routes[0].fetch(request(envelope));
    assert.equal((await response.json()).result.value.phase, 'disabled');
    assert.equal((await routes[0].fetch(request({...envelope,method:'other'}))).status,400);
    assert.equal((await routes[0].fetch(request({...envelope,payload:{session:'bad'}}))).status,200);
    assert.equal((await routes[0].fetch(new Request('http://localhost',{method:'POST',body:'{}'}))).status,415);
  } finally { cleanups.filter(Boolean).reverse().forEach(fn=>fn()); }
});

test('native package records the exact compiled source and binary; generated tones isolate six bands', async () => {
  const manifest = JSON.parse(await readFile('native/bin/manifest.json', 'utf8'));
  const hash = value => createHash('sha256').update(value).digest('hex');
  const source = await readFile('native/loopback.c');
  const binary = await readFile('native/bin/outerwilds-audio.exe');
  assert.equal(hash(source), manifest.sourceSha256); assert.equal(hash(binary), manifest.binarySha256);
  assert.ok(binary.length < 1024 * 1024); assert.equal(binary.subarray(0, 2).toString(), 'MZ');
  if (process.platform !== 'win32' || process.arch !== 'x64') return;
  const frames = execFileSync(resolve('native/bin/outerwilds-audio.exe'), ['--self-test'], { windowsHide: true }).toString().trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(frames[0].powers, [0,0,0,0,0,0]); assert.equal(frames[0].rms, 0);
  for (let i = 0; i < 6; i++) {
    const frame = frames[i + 1], sorted = [...frame.powers].sort((a,b) => b-a);
    assert.equal(frame.powers.indexOf(sorted[0]), i); assert.ok(sorted[0] > sorted[1] * 1000);
    assert.ok(Math.abs(frame.rms - .25 / Math.sqrt(2)) < .002);
  }
});

test('native and browser FFT powers use the same fixed gain and loudness scale', () => {
  const spectrum = new Float32Array(2048).fill(-Infinity); spectrum[7] = -25;
  const native = frameFromPowers({ rms: .1, peak: .2 }, [10 ** (-25/10),0,0,0,0,0], 7);
  assert.ok(Math.abs(readSpectrum(spectrum,48000,7)[0] - native.bands[0]) < 1e-8);
  assert.ok(frameFromPowers({rms:.1,peak:.2},[.00001,0,0,0,0,0],7).bands[0] < native.bands[0]);
  assert.deepEqual(frameFromPowers({ rms: 0, peak: 0 }, tone.powers, 7).bands, [0,0,0,0,0,0]);
});

test('native capture is opt-in, shared across clients, and releases when the last client disconnects', async () => {
  let enabled = false, launches = 0, child;
  const host = new NativeAudioHost({ enabled: () => enabled, platform: 'win32', arch: 'x64', launch: () => { launches++; return child = fakeChild(); } });
  try {
    assert.equal(host.request('read', {session:a}).phase, 'disabled'); assert.equal(launches,0);
    enabled = true;
    assert.equal(host.request('read', {session:a}).phase, 'starting');
    child.stdout.write(JSON.stringify(tone)+'\n');
    assert.equal(host.request('read', {session:b}).phase, 'listening'); assert.equal(launches,1);
    host.request('release', {session:a}); assert.equal(child.stdin.writableEnded,false);
    host.request('release', {session:b}); assert.equal(child.stdin.writableEnded,true);
    assert.equal(host.snapshot().phase, 'idle');
  } finally { host.dispose(); }
});

test('native host expires lost clients, clears stale frames, rejects invalid input, and gates unsupported hosts', async () => {
  let now = 10000, enabled = true, child;
  const host = new NativeAudioHost({ enabled: () => enabled, platform:'win32', arch:'x64', now: () => now, launch: () => child = fakeChild() });
  try {
    for (const payload of [null, {}, {session:'invalid'}]) assert.throws(() => host.request('read',payload));
    assert.throws(() => host.request('unrecognized', {session:a}));
    host.request('read', {session:a}); child.stdout.write(JSON.stringify(tone)+'\n');
    assert.equal(host.snapshot().rms,.1); now += 301; assert.equal(host.snapshot().rms,0);
    now += 3000; await wait(550); assert.equal(child.stdin.writableEnded,true);
    host.request('read',{session:a}); enabled = false; await wait(550); assert.equal(child.stdin.writableEnded,true);
  } finally { host.dispose(); }
  const unsupported = new NativeAudioHost({ enabled: () => true, platform:'linux', launch() { throw new Error('must not launch'); } });
  try { assert.equal(unsupported.request('read',{session:a}).phase,'unsupported'); } finally { unsupported.dispose(); }
});

test('native host recovers after helper failure without accepting malformed or non-finite metrics', () => {
  let now = 10000, child, launches = 0;
  const host = new NativeAudioHost({ enabled:()=>true, platform:'win32',arch:'x64',now:()=>now,launch:()=>{launches++; return child=fakeChild();} });
  try {
    host.request('read',{session:a}); child.stdout.write('{"type":"frame","powers":[1]}\n');
    assert.equal(host.snapshot().phase,'error'); assert.equal(child.exitCode,1);
    now += 1001; host.request('read',{session:a}); assert.equal(launches,2);
    child.stdout.write(JSON.stringify(tone)+'\n'); assert.equal(host.snapshot().phase,'listening');
  } finally { host.dispose(); }
});

function browserStub() {
  let snapshot = { phase:'idle',source:null,message:'idle',contextState:'none',sampleRate:0 };
  const listeners = new Set();
  return { connects:0, getSnapshot:()=>snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async connect() { this.connects++; snapshot = { ...snapshot,phase:'listening',source:'system',contextState:'running' }; listeners.forEach(fn=>fn()); },
    stop() { snapshot = {...snapshot,phase:'idle',source:null}; listeners.forEach(fn=>fn()); },
    read:()=>({rms:.2}), async resume(){}, dispose(){} };
}
test('automatic input connects without browser prompts, tolerates remount, stops on hide/exit and restores on pageshow', async () => {
  globalThis.window = new EventTarget();
  let state = { prefs:{enabled:true,audioAuto:false},dark:true };
  const listeners = new Set(), calls=[];
  const browser = browserStub();
  const rpc = { async call(channel,endpoint,payload) { calls.push({channel,endpoint,...payload}); return {ok:true,value:{...tone,phase:'listening',message:'native'}}; } };
  const input = new HostAudioInput(rpc,browser);
  const controller = { getSnapshot:()=>state, subscribe(fn) {listeners.add(fn);return()=>listeners.delete(fn);} };
  const session = createSidebarAudio(controller,input);
  const set = prefs => {state={...state,prefs:{...state.prefs,...prefs}};listeners.forEach(fn=>fn());};
  try {
    assert.equal(calls.length,0); assert.equal(browser.connects,0);
    set({audioAuto:true}); await wait(5);
    assert.equal(input.getSnapshot().source,'native'); assert.ok(input.read().bands[0]>0); assert.equal(browser.connects,0);
    const id = calls[0].session; set({brightness:40}); await wait(40);
    assert.ok(calls.filter(c=>c.endpoint==='outerwilds-audio/read').every(c=>c.session===id));
    window.dispatchEvent(new Event('pagehide')); assert.equal(input.getSnapshot().phase,'idle');
    assert.ok(calls.some(c=>c.endpoint==='outerwilds-audio/release'&&c.session===id));
    window.dispatchEvent(new Event('pageshow')); await wait(5); assert.equal(input.getSnapshot().phase,'listening');
    input.stop(); assert.equal(input.getSnapshot().source,'native', 'paused automatic input must offer system capture when reconnected');
    await input.connect('system'); assert.equal(input.getSnapshot().phase,'listening');
    set({audioAuto:false}); assert.equal(input.getSnapshot().phase,'idle');
    set({audioAuto:true}); await wait(5); assert.equal(input.getSnapshot().phase,'listening');
    set({audioAuto:false}); assert.equal(input.getSnapshot().source,null); await input.connect('system'); assert.equal(browser.connects,1); assert.equal(input.getSnapshot().source,'system');
  } finally { session.dispose(); delete globalThis.window; }
});

test('late native replies are discarded after stop; unsupported capture never requests browser access', async () => {
  let resolveReply;
  const browser = browserStub(), calls=[];
  const input = new HostAudioInput({call(channel,endpoint) { calls.push(endpoint);return endpoint==='outerwilds-audio/read' ? new Promise(r=>resolveReply=r) : Promise.resolve({ok:true,value:{phase:'idle'}});}},browser);
  input.setAutomatic(true); input.stop();
  resolveReply({ok:true,value:{...tone,phase:'listening'}}); await wait(5);
  assert.equal(input.getSnapshot().phase,'idle'); assert.equal(calls.filter(c=>c==='outerwilds-audio/read').length,1); input.dispose();
  const unsupported = new HostAudioInput({async call(){return {ok:true,value:{phase:'unsupported',message:'Windows x64 only'}};}},browser);
  unsupported.setAutomatic(true); await wait(5);
  assert.equal(unsupported.getSnapshot().phase,'error'); assert.equal(browser.connects,0);
  await unsupported.connect('system');
  assert.equal(browser.connects,1, 'unsupported hosts retain manual sharing after an explicit click');
  assert.equal(unsupported.getSnapshot().source,'system');
  unsupported.dispose();
});

test('unsupported audio does not reopen browser permission on page restore', async () => {
  globalThis.window = new EventTarget();
  const browser = browserStub();
  const input = new HostAudioInput({async call(){return {ok:true,value:{phase:'unsupported'}};}}, browser);
  const controller = { getSnapshot:()=>({prefs:{enabled:true,audioAuto:true},dark:true}), subscribe(){return()=>{};} };
  const session = createSidebarAudio(controller,input);
  try {
    await wait(5);
    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pageshow'));
    await wait(5);
    assert.equal(browser.connects,0);
  } finally { session.dispose(); delete globalThis.window; }
});
