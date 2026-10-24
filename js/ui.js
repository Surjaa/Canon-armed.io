// UI layer. Colours come only from the three-colour system defined in index.html:
//   --primary, --secondary, --text, plus --bg (black or white, following the system theme).
// JSS generates the classes; DOM helpers drive HUD, panels and popups.
// If JSS fails to load, the game still plays (Bootstrap layout and buttons stay usable).

const PRI = 'var(--primary)';
const SEC = 'var(--secondary)';
const TXT = 'var(--text)';
const BG = 'var(--bg)';
// Tint of a token, used for borders, glows and soft fills.
const tint = (token, pct) => `color-mix(in srgb, ${token} ${pct}%, transparent)`;
const MUTED = tint(TXT, 70);
// Bootstrap's .btn hover/focus/active rules outrank single-class styles, so each button
// re-states its colours for every state (otherwise its fill vanishes after a tap).
const lock = (background, color, extra = {}) => ({
  '&:hover, &:focus, &:focus-visible, &:active': { background, color, ...extra },
});
const LINE = tint(PRI, 40);
const FONT_DISPLAY = "'Orbitron', 'Segoe UI', Arial, sans-serif";
const FONT_BODY = "'Rajdhani', 'Segoe UI', Arial, sans-serif";

const styles = {
  '@global': {
    body: {
      margin: 0, background: BG, color: TXT, fontFamily: FONT_BODY, overflow: 'hidden',
      touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
    },
    '*:focus-visible': { outline: `3px solid ${PRI}`, outlineOffset: 3 },
  },

  stage: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'block', zIndex: 0 },

  vignette: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 3, opacity: 0 },

  toast: {
    position: 'fixed', top: '30%', left: 0, right: 0, zIndex: 7, pointerEvents: 'none', textAlign: 'center',
    fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 'clamp(26px, 7vw, 48px)', letterSpacing: 6, color: PRI,
  },

  popup: {
    position: 'fixed', zIndex: 6, pointerEvents: 'none', whiteSpace: 'nowrap',
    fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20,
  },

  // Top bar, pinned to the top with notch padding
  hud: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 5, pointerEvents: 'none',
    paddingTop: 'env(safe-area-inset-top, 0px)', fontFamily: FONT_DISPLAY,
    '& button': { pointerEvents: 'auto' },
  },

  hudCard: {
    background: tint(BG, 80), border: `1px solid ${LINE}`, borderRadius: 14, padding: '6px 12px',
  },

  stat: {
    display: 'flex', flexDirection: 'column', lineHeight: 1.05,
    '& .label': { fontSize: 11, letterSpacing: 2.5, color: MUTED, textTransform: 'uppercase' },
    '& .value': { fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: PRI },
  },

  statBest: { '& .value': { fontSize: 16, color: TXT } },

  lives: { display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' },

  heart: {
    width: 22, height: 20, display: 'block', color: SEC,
    '& svg': { width: '100%', height: '100%', display: 'block' },
  },
  heartOff: { opacity: 0.22 },

  waveLabel: { fontSize: 13, letterSpacing: 2, color: TXT, textTransform: 'uppercase', textAlign: 'center' },

  mult: { fontSize: 20, fontWeight: 800, color: SEC, fontVariantNumeric: 'tabular-nums', textAlign: 'center' },

  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 },

  chip: {
    padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
    border: `1px solid ${PRI}`, background: tint(BG, 85), color: PRI, fontVariantNumeric: 'tabular-nums',
  },
  chipSpread: { borderColor: SEC, color: SEC },
  chipRapid: { borderColor: PRI, color: PRI },
  chipShield: { borderColor: TXT, color: TXT },

  iconBtn: {
    ...lock(tint(BG, 85), TXT, { borderColor: LINE }),
    width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', padding: 0,
    background: tint(BG, 85), border: `1px solid ${LINE}`, color: TXT, transition: 'transform .15s',
    '&:active': { transform: 'scale(0.96)' },
    '& svg': { width: 22, height: 22, fill: 'currentColor' },
  },

  autoBtn: {
    whiteSpace: 'nowrap',
    ...lock(tint(BG, 85), MUTED),
    height: 46, padding: '0 14px', borderRadius: 14, fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: 1.5,
    background: tint(BG, 85), border: `1px solid ${LINE}`, color: MUTED,
    '&[aria-pressed="true"]': { color: BG, background: PRI, borderColor: PRI },
    '&:active': { transform: 'scale(0.97)' },
  },

  // Bottom control bar (touch-friendly)
  controls: {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 5,
    paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
    paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))',
    paddingRight: 'max(16px, env(safe-area-inset-right, 0px))',
    display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 12, alignItems: 'end', pointerEvents: 'none',
    '& button': { pointerEvents: 'auto', touchAction: 'none' },
  },

  padBtn: {
    ...lock(tint(BG, 88), TXT),
    height: 84, borderRadius: 22, border: `1px solid ${LINE}`, color: TXT,
    background: tint(BG, 88), fontFamily: FONT_DISPLAY, display: 'grid', placeItems: 'center',
    transition: 'transform .08s, box-shadow .15s',
    '&:active, &.held': { transform: 'scale(0.97)', borderColor: PRI, color: PRI },
    '& svg': { width: 36, height: 36, fill: 'currentColor' },
  },

  fireBtn: {
    ...lock(SEC, BG),
    height: 96, borderRadius: 28, border: 'none', color: BG, background: SEC,
    fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, letterSpacing: 3,
    display: 'grid', placeItems: 'center', transition: 'transform .08s',
    '&:active, &.held': { transform: 'scale(0.96)' },
  },

  // Overlays
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))',
    overflowY: 'auto', background: tint(BG, 88),
  },

  glass: {
    width: '100%', maxWidth: 480, boxSizing: 'border-box', padding: '24px 20px', textAlign: 'center',
    borderRadius: 24, background: BG, color: TXT, border: `1px solid ${LINE}`,
    boxShadow: `0 0 40px ${tint(PRI, 20)}`,
    '@media (min-width: 768px)': { padding: '36px 36px' },
  },

  emblem: { width: 56, height: 'auto', marginBottom: 4 },

  eyebrow: { margin: '4px 0 0', fontSize: 13, letterSpacing: 3.5, textTransform: 'uppercase', color: PRI },

  title: {
    fontFamily: FONT_DISPLAY, fontWeight: 800, lineHeight: 0.95, margin: '8px 0 10px',
    fontSize: 'clamp(40px, 11vw, 70px)', color: TXT,
  },
  titleSmall: { fontSize: 'clamp(30px, 8vw, 42px)', margin: '6px 0 2px' },

  lead: { margin: 0, fontSize: 18, color: MUTED, lineHeight: 1.35 },

  sectionLabel: {
    margin: '20px 0 8px', fontSize: 12, letterSpacing: 2.5, textTransform: 'uppercase', color: MUTED, textAlign: 'left',
  },

  diffGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: 10, margin: 0, padding: 0 },

  diffCard: {
    ...lock('transparent', TXT),
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%',
    minHeight: 64, padding: '12px 16px', textAlign: 'left', borderRadius: 16, cursor: 'pointer',
    background: 'transparent', border: `1px solid ${LINE}`, color: TXT,
    '&[aria-pressed="true"]': { borderColor: PRI, borderWidth: 2, background: tint(PRI, 10) },
    '& .name': { fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, letterSpacing: 2, color: TXT },
    '& .sub': { display: 'block', fontSize: 14, color: MUTED, marginTop: 2 },
    '& .tag': {
      fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: 1.5, padding: '4px 8px', borderRadius: 999,
      border: '1px solid currentColor', whiteSpace: 'nowrap',
    },
  },
  diffEasy: { '& .tag': { color: PRI } },
  diffMed: { '& .tag': { color: TXT } },
  diffHard: { '& .tag': { color: SEC } },

  diffNote: { margin: '10px 0 0', fontSize: 15, color: MUTED, minHeight: 22 },

  btnPrimary: {
    ...lock(PRI, BG),
    minHeight: 58, background: PRI, color: BG, border: 'none', borderRadius: 16,
    fontFamily: FONT_DISPLAY, fontWeight: 800, letterSpacing: 3, transition: 'transform .2s',
    '&:hover': { transform: 'scale(1.01)', color: BG, background: PRI },
    '&:active': { transform: 'scale(0.99)' },
  },

  btnGhost: {
    ...lock('transparent', TXT),
    minHeight: 50, background: 'transparent', color: TXT, border: `1px solid ${LINE}`,
    borderRadius: 16, fontFamily: FONT_DISPLAY, letterSpacing: 2,
    '&:hover': { background: tint(PRI, 10), color: TXT },
    '&:active': { transform: 'scale(0.99)' },
  },

  // How-to steps
  steps: { listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 10, textAlign: 'left' },
  step: {
    display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, alignItems: 'center',
    padding: '10px 12px', borderRadius: 14, border: `1px solid ${LINE}`, color: TXT,
    fontSize: 17, lineHeight: 1.3,
    '& .ico': {
      width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
      border: `1px solid ${PRI}`, color: PRI, fontFamily: FONT_DISPLAY, fontWeight: 800,
    },
  },

  badge: {
    display: 'inline-block', padding: '4px 14px', borderRadius: 999, background: SEC, color: BG,
    fontFamily: FONT_DISPLAY, fontWeight: 800, letterSpacing: 2, fontSize: 13,
  },

  bigScore: {
    fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 'clamp(46px, 13vw, 78px)', lineHeight: 1,
    color: PRI, fontVariantNumeric: 'tabular-nums', margin: '8px 0',
  },

  statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '18px 0' },
  statCard: {
    borderRadius: 14, padding: '10px 12px', border: `1px solid ${LINE}`, color: TXT,
    '& small': { display: 'block', color: MUTED, letterSpacing: 2, textTransform: 'uppercase', fontSize: 11 },
    '& strong': { fontFamily: FONT_DISPLAY, fontSize: 20, color: TXT },
  },

  hint: { margin: '12px 0 0', fontSize: 15, color: MUTED },
};

const jssLib = (window.jss && window.jssPresetDefault)
  ? window.jss.create(window.jssPresetDefault.default())
  : null;
const jssSheet = jssLib ? jssLib.createStyleSheet(styles).attach() : null;
// Move the game styles to the end of <body> so they come after Bootstrap's inlined CSS
// (Bootstrap's .btn rules would otherwise override them on hosts that inline the CSS).
if (jssSheet && jssSheet.element) document.body.appendChild(jssSheet.element);
const classes = jssSheet ? jssSheet.classes : {};
const cls = (name) => classes[name] || '';

// Apply classes from data-style="a b" attributes.
function applyStyles(root = document) {
  root.querySelectorAll('[data-style]').forEach((el) => {
    el.dataset.style.split(' ').forEach((name) => { if (classes[name]) el.classList.add(classes[name]); });
  });
}
applyStyles();

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cache = {};

function setText(id, value) {
  const str = String(value);
  if (cache[id] === str) return;
  cache[id] = str;
  const el = $(id);
  if (el) el.textContent = str;
}

const PANELS = ['menu', 'howto', 'pause', 'over'];

const HEART = '<svg viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21.4 10.6 20C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5L12 21.4z" fill="currentColor"/></svg>';

export const ui = {
  showPanel(name) {
    for (const p of PANELS) {
      const el = $(`panel-${p}`);
      if (el) el.classList.toggle('d-none', p !== name);
    }
    const panel = name ? $(`panel-${name}`) : null;
    if (panel && !reduceMotion) {
      panel.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    }
    if (panel) {
      const first = panel.querySelector('[data-focus]') || panel.querySelector('button');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
    }
  },

  setDifficulty(key, notes) {
    document.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.diff === key));
    });
    $('diff-note').textContent = notes[key] || '';
  },

  setGameUI(playing) {
    $('hud').classList.toggle('d-none', !playing);
  },

  setAutoFire(on) {
    const b = $('btn-auto');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'Auto fire: on' : 'Auto fire: off';
  },

  setMuted(muted) {
    const btn = $('btn-sound');
    btn.setAttribute('aria-pressed', String(muted));
    btn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
    btn.querySelector('.icon-on').classList.toggle('d-none', muted);
    btn.querySelector('.icon-off').classList.toggle('d-none', !muted);
  },

  setBest(best) { setText('menu-best', best.toLocaleString()); },

  hud({ score, best, lives, maxLives, wave, mult, combo, active }) {
    setText('hud-score', score.toLocaleString());
    setText('hud-best', best.toLocaleString());
    setText('hud-wave', `Wave ${wave}`);
    setText('hud-mult', `x${mult}`);
    $('hud-combo').textContent = combo >= 2 ? `${combo} kill chain` : '';

    const key = `${lives}/${maxLives}`;
    if (cache.lives !== key) {
      cache.lives = key;
      const wrap = $('hud-lives');
      wrap.replaceChildren();
      for (let i = 0; i < maxLives; i++) {
        const h = document.createElement('span');
        h.className = `${cls('heart')} ${i < lives ? '' : cls('heartOff')}`;
        h.innerHTML = HEART;
        wrap.appendChild(h);
      }
      wrap.setAttribute('aria-label', `${lives} of ${maxLives} lives`);
    }

    const chipKey = active.map((a) => `${a.key}:${Math.ceil(a.seconds)}`).join('|');
    if (cache.power !== chipKey) {
      cache.power = chipKey;
      const row = $('hud-power');
      row.replaceChildren();
      for (const a of active) {
        const chip = document.createElement('span');
        chip.className = `${cls('chip')} ${cls(`chip${a.key[0].toUpperCase()}${a.key.slice(1)}`)}`;
        chip.dataset.key = a.key;
        row.appendChild(chip);
      }
    }
    for (const chip of $('hud-power').children) {
      const a = active.find((x) => x.key === chip.dataset.key);
      if (a) chip.textContent = `${a.label} ${Math.ceil(a.seconds)}s`;
    }
  },

  showOver({ score, best, kills, wave, diff, newBest }) {
    setText('over-score', score.toLocaleString());
    setText('over-best', best.toLocaleString());
    setText('over-kills', kills);
    setText('over-wave', wave);
    setText('over-diff', diff);
    $('over-newbest').classList.toggle('d-none', !newBest);
    this.showPanel('over');
  },

  popup(x, y, text, css) {
    const el = document.createElement('div');
    el.className = cls('popup');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.color = css;
    el.textContent = text;
    document.body.appendChild(el);
    if (reduceMotion) { setTimeout(() => el.remove(), 600); return; }
    const anim = el.animate([
      { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 1 },
      { transform: 'translate(-50%, -50%) translateY(-44px) scale(1.15)', opacity: 0 },
    ], { duration: 800, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    anim.onfinish = () => el.remove();
  },

  toast(text) {
    const el = $('toast');
    el.textContent = text;
    if (!reduceMotion) {
      el.animate([
        { opacity: 0, transform: 'scale(0.92)' },
        { opacity: 1, transform: 'scale(1)', offset: 0.15 },
        { opacity: 1, transform: 'scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'scale(1.04)' },
      ], { duration: 1600, easing: 'ease-out' });
    }
  },

  flash() {
    if (reduceMotion) return;
    $('vignette').animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 550, easing: 'ease-out' });
  },
};


export { applyStyles };
