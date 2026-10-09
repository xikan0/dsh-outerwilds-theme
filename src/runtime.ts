import { normalize, PACKAGE_ID, type Preferences } from './config';
import { layoutScene, sceneMarkup, resizeScene } from './scene';
import { palette } from './palette';
import type { ThemeService } from './contracts';

export interface VisualRuntime { update(prefs: Preferences): void; refreshTheme(): void; dispose(): void; }
/** Only the background adapter knows the 0.2.0-rc.2 DOM shape. */
export function createVisualRuntime(theme: ThemeService, onAdaptation: (ready: boolean) => void = () => {}): VisualRuntime {
  let prefs = normalize(undefined), disposed = false, active = false, tokenKey = '';
  let releaseTokens: (() => void) | undefined;
  let conversation: HTMLElement | null = null, frame: HTMLElement | null = null, centerColumn: HTMLElement | null = null;
  let previousPhase = '', previousSize = '', previousStars = '';
  const stage = document.createElement('div');
  stage.className = 'cf-stage'; stage.setAttribute('aria-hidden', 'true'); stage.dataset.campfireScene = '';
  const root = document.getElementById('root');
  const phaseObserver = new MutationObserver(() => position());
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const resizeObserver = new ResizeObserver(() => position());
  function clearAdapter() {
    resizeObserver.disconnect(); phaseObserver.disconnect();
    conversation?.removeAttribute('data-cf-conversation'); frame?.removeAttribute('data-cf-frame'); centerColumn?.removeAttribute('data-cf-center-column');
    conversation = null; frame = null; centerColumn = null; stage.remove(); previousSize = ''; onAdaptation(false);
  }
  function adapterConnected() {
    return conversation?.isConnected && frame?.isConnected && centerColumn?.isConnected && centerColumn.parentElement === frame && centerColumn.contains(conversation);
  }
  function findAdapter() {
    if (!active || disposed) return;
    if (adapterConnected()) { position(); return; }
    clearAdapter();
    const nextConversation = document.querySelector<HTMLElement>('[data-slot="main.conversation"] > [data-phase]');
    const overlay = document.querySelector<HTMLElement>('[data-slot="root"] > div > [data-shell-overlay]');
    const nextFrame = overlay?.parentElement;
    if (!nextConversation || !nextFrame?.contains(nextConversation)) return;
    // CenterColumn has no slot of its own. Follow the conversation's ancestry
    // to the frame's direct child instead of depending on CSS-module hashes.
    let nextCenterColumn: HTMLElement = nextConversation;
    while (nextCenterColumn.parentElement && nextCenterColumn.parentElement !== nextFrame) nextCenterColumn = nextCenterColumn.parentElement;
    conversation = nextConversation; frame = nextFrame; centerColumn = nextCenterColumn;
    conversation.dataset.cfConversation = ''; frame.dataset.cfFrame = ''; centerColumn.dataset.cfCenterColumn = '';
    document.body.prepend(stage);
    resizeObserver.observe(conversation);
    phaseObserver.observe(conversation, { attributes: true, attributeFilter: ['data-phase'] });
    onAdaptation(true); position();
  }
  function position() {
    if (!active || !conversation || disposed) return;
    const box = conversation.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) { stage.hidden = true; return; }
    stage.hidden = false;
    Object.assign(stage.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    const size = `${Math.round(box.width)}:${Math.round(box.height)}`;
    stage.dataset.sky = 'refined';
    if (size !== previousSize || previousStars !== prefs.stars) {
      previousSize = size; previousStars = prefs.stars;
      if (!stage.firstElementChild) stage.innerHTML = sceneMarkup(Math.round(box.width), Math.round(box.height), prefs);
      else resizeScene(stage, Math.round(box.width), Math.round(box.height), prefs);
    }
    const layout = layoutScene(box.width, box.height);
    stage.dataset.tier = layout.tier; stage.dataset.short = String(layout.short); stage.dataset.minimal = String(box.width < 240 || box.height < 200);
    previousPhase = conversation.dataset.phase || 'active'; stage.dataset.phase = previousPhase;
    stage.style.setProperty('--cf-brightness', String(1 + (prefs.brightness - 35) / 65));
    stage.dataset.motion = media.matches ? 'still' : prefs.motion;
    stage.dataset.paused = String(document.hidden);
  }
  const treeObserver = new MutationObserver(() => {
    // Message streaming does not redraw scenery. Only host-root replacement matters.
    if (!adapterConnected()) findAdapter();
  });
  if (root) treeObserver.observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', position);
  document.addEventListener('visibilitychange', position);
  media.addEventListener('change', position);
  function sync() {
    if (disposed) return;
    const shouldApply = prefs.enabled && theme.getTheme().active.colorScheme === 'dark';
    if (shouldApply) {
      active = true;
      const desktop = document.documentElement.hasAttribute('data-windows-titlebar');
      const nextTokenKey = `${desktop}:${prefs.opacity}`;
      document.body.dataset.dshCampfire = ''; document.body.dataset.cfDensity = prefs.density;
      document.body.toggleAttribute('data-cf-desktop', desktop);
      if (tokenKey !== nextTokenKey) {
        // Set the guard before overrideTokens emits theme/change synchronously.
        tokenKey = nextTokenKey;
        const old = releaseTokens;
        releaseTokens = theme.overrideTokens(PACKAGE_ID, palette(prefs.opacity)); old?.();
      }
      findAdapter();
    } else if (active) {
      active = false; tokenKey = '';
      const old = releaseTokens; releaseTokens = undefined; old?.();
      document.body.removeAttribute('data-dsh-campfire'); document.body.removeAttribute('data-cf-density'); document.body.removeAttribute('data-cf-desktop'); clearAdapter();
    }
  }
  // The desktop bridge may publish its caption marker after plugin activation.
  const platformObserver = new MutationObserver(() => sync());
  platformObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-windows-titlebar'] });
  return {
    update(next) { prefs = normalize(next); sync(); }, refreshTheme: sync,
    dispose() {
      if (disposed) return; disposed = true; active = false;
      treeObserver.disconnect(); platformObserver.disconnect(); clearAdapter(); releaseTokens?.(); releaseTokens = undefined;
      window.removeEventListener('resize', position); document.removeEventListener('visibilitychange', position); media.removeEventListener('change', position);
      document.body.removeAttribute('data-dsh-campfire'); document.body.removeAttribute('data-cf-density'); document.body.removeAttribute('data-cf-desktop');
    },
  };
}
