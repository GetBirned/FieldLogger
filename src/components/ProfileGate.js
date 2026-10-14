// Launch screen: pick a local profile, create one, or unlock one with a PIN.
import { html, useEffect, useState, useRef } from '../lib/h.js';
import { bridge } from '../lib/bridge.js';
import { signIn, loadDemo } from '../lib/store.js';
import { APP_TAGLINE, PALETTE } from '../lib/defaults.js';
import { relativeTime } from '../lib/time.js';
import { LogoMark, Wordmark } from './Logo.js';
import { Avatar, Button, ColorPicker, Field, Icon, Switch, cx } from './ui.js';

export function ProfileGate({ initialProfiles }) {
  const [profiles, setProfiles] = useState(initialProfiles || []);
  const [mode, setMode] = useState(initialProfiles?.length ? 'pick' : 'create');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    bridge.profiles.list().then(({ profiles: list }) => {
      setProfiles(list);
      if (!list.length) setMode('create');
    });
  }, []);

  const choose = (p) => {
    if (p.hasPin) {
      setSelected(p);
      setMode('pin');
    } else {
      signIn(p);
    }
  };

  return html`<div class="gate">
    <div class="drag-strip"></div>
    <div class="gate-inner">
      <div class="gate-brand">
        <div class="gate-logo"><${LogoMark} size=${84} /></div>
        <${Wordmark} size=${40} />
        <p class="gate-tagline">${APP_TAGLINE}</p>
      </div>

      ${mode === 'pick' && html`<div class="gate-card">
        <h2 class="gate-title">Who's logging today?</h2>
        <div class="profile-grid">
          ${profiles.map((p) => html`<button type="button" class="profile-card" onClick=${() => choose(p)}>
            <${Avatar} name=${p.name} color=${p.color} size=${56} />
            <span class="profile-name">${p.name}</span>
            <span class="profile-role">${p.role || 'Consultant'}</span>
            <span class="profile-meta">${p.hasPin && html`<${Icon} name="lock" size=${12} />`} ${p.lastOpenedAt ? `Last in ${relativeTime(p.lastOpenedAt)}` : 'New'}</span>
          </button>`)}
          <button type="button" class="profile-card profile-card-new" onClick=${() => setMode('create')}>
            <span class="profile-plus"><${Icon} name="user-plus" size=${24} /></span>
            <span class="profile-name">New profile</span>
            <span class="profile-role">No email needed</span>
          </button>
        </div>
      </div>`}

      ${mode === 'create' && html`<${CreateProfile} canCancel=${profiles.length > 0} onCancel=${() => setMode('pick')} />`}
      ${mode === 'pin' && selected && html`<${PinUnlock} profile=${selected} onBack=${() => { setMode('pick'); setSelected(null); }} />`}

      <p class="gate-foot"><${Icon} name="shield-check" size=${14} /> Everything stays on this computer. No accounts, no cloud.</p>
    </div>
  </div>`;
}

function CreateProfile({ canCancel, onCancel }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [color, setColor] = useState(PALETTE[6]);
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return setError('Add your name to continue.');
    if (usePin && !/^\d{4,8}$/.test(pin)) return setError('PIN must be 4 to 8 digits.');
    if (usePin && pin !== pin2) return setError("PINs don't match.");
    setBusy(true);
    try {
      const profile = await bridge.profiles.create({ name: name.trim(), role: role.trim(), color, pin: usePin ? pin : null });
      await signIn(profile);
      if (demo) loadDemo();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  };

  return html`<form class="gate-card gate-form" onSubmit=${submit}>
    <div class="gate-form-head">
      <${Avatar} name=${name || '?'} color=${color} size=${52} />
      <div>
        <h2 class="gate-title">Create your profile</h2>
        <p class="muted">A local profile keeps your clients, logs and theme separate.</p>
      </div>
    </div>
    <div class="form-grid">
      <${Field} label="Your name"><input class="input" value=${name} onInput=${(e) => { setName(e.currentTarget.value); setError(''); }} placeholder="e.g. Alex Morgan" autofocus maxlength="60" /><//>
      <${Field} label="Role" hint="Optional"><input class="input" value=${role} onInput=${(e) => setRole(e.currentTarget.value)} placeholder="Implementation Consultant" maxlength="80" /><//>
    </div>
    <${Field} label="Profile color" group><${ColorPicker} value=${color} onChange=${setColor} /><//>
    <div class="gate-options">
      <${Switch} checked=${usePin} onChange=${setUsePin} label="Protect with a PIN" hint="Handy on a shared computer. This is a lock screen, not encryption." />
      ${usePin && html`<div class="form-grid">
        <${Field} label="PIN"><input class="input input-pin" type="password" inputmode="numeric" maxlength="8" value=${pin} onInput=${(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))} placeholder="4-8 digits" /><//>
        <${Field} label="Confirm PIN"><input class="input input-pin" type="password" inputmode="numeric" maxlength="8" value=${pin2} onInput=${(e) => setPin2(e.currentTarget.value.replace(/\D/g, ''))} placeholder="Repeat PIN" /><//>
      </div>`}
      <${Switch} checked=${demo} onChange=${setDemo} label="Start with sample data" hint="Five example clients and two weeks of logs. Remove them anytime in Settings." />
    </div>
    ${error && html`<div class="form-error"><${Icon} name="triangle-alert" size=${15} /> ${error}</div>`}
    <div class="gate-actions">
      ${canCancel && html`<${Button} variant="ghost" onClick=${onCancel}>Back</${Button}>`}
      <button type="submit" class="btn btn-primary btn-lg" disabled=${busy}>
        <span>${busy ? 'Setting up…' : 'Create profile'}</span><${Icon} name="arrow-right" size=${17} />
      </button>
    </div>
  </form>`;
}

function PinUnlock({ profile, onBack }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const ref = useRef(null);

  const submit = async (e) => {
    e?.preventDefault();
    if (await bridge.profiles.verifyPin(profile.id, pin)) {
      signIn(profile);
    } else {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 450);
      ref.current?.focus();
    }
  };

  return html`<form class=${cx('gate-card gate-pin', shake && 'shake')} onSubmit=${submit}>
    <${Avatar} name=${profile.name} color=${profile.color} size=${64} />
    <h2 class="gate-title">Welcome back, ${profile.name.split(' ')[0]}</h2>
    <p class="muted">Enter your PIN to unlock.</p>
    <div class="pin-dots" aria-hidden="true">
      ${Array.from({ length: Math.max(4, pin.length) }, (_, i) => html`<span class=${cx('pin-dot', i < pin.length && 'is-filled')}></span>`)}
    </div>
    <input ref=${ref} class="pin-hidden" type="password" inputmode="numeric" maxlength="8" autofocus value=${pin}
      onInput=${(e) => { setPin(e.currentTarget.value.replace(/\D/g, '')); setError(false); }} aria-label="PIN" />
    ${error && html`<div class="form-error">Incorrect PIN. Try again.</div>`}
    <div class="gate-actions">
      <${Button} variant="ghost" icon="arrow-left" onClick=${onBack}>Switch profile</${Button}>
      <button type="submit" class="btn btn-primary" disabled=${pin.length < 4}><${Icon} name="lock-open" size=${16} /><span>Unlock</span></button>
    </div>
  </form>`;
}
