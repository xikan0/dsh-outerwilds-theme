import { useSyncExternalStore } from 'react';
import type { AppearanceController } from './controller';
import type { Preferences } from './config';
import campfireArt from './assets/campfire-web-stars.png';

export function SettingsPanel({ controller }: { controller: AppearanceController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { prefs, form } = state;
  const disabled = !form.writable;
  function choices<K extends 'stars' | 'motion' | 'density'>(key: K, title: string, options: [Preferences[K], string][]) {
    return <div className="cf-row"><fieldset><legend>{title}</legend><div className="cf-segments">{options.map(([value, label]) => <button key={value} disabled={disabled} aria-pressed={prefs[key] === value} onClick={() => void controller.write(key, value)}>{label}</button>)}</div></fieldset></div>;
  }
  function range(key: 'brightness' | 'opacity', title: string, min: number, max: number, hint?: string) {
    return <div className="cf-row"><label htmlFor={`cf-${key}`}>{title}{hint && <small>{hint}</small>}</label><div className="cf-range"><input id={`cf-${key}`} type="range" min={min} max={max} value={prefs[key]} disabled={disabled} onChange={event => void controller.write(key, Number(event.target.value))}/><output htmlFor={`cf-${key}`}>{prefs[key]}%</output></div></div>;
  }
  let status = state.message;
  if (state.error) status = state.message;
  else if (form.status === 'loading') status = '正在读取主题设置…';
  else if (!form.writable) status = '当前连接不能保存主题设置。请从本机 localhost 地址打开。';
  else if (prefs.enabled && !state.dark) status = '当前为浅色外观，主题暂时停用。切回深色后会自动恢复。';
  else if (prefs.enabled && !state.adapted) status = '配色已启用；当前页面没有可适配的聊天区域，场景暂未显示。';
  return <section className="cf-settings" aria-label="篝火与星空设置">
    <h2>篝火与星空</h2><p>在星空下，整理今天的探索。场景会随着聊天区的尺寸调整。</p>
    <div className="cf-mini" aria-hidden="true"><img src={campfireArt} alt="" style={{ filter: `brightness(${1 + (prefs.brightness - 35) / 65})` }}/></div>
    <div className="cf-row"><label>主题<small>{prefs.enabled && state.dark ? '已启用，随窗口调整营地场景' : '适用于 DSH 深色外观'}</small></label><button disabled={disabled || !!state.saving} className={prefs.enabled && state.dark ? '' : 'cf-primary'} onClick={() => void (prefs.enabled && state.dark ? controller.write('enabled', false) : controller.enable())}>{prefs.enabled && state.dark ? '关闭主题' : '启用深色主题'}</button></div>
    {range('brightness', '背景亮度', 15, 65)}
    {choices('stars', '星星数量', [['few', '少'], ['standard', '标准'], ['many', '多']])}
    {choices('motion', '动效强度', [['still', '静止'], ['gentle', '轻微'], ['rich', '增强']])}
    <p>星空保持静止；营地保留轻微火焰、烟雾与火星。选择“静止”停止营地动效。</p>
    {range('opacity', '面板不透明度', 90, 100, '数值越高，输入框和菜单越实')}
    <div className="cf-row"><label htmlFor="cf-font">正文字号<small>与 DSH 原生字号设置同步</small></label><div className="cf-range"><input id="cf-font" type="range" min="10" max="22" value={state.fontSize} disabled={disabled} onChange={event => controller.fontSize(Number(event.target.value))}/><output htmlFor="cf-font">{state.fontSize}px</output></div></div>
    {choices('density', '布局密度', [['comfortable', '舒适'], ['compact', '紧凑']])}
    <div className="cf-actions"><button disabled={disabled || !!state.saving} onClick={() => void controller.reset()}>恢复主题默认</button>{prefs.enabled && !state.dark && <button disabled={disabled} onClick={() => void controller.write('enabled', false)}>关闭主题</button>}</div>
    <div className="cf-status" role={state.error ? 'alert' : 'status'} data-error={state.error}>{status || '设置会保存到当前 DSH 配置。系统减少动态效果时，场景自动保持静止。'}</div>
  </section>;
}
