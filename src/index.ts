import z from '@deepseek-ai/schemastery';
import { NativeAudioHost } from './audio-wave/native-host';
import { AUDIO_CHANNEL, AUDIO_ENDPOINT } from './audio-wave/native-contract';
export const Config = z.object({
  enabled: z.boolean().default(false).volatile(),
  // Accept old profile data; audioAuto now owns both visibility and capture.
  audioVisible: z.boolean().default(true).volatile(),
  audioAuto: z.boolean().default(false).volatile(),
  brightness: z.number().min(15).max(65).step(1).default(35).volatile(),
  stars: z.union(['few', 'standard', 'many']).default('standard').volatile(),
  motion: z.union(['still', 'gentle', 'rich']).default('gentle').volatile(),
  opacity: z.number().min(90).max(100).step(1).default(96).volatile(),
  density: z.union(['comfortable', 'compact']).default('comfortable').volatile(),
});
interface HostContext {
  fiber: unknown;
  inject(names: string[], callback: (ctx: HostContext) => void): unknown;
  effect(callback: () => unknown): unknown;
  settings: { configure(options: { auto: boolean }, fiber: unknown): unknown };
  connection: { fetch: { register(route: { path: string; methods: string[]; requestBody: 'buffered'; fetch(request: Request): Promise<Response> }): unknown } };
}
type AudioConfig = { enabled: { get(): boolean }; audioAuto: { get(): boolean } };
export function apply(ctx: HostContext, config: AudioConfig) {
  ctx.inject(['settings'], child => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)); });
  ctx.inject(['connection'], child => {
    const audio = new NativeAudioHost({ enabled: () => config.enabled.get() && config.audioAuto.get() });
    child.effect(() => () => audio.dispose());
    for (const action of ['read', 'release']) {
      const method = `${AUDIO_ENDPOINT}/${action}`;
      child.connection.fetch.register({ path: `${AUDIO_CHANNEL}/${method}`, methods: ['POST'], requestBody: 'buffered',
        async fetch(request) {
          if (request.headers.get('content-type')?.split(';', 1)[0].trim() !== 'application/json') return new Response(null, { status: 415 });
          let body;
          try {
            body = await request.json();
            if (request.signal.aborted || body?.type !== 'client-request' || body.method !== method || typeof body.rpcId !== 'string' || body.rpcId.length > 64)
              return new Response(null, { status: 400 });
          } catch { return new Response(null, { status: 400 }); }
          let result;
          try { result = { ok: true, value: audio.request(action, body.payload) }; }
          catch { result = { ok: false, error: { code: 'outerwilds/invalid-audio-request', message: '音频请求无效。', details: {} } }; }
          return Response.json({ type: 'server-response', rpcId: body.rpcId, result });
        },
      });
    }
  });
}
