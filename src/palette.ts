export function palette(opacity: number, desktop = false): Record<string, { light: string; dark: string }> {
  const surface = `rgba(52, 49, 48, ${opacity / 100})`;
  const colors: Record<string, string> = {
    '--dsw-alias-bg-base': '#071017', '--dsw-alias-bg-layer-1': '#101c23', '--dsw-alias-bg-layer-2': '#16262d', '--dsw-alias-bg-layer-3': '#1c3036',
    '--dsw-alias-bg-overlay': '#23373d', '--dsw-alias-bg-module-platform': '#17282f',
    '--dsw-alias-label-primary': '#eee8d9', '--dsw-alias-label-primary-bluish': '#e2e6de', '--dsw-alias-label-primary-dimmed': '#bdc8c4',
    '--dsw-alias-label-secondary': '#a5b6b6', '--dsw-alias-label-tertiary': '#8a9fa1', '--dsw-alias-label-dimmed': '#839696',
    '--dsw-alias-label-caption': '#a5b6b6', '--dsw-alias-label-primary-inverted': '#11191e',
    '--dsw-alias-border-l1': '#92aaa11a', '--dsw-alias-border-l2': '#92aaa12e', '--dsw-alias-border-l3': '#92aaa13d', '--dsw-alias-border-l4': '#92aaa152',
    '--dsw-alias-brand-primary': '#e8a15b', '--dsw-alias-brand-text': '#eee8d9', '--dsw-alias-brand-primary-invert': '#101c23',
    '--dsw-alias-button-primary-fill': '#e8a15b', '--dsw-alias-button-primary-hover': '#efb77c',
    '--dsw-alias-button-info-fill': '#e8a15b', '--dsw-alias-button-info-hover': '#efb77c',
    '--dsw-alias-interactive-bg-hover': '#a9a4a033', '--dsw-alias-interactive-bg-active': '#a9a4a04d', '--dsw-alias-interactive-bg-hover-accent': '#e8a15b24',
    '--dsw-alias-state-business-primary': '#e8a15b', '--dsw-alias-state-business-tertiary': '#b97c42',
    '--dsw-alias-markdown-code-block': '#343130', '--dsw-alias-markdown-code-block-banner': '#45413f', '--dsw-alias-markdown-inline-code': '#a9a4a026',
    '--dsw-specific-input-major': surface, '--dsw-specific-sidebar-fill': '#343130',
    '--dsw-specific-sidebar-nav-item-active': '#45413f', '--dsw-specific-sidebar-nav-item-active-accent': '#45413f', '--dsw-specific-sidebar-nav-item-hover': '#403c3a',
    '--dsw-menu-surface-fill': surface, '--dsw-specific-menu': surface, '--dsw-alias-menu-group-header-fill': '#343130f5', '--dsw-alias-menu-icon': '#bdc8c4',
  };
  // Desktop portals inherit body tokens, even when opened outside settings.
  // Keep the Web palette unchanged and leave the scene's base colour intact.
  if (desktop) Object.assign(colors, {
    '--dsw-alias-bg-layer-1': '#3d3937', '--dsw-alias-bg-layer-2': '#403c3a',
    '--dsw-alias-bg-layer-3': '#45413f', '--dsw-alias-bg-layer-4': '#4d4946',
    '--dsw-alias-bg-overlay': '#45413f', '--dsw-alias-bg-module-platform': '#403c3a',
    '--dsw-alias-settings-card-fill': '#403c3a',
    '--dsw-alias-button-tool-bar-fill': '#403c3a', '--dsw-alias-button-tool-bar-hover': '#45413f',
    '--dsw-alias-interactive-bg-hover-solid': '#45413f',
    '--dsw-alias-tooltip-bg': '#343130', '--dsw-alias-toast-bg': '#343130',
  });
  return Object.fromEntries(Object.entries(colors).map(([name, value]) => [name, { light: value, dark: value }]));
}
