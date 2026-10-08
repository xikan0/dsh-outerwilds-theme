import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { createController } from './controller';
import { createVisualRuntime } from './runtime';
import { SettingsPanel } from './settings';
import { normalize, DISPLAY_NAME } from './config';
import type { ConfigForm, FormSnapshot, ThemeService, ThemeSnapshot } from './contracts';
import styles from './styles.css';
import { fontFaces } from './fonts';
const style = document.createElement('style'); style.textContent = `${fontFaces}\n${styles}`; document.head.appendChild(style);
const formListeners = new Set<() => void>(), themeListeners = new Set<() => void>();
let snapshot: FormSnapshot = { status: 'ready', writable: true, mode: 'host', value: normalize(JSON.parse(localStorage.getItem('outerwilds-theme-preview') || '{"enabled":true}')) };
const form: ConfigForm = {
  getSnapshot: () => snapshot, subscribe(fn) { formListeners.add(fn); return () => { formListeners.delete(fn); }; },
  async set(key, value) { snapshot = { ...snapshot, value: normalize({ ...snapshot.value, [key]: value }) }; localStorage.setItem('outerwilds-theme-preview', JSON.stringify(snapshot.value)); formListeners.forEach(fn => fn()); return true; },
  async mutate(ops) { for (const op of ops) await form.set(op.path[0], op.value); return true; },
};
let themeSnapshot: ThemeSnapshot = { preference: 'dark', fontSize: 14, active: { colorScheme: 'dark' } };
let tokenRelease = 0;
const theme: ThemeService = {
  getTheme: () => themeSnapshot,
  setTheme(id) { themeSnapshot = { ...themeSnapshot, preference: id, active: { colorScheme: id === 'light' ? 'light' : 'dark' } }; themeListeners.forEach(fn => fn()); },
  setFontSize(px) { themeSnapshot = { ...themeSnapshot, fontSize: px }; document.body.style.setProperty('--dsh-content-font-size', `${px}px`); themeListeners.forEach(fn => fn()); },
  overrideTokens(_source, tokens) { const own = ++tokenRelease; Object.entries(tokens).forEach(([key, value]) => document.body.style.setProperty(key, value.dark)); return () => { if (own === tokenRelease) Object.keys(tokens).forEach(key => document.body.style.removeProperty(key)); }; },
};
const controller = createController(form, theme);
const visual = createVisualRuntime(theme, ready => controller.adaptation(ready));
controller.attach(visual); themeListeners.add(() => controller.themeChanged());
function Icon({ name }: { name: 'plus' | 'panel' | 'plugin' | 'insight' | 'memory' | 'folder' | 'search' | 'settings' }) {
  const paths = {
    plus: 'M8 3v10M3 8h10', panel: 'M2 2h12v12H2zM6 2v12',
    plugin: 'M6 2h4v3h3v4h-3v4H6V9H3V5h3z', insight: 'M3 2h10v12H3zM5 5h6M5 8h2M9 8h2M5 11h6',
    memory: 'M8 2 3 4v8l5 2 5-2V4zM8 2v12M3 4l5 3 5-3M3 9l5 3 5-3', folder: 'M2 4V3h4l2 2h6v8H2z',
    search: 'M11 11l3 3M12 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
    settings: 'M8 2v2M8 12v2M2 8h2M12 8h2M4 4l1 1M11 11l1 1M4 12l1-1M11 5l1-1M11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  };
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function Preview() {
  const [settings, setSettings] = useState(false), [chat, setChat] = useState(false), [sidebar, setSidebar] = useState(true);
  const [panel, setPanel] = useState(''), [session, setSession] = useState(''), [expanded, setExpanded] = useState(true), [search, setSearch] = useState(false), [query, setQuery] = useState('');
  const sessions = ['主题插件设计', '下一次探索计划'];
  const navigate = (name: string) => { setPanel(name); setSession(''); setChat(false); };
  const openSession = (name: string) => { setPanel(''); setSession(name); setChat(true); };
  return <div data-slot="root"><div className="preview-frame">
    <aside className="preview-sidebar-column" data-sidebar-collapsed={sidebar ? undefined : 'true'}><div data-slot="sidebar"><div className={`preview-sidebar ${sidebar ? '' : 'preview-rail'}`}>
      <div className="preview-brand"><span className="preview-wordmark">deepseek <small>HARNESS</small></span><button aria-label={sidebar ? '收起侧栏' : '展开侧栏'} onClick={() => setSidebar(!sidebar)}><Icon name="panel"/></button></div>
      <button className="preview-new" aria-label="新会话" aria-keyshortcuts="Control+N" onClick={() => navigate('')}><Icon name="plus"/>{sidebar && <span>新会话</span>}</button>
      <nav aria-label="应用导航">{([['插件', 'plugin'], ['上下文洞察', 'insight'], ['记忆系统', 'memory']] as const).map(([label, icon]) => <button key={label} aria-label={label} aria-current={panel === label ? 'page' : undefined} onClick={() => navigate(label)}><span><Icon name={icon}/></span>{sidebar && <span>{label}</span>}</button>)}</nav>
      <div className="preview-workspace-area"><div data-slot="sidebar.workspaces"><div className="preview-workspaces">
        <div className="preview-workspace-heading">{sidebar && <span>工作区</span>}<button aria-label="搜索会话" aria-expanded={search} onClick={() => { setSidebar(true); setSearch(!search); }}><Icon name="search"/></button></div>
        {sidebar && search && <input className="preview-search" autoFocus aria-label="搜索会话" placeholder="搜索会话…" value={query} onChange={event => setQuery(event.target.value)}/>}
        {sidebar && <div role="tree" aria-label="工作区和会话" tabIndex={0}>
          <div className="preview-project" role="treeitem" aria-expanded={expanded} tabIndex={0} onClick={() => setExpanded(!expanded)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpanded(!expanded); } }}><Icon name="folder"/><span>DeepSeek Harness Theme</span><span className="preview-caret" aria-hidden="true">{expanded ? '⌄' : '›'}</span></div>
          {expanded && <div role="group">{sessions.filter(name => name.includes(query)).map(name => <div key={name} className="preview-session" role="treeitem" aria-selected={session === name} tabIndex={0} onClick={() => openSession(name)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSession(name); } }}><span>{name}</span></div>)}</div>}
        </div>}
      </div></div></div>
      <div className="preview-footer"><div><div data-slot="sidebar.settings"><div data-slot="settings.launcher"><button className="preview-settings" aria-label="设置" onClick={() => setSettings(true)}><Icon name="settings"/>{sidebar && <span>设置</span>}</button></div></div></div></div>
    </div></div></aside>
    <div data-slot="main.conversation"><main data-phase={chat ? 'active' : 'hero'} className="preview-conversation">
      <header className="preview-header"><span>{session || panel || ''}</span><small>外观预览</small></header>
      {chat ? <div data-conversation-content className="preview-transcript"><div className="preview-user">帮我搭建一个主题插件。</div><div className="preview-reply"><p>先从主题配色、背景场景和设置面板开始。</p><pre><code>{`const campfire = {\n  background: '#071017',\n  accent: '#e8a15b',\n  motion: 'gentle'\n};`}</code></pre><p>场景会根据可用空间，调整树影和篝火的位置。</p></div></div> : <div className="preview-hero"><div className="preview-hero-symbol">✧</div><h1>今天，想探索什么？</h1><p>从一个问题开始，记录新的发现。</p></div>}
      <div className="preview-composer" data-composer-card><textarea placeholder="输入消息…"/><button aria-label="发送预览消息" onClick={() => setChat(true)}>↑</button></div>
    </main></div>
    <div data-shell-overlay>{settings && <div className="preview-dialog-backdrop"><div className="preview-dialog" role="dialog" aria-label="设置"><nav><strong>设置</strong><button>{DISPLAY_NAME}</button></nav><div className="preview-settings-content"><button className="preview-close" aria-label="关闭设置" onClick={() => setSettings(false)}>×</button><SettingsPanel controller={controller}/></div></div></div>}</div>
  </div></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
