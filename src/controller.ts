import { DEFAULTS, normalize, type Preferences } from './config';
import type { ConfigForm, FormSnapshot, ThemeService } from './contracts';
import type { VisualRuntime } from './runtime';
export interface AppearanceState { prefs: Preferences; form: FormSnapshot; dark: boolean; fontSize: number; saving: number; resetting: boolean; message: string; error: boolean; adapted: boolean; }
export function createController(form: ConfigForm, theme: ThemeService) {
  let disposed = false, themeRefreshQueued = false, visual: VisualRuntime | undefined;
  const listeners = new Set<() => void>();
  const pending = new Map<keyof Preferences, { value: unknown; generation: number }>();
  let generation = 0;
  const initialTheme = theme.getTheme();
  let state: AppearanceState = { prefs: normalize(form.getSnapshot().value), form: form.getSnapshot(), dark: initialTheme.active.colorScheme === 'dark', fontSize: initialTheme.fontSizes?.text ?? initialTheme.fontSize ?? 14, saving: 0, resetting: false, message: '', error: false, adapted: false };
  function emit(patch: Partial<AppearanceState> = {}) {
    if (disposed) return;
    const accepted = form.getSnapshot();
    const currentTheme = theme.getTheme();
    const draft = { ...normalize(accepted.value), ...Object.fromEntries([...pending].map(([key, item]) => [key, item.value])) };
    state = { ...state, ...patch, form: accepted, prefs: normalize(draft), dark: currentTheme.active.colorScheme === 'dark', fontSize: currentTheme.fontSizes?.text ?? currentTheme.fontSize ?? 14 };
    visual?.update(state.prefs); listeners.forEach(fn => fn());
  }
  const unsubscribe = form.subscribe(() => emit());
  async function write<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    if (disposed || state.resetting || !form.getSnapshot().writable) return;
    const revision = form.getSnapshot().revision;
    const own = ++generation;
    pending.set(key, { value, generation: own });
    emit({ saving: state.saving + 1, message: '正在保存…', error: false });
    let accepted = false;
    try {
      accepted = await form.set(key, value);
      const refreshed = form.getSnapshot();
      if (!accepted && !disposed && refreshed.writable && refreshed.status === 'ready' && typeof revision === 'number' && typeof refreshed.revision === 'number' && refreshed.revision > revision && pending.get(key)?.generation === own) {
        accepted = await form.set(key, value);
      }
    } catch { accepted = false; }
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
    async enable() { if (disposed || state.resetting || !form.getSnapshot().writable) return; theme.setTheme('dark'); await write('enabled', true); },
    fontSize(px: number) {
      if (disposed || state.resetting || !form.getSnapshot().writable) return;
      if (theme.getTheme().fontSizes) (theme.setFontSize as (role: 'text', value: number) => void)('text', px);
      else (theme.setFontSize as (value: number) => void)(px);
      emit({ message: '字号由 DSH 原生设置管理。', error: false });
    },
    async reset() {
      if (disposed || !form.getSnapshot().writable || state.saving) return;
      emit({ saving: 1, resetting: true, message: '正在恢复默认…', error: false });
      let accepted = false;
      try { accepted = await form.mutate(Object.entries({ ...DEFAULTS, enabled: state.prefs.enabled }).map(([key, value]) => ({ op: 'set' as const, path: [key], value }))); } catch { accepted = false; }
      emit({ saving: 0, resetting: false, message: accepted ? '已恢复主题默认设置' : '恢复失败，请重试。', error: !accepted });
    },
    dispose() { disposed = true; unsubscribe(); listeners.clear(); visual = undefined; pending.clear(); },
  };
}
export type AppearanceController = ReturnType<typeof createController>;
