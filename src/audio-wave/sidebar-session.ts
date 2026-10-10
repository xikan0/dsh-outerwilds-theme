import type { AppearanceController, AppearanceState } from '../controller';
import { AudioInput, type AudioFeed } from './input';

export const audioAvailable = ({ prefs, dark }: AppearanceState) => prefs.enabled && prefs.audioAuto && dark;

// Capture belongs to the plugin, not a sidebar mount or a conversation.
export function createSidebarAudio(controller: AppearanceController, input: AudioFeed = new AudioInput()) {
  const sync = () => {
    const state = controller.getSnapshot();
    input.setAutomatic?.(audioAvailable(state));
    if (!audioAvailable(state) && input.getSnapshot().phase !== 'idle') input.stop();
  };
  const off = controller.subscribe(sync);
  const pagehide = () => input.stop();
  window.addEventListener('pagehide', pagehide);
  const pageshow = () => {
    const state = controller.getSnapshot();
    const snapshot = input.getSnapshot();
    if (audioAvailable(state) && snapshot.phase === 'idle' && snapshot.source === 'native') void input.connect('system');
  };
  window.addEventListener('pageshow', pageshow);
  sync();
  return {
    input,
    dispose() { off(); window.removeEventListener('pagehide', pagehide); window.removeEventListener('pageshow', pageshow); input.dispose(); },
  };
}
