import { useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { AppearanceController } from './controller';
import { DISPLAY_NAME, type Preferences } from './config';
import campfireArt from './assets/campfire-web-stars.png';

interface RangeControlProps {
  id: string;
  title: string;
  value: number;
  min: number;
  max: number;
  unit: '%' | 'px';
  disabled: boolean;
  onChange(value: number): void;
}

function RangeControl({ id, title, value, min, max, unit, disabled, onChange }: RangeControlProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelEdit = useRef(false);
  const clamp = (next: number) => Math.max(min, Math.min(max, Math.round(next)));
  const displayed = draft ?? String(value);
  function commit(raw: string) {
    setDraft(null);
    if (disabled || cancelEdit.current || !raw.trim()) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed);
    if (next !== value) onChange(next);
  }
  return <div className="cf-range">
    <div className="cf-range-track" style={{ '--cf-range-progress': `${Math.max(0, Math.min(100, (value - min) / (max - min) * 100))}%` } as CSSProperties}>
      <button type="button" className="cf-range-step cf-range-decrease" aria-label={`减小${title}`} disabled={disabled || value <= min} onClick={() => onChange(clamp(value - 1))}/>
      <input id={id} type="range" min={min} max={max} step={1} value={value} disabled={disabled} onChange={event => onChange(Number(event.currentTarget.value))}/>
      <button type="button" className="cf-range-step cf-range-increase" aria-label={`增大${title}`} disabled={disabled || value >= max} onClick={() => onChange(clamp(value + 1))}/>
    </div>
    <div className="cf-range-value">
      <input type="number" aria-label={`${title}数值`} min={min} max={max} step={1} value={displayed} disabled={disabled}
        style={{ width: `${Math.max(1, Math.min(3, displayed.length))}ch` }}
        onFocus={() => { cancelEdit.current = false; setDraft(String(value)); }}
        onChange={event => setDraft(event.currentTarget.value)}
        onBlur={event => commit(event.currentTarget.value)}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== 'Escape') return;
          event.preventDefault();
          cancelEdit.current = event.key === 'Escape';
          event.currentTarget.blur();
        }}/>
      <span aria-hidden="true">{unit}</span>
    </div>
  </div>;
}

export function SettingsPanel({ controller }: { controller: AppearanceController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { prefs, form } = state;
  const disabled = !form.writable;
  function choices<K extends 'stars' | 'motion' | 'density'>(key: K, title: string, options: [Preferences[K], string][], hint?: string) {
    return <div className="cf-row"><div className="cf-row-label" id={`cf-${key}-label`}><span className="cf-row-title">{title}</span>{hint && <small>{hint}</small>}</div><div className="cf-segments" role="group" aria-labelledby={`cf-${key}-label`}>{options.map(([value, label]) => <button key={value} disabled={disabled} aria-pressed={prefs[key] === value} onClick={() => void controller.write(key, value)}>{label}</button>)}</div></div>;
  }
  function range(key: 'brightness' | 'opacity' | 'font', title: string, min: number, max: number, hint?: string, unit: '%' | 'px' = '%') {
    return <div className="cf-row"><label className="cf-row-label" htmlFor={`cf-${key}`}><span className="cf-row-title">{title}</span>{hint && <small>{hint}</small>}</label><RangeControl id={`cf-${key}`} title={title} min={min} max={max} unit={unit} value={key === 'font' ? state.fontSize : prefs[key]} disabled={disabled} onChange={value => { if (key === 'font') controller.fontSize(value); else void controller.write(key, value); }}/></div>;
  }
  let status = state.message;
  if (state.error) status = state.message;
  else if (form.status === 'loading') status = '正在读取主题设置…';
  else if (!form.writable) status = '当前连接不能保存主题设置。请从本机 localhost 地址打开。';
  else if (prefs.enabled && !state.dark) status = '当前为浅色外观，主题暂时停用。切回深色后会自动恢复。';
  else if (prefs.enabled && !state.adapted) status = '配色已启用；当前页面没有可适配的聊天区域，场景暂未显示。';
  return <section className="cf-settings" aria-label={`${DISPLAY_NAME} 设置`}>
    <h2>星际拓荒</h2>
    <p>在星空下，整理今天的探索。</p>
    <div className="cf-mini"><img src={campfireArt} alt="" aria-hidden="true"/></div>
    {range('brightness', '背景亮度', 15, 65)}
    {choices('stars', '星星数量', [['few', '少'], ['standard', '标准'], ['many', '多']])}
    {choices('motion', '营地动效', [['still', '静止'], ['gentle', '轻微'], ['rich', '增强']], '星空保持静止，仅调整火焰、烟雾与火星')}
    {range('opacity', '面板不透明度', 90, 100, '数值越高，输入框和菜单越实')}
    {range('font', '正文字号', 10, 22, '与 DSH 原生字号设置同步', 'px')}
    {choices('density', '布局密度', [['comfortable', '舒适'], ['compact', '紧凑']])}
    <div className="cf-actions">
      <button disabled={disabled || !!state.saving} onClick={() => void controller.reset()}>恢复默认设置</button>
      <button disabled={disabled || !!state.saving} className={prefs.enabled && state.dark ? '' : 'cf-primary'} onClick={() => void (prefs.enabled && state.dark ? controller.write('enabled', false) : controller.enable())}>{prefs.enabled && state.dark ? '关闭主题' : '启用深色主题'}</button>
      {prefs.enabled && !state.dark && <button disabled={disabled} onClick={() => void controller.write('enabled', false)}>关闭主题</button>}
    </div>
    <div className="cf-status" role={state.error ? 'alert' : 'status'} data-error={state.error}>{status || '设置自动保存。系统减少动态效果时，营地保持静止。'}</div>
  </section>;
}
