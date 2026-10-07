import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { createController } from './controller';
import { createVisualRuntime } from './runtime';
import { SettingsPanel } from './settings';
import { normalize, PACKAGE_ID } from './config';
import type { ConfigForm, FormSnapshot, ThemeService, ThemeSnapshot } from './contracts';
import styles from './styles.css';
const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style);
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
function Preview() {
  const [settings, setSettings] = useState(false), [chat, setChat] = useState(false), [sidebar, setSidebar] = useState(true);
  return <div data-slot="root"><div className="preview-frame">
    <aside className={`preview-sidebar ${sidebar ? '' : 'preview-sidebar-hidden'}`}><div className="preview-brand">◉ <span>DSH</span></div><button className="preview-new" onClick={() => setChat(false)}>＋ 新对话</button><div className="preview-recent">最近会话</div><button className="preview-session" onClick={() => setChat(true)}>主题插件设计</button><button className="preview-session">整理学习笔记</button><button className="preview-settings" onClick={() => setSettings(true)}>⚙ 设置</button></aside>
    <div data-slot="main.conversation"><main data-phase={chat ? 'active' : 'hero'} className="preview-conversation">
      <header className="preview-header"><button aria-label="切换侧栏" onClick={() => setSidebar(!sidebar)}>☰</button><span>{chat ? '主题插件设计' : '新对话'}</span><small>场景预览</small></header>
      {chat ? <div data-conversation-content className="preview-transcript"><div className="preview-user">帮我搭建一个主题插件。</div><div className="preview-reply"><p>先从主题配色、背景场景和设置面板开始。</p><pre><code>{`const campfire = {\n  background: '#071017',\n  accent: '#e8a15b',\n  motion: 'gentle'\n};`}</code></pre><p>场景会根据可用空间，调整树影和篝火的位置。</p></div></div> : <div className="preview-hero"><div className="preview-hero-symbol">✧</div><h1>今天，想探索什么？</h1><p>从一个问题开始，记录新的发现。</p></div>}
      <div className="preview-composer" data-composer-card><textarea placeholder="输入消息…"/><button aria-label="发送预览消息" onClick={() => setChat(true)}>↑</button></div>
    </main></div>
    <div data-shell-overlay>{settings && <div className="preview-dialog-backdrop"><div className="preview-dialog" role="dialog" aria-label="设置"><nav><strong>设置</strong><button>{PACKAGE_ID}</button></nav><div className="preview-settings-content"><button className="preview-close" aria-label="关闭设置" onClick={() => setSettings(false)}>×</button><SettingsPanel controller={controller}/></div></div></div>}</div>
  </div></div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
