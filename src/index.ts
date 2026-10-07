import z from '@deepseek-ai/schemastery';
export const Config = z.object({
  enabled: z.boolean().default(false).volatile(),
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
}
export function apply(ctx: HostContext) {
  ctx.inject(['settings'], child => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)); });
}
