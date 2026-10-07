import type { ComponentType } from 'react';
import type { Preferences } from './config';
export interface ThemeSnapshot { preference: string; fontSize: number; active: { colorScheme: 'dark' | 'light' }; }
export interface ThemeService {
  getTheme(): ThemeSnapshot;
  setTheme(id: string): void;
  setFontSize(px: number): void;
  overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>): () => void;
}
export interface FormSnapshot { status: 'ready' | 'loading' | 'unavailable'; value?: Preferences; writable: boolean; mode: 'host' | 'memory'; }
export interface ConfigForm {
  getSnapshot(): FormSnapshot;
  subscribe(listener: () => void): () => void;
  set(field: string, value: unknown): Promise<boolean>;
  mutate(ops: readonly { path: string[]; op: 'set'; value: unknown }[]): Promise<boolean>;
}
export interface ClientContext {
  theme: ThemeService;
  configForms: { get(entry: string): ConfigForm };
  on(event: 'theme/change', callback: (snapshot: ThemeSnapshot) => void): () => void;
  effect(callback: () => (() => void), label?: string): unknown;
  slots: {
    inject(name: string, callback: () => unknown): unknown;
    register(options: { name: string; id?: string; order?: number; label?: () => string }, component: ComponentType): () => void;
    entries(name: string): unknown[];
  };
}
