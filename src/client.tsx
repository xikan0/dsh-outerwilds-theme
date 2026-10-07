import type { ClientContext } from './contracts';
import { ENTRY_ID, PACKAGE_ID } from './config';
import { createController } from './controller';
import { createVisualRuntime } from './runtime';
import { SettingsPanel } from './settings';
import styles from './styles.css';

export const inject = ['theme', 'slots', 'configForms'];
export function apply(ctx: ClientContext) {
  const controller = createController(ctx.configForms.get(ENTRY_ID), ctx.theme);
  ctx.effect(() => {
    const style = document.createElement('style'); style.dataset.plugin = PACKAGE_ID; style.textContent = styles; document.head.appendChild(style);
    const visual = createVisualRuntime(ctx.theme, ready => controller.adaptation(ready));
    controller.attach(visual);
    const off = ctx.on('theme/change', () => controller.themeChanged());
    return () => { off(); controller.dispose(); visual.dispose(); style.remove(); };
  }, 'outerwilds: appearance lifecycle');
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'outerwilds-theme', order: 40, label: () => PACKAGE_ID }, () => <SettingsPanel controller={controller}/>));
}
