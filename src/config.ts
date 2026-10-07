export const ENTRY_ID = 'ui-campfire-theme';
export const PACKAGE_ID = 'dsh-theme-campfire';
export type Motion = 'still' | 'gentle' | 'rich';
export type Stars = 'few' | 'standard' | 'many';
export interface Preferences {
  enabled: boolean;
  brightness: number;
  stars: Stars;
  motion: Motion;
  opacity: number;
  density: 'comfortable' | 'compact';
}
export const DEFAULTS: Preferences = Object.freeze({ enabled: false, brightness: 35, stars: 'standard', motion: 'gentle', opacity: 96, density: 'comfortable' });
export function normalize(value: unknown): Preferences {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Preferences>;
  const integer = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULTS.enabled,
    brightness: integer(raw.brightness, DEFAULTS.brightness, 15, 65),
    opacity: integer(raw.opacity, DEFAULTS.opacity, 90, 100),
    stars: raw.stars === 'few' || raw.stars === 'many' ? raw.stars : DEFAULTS.stars,
    motion: raw.motion === 'still' || raw.motion === 'rich' ? raw.motion : DEFAULTS.motion,
    density: raw.density === 'compact' ? 'compact' : DEFAULTS.density,
  };
}
