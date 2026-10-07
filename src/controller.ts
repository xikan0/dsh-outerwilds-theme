import { DEFAULTS, normalize, type Preferences } from './config';
import type { ConfigForm, FormSnapshot, ThemeService } from './contracts';
import type { VisualRuntime } from './runtime';
export interface AppearanceState { prefs: Preferences; form: FormSnapshot; dark: boolean; fontSize: number; saving: number; message: string; error: boolean; adapted: boolean; }
export function createController(form: ConfigForm, theme: ThemeService) {
  let disposed = false, themeRefreshQueued = false, visual: VisualRuntime | undefined;
  const listeners = new Set<() => void>();
  const pending = new Map<keyof Preferences, { value: unknown; generation: number }>();
  let generation = 0;
  let state: AppearanceState = { prefs: normalize(form.getSnapshot().value), form: form.getSnapshot(), dark: theme.getTheme().active.colorScheme === 'dark', fontSize: theme.getTheme().fontSize, saving: 0, message: '', error: false, adapted: false };
  function emit(patch: Partial<AppearanceState> = {}) {
    if (disposed) return;
    const accepted = form.getSnapshot();
    const draft = { ...normalize(accepted.value), ...Object.fromEntries([...pending].map(([key, item]) => [key, item.value])) };
    state = { ...state, ...patch, form: accepted, prefs: normalize(draft), dark: theme.getTheme().active.colorScheme === 'dark', fontSize: theme.getTheme().fontSize };
    visual?.update(state.prefs); listeners.forEach(fn => fn());
  }
  const unsubscribe = form.subscribe(() => emit());
  async function write<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    if (disposed || !form.getSnapshot().writable) return;
    const own = ++generation;
    pending.set(key, { value, generation: own });
    emit({ saving: state.saving + 1, message: '正在保存…', error: false });
    let accepted = false;
    try { accepted = await form.set(key, value); } catch { accepted = false; }
    if (disposed) return;
    if (pending.get(key)?.generation === own) pending.delete(key);
    const saving = Math.max(0, state.saving - 1);
    emit({ saving, message: accepted ? (saving ? '正在保存…' : '已保存') : '保存失败，已恢复已保存的设置。', error: !accepted });
  }
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    attach(runtime: VisualRuntime) { visual = runtime; emit(); },
    adaptation(ready: boolean) { if (state.adapted !== ready) { state = { ...state, adapted: ready }; listeners.forEach(fn => fn()); } },
    themeChanged() {
      if (themeRefreshQueued || disposed) return;
      themeRefreshQueued = true;
      // Let every listener finish applying the same host snapshot first.
      // Releasing or replacing our token layer then cannot be overwritten
      // by a later listener still handling the older theme/change event.
      queueMicrotask(() => { themeRefreshQueued = false; emit(); });
    }, write,
    async enable() { if (disposed || !form.getSnapshot().writable) return; theme.setTheme('dark'); await write('enabled', true); },
    fontSize(px: number) { if (disposed || !form.getSnapshot().writable) return; emit({ message: '字号由 DSH 原生设置管理。', error: false }); theme.setFontSize(px); },
    async reset() {
      if (!form.getSnapshot().writable || state.saving) return;
      emit({ saving: 1, message: '正在恢复默认…', error: false });
      let accepted = false;
      try { accepted = await form.mutate(Object.entries({ ...DEFAULTS, enabled: state.prefs.enabled }).map(([key, value]) => ({ op: 'set' as const, path: [key], value }))); } catch { accepted = false; }
      emit({ saving: 0, message: accepted ? '已恢复主题默认设置' : '恢复失败，请重试。', error: !accepted });
    },
    dispose() { disposed = true; unsubscribe(); listeners.clear(); visual = undefined; pending.clear(); },
  };
}
export type AppearanceController = ReturnType<typeof createController>;
