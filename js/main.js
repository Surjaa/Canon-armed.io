import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sfx } from './audio.js';
import { ui, applyStyles } from './ui.js';

// ============================================================
// Settings
// ============================================================
const PLAYER_Z = 7;             // depth of the cannon
const PLAY_HALF = 6.5;          // playfield half-width
const SPAWN_Z = -40;            // enemies appear in the distance and fly toward the cannon
const BULLET_SPEED = 70;
const MOVE_SPEED = 9;
const WAVE_SECONDS = 15;
const WAVE_SHOW = 'Wave';

// Three-colour palette (primary, secondary, text) on black (dark theme) or white (light theme).
const THEMES = {
  dark:  { bg: 0x000000, primary: 0x4fb3ff, secondary: 0xff4fa3, text: 0xffffff },
  light: { bg: 0xffffff, primary: 0x0067d6, secondary: 0xd6246e, text: 0x000000 },
};
const isLightTheme = matchMedia('(prefers-color-scheme: light)').matches;
const PAL = isLightTheme ? THEMES.light : THEMES.dark;
// Neutral greys for hulls and metal (black/white family only)
const NEUTRAL = isLightTheme
  ? { body: 0xdedede, steel: 0xbfbfbf, dark: 0x8c8c8c }
  : { body: 0x1c1c1c, steel: 0x3a3a3a, dark: 0x0d0d0d };
// Reload when the system theme flips, so every colour is rebuilt from the palette
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => location.reload());

// Difficulty levels
const DIFFICULTY = {
  normal: { label: 'Normal', lives: 3, speed: 0.8, spawn: 1.3, drop: 0.18, tag: 'Easy' },
  medium: { label: 'Medium', lives: 2, speed: 1.0, spawn: 1.0, drop: 0.12, tag: 'Standard' },
  hard:   { label: 'Hard', lives: 1, speed: 1.35, spawn: 0.7, drop: 0.08, tag: 'Intense' },
};
const DIFF_NOTES = {
  normal: '3 lives. Slower swarms. Good for learning.',
  medium: '2 lives. Big swarms, fast enemies.',
  hard: '1 life. Huge swarms. One hit and you are out.',
};

const ENEMY_SCALE = 1.7; // enemies drawn and hit-tested at this multiple of their base size
const ENEMY = {
  drone:   { size: 0.95, hp: 1, pts: 10, speed: [9, 11],    color: PAL.primary,    fromWave: 0 },
  pod:     { size: 1.1,  hp: 2, pts: 25, speed: [7, 8.5],    color: PAL.secondary, fromWave: 1 },
  gunship: { size: 1.6,  hp: 5, pts: 60, speed: [5, 6.2],   color: PAL.text,   fromWave: 2 },
};

const POWER = {
  spread: { color: PAL.secondary, label: 'TRIPLE SHOT', dur: 8 },
  rapid:  { color: PAL.primary, label: 'RAPID FIRE', dur: 7 },
  shield: { color: PAL.text, label: 'SHIELD', dur: 10 },
  life:   { color: PAL.secondary, label: '+1 LIFE', dur: 0 },
};

// ============================================================
// Persistence (all wrapped in try/catch)
// ============================================================
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* blocked */ } },
};
const bestKey = (diff) => `canonArmed.best.${diff}`;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================
// Helpers
// ============================================================
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const cssColor = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

// ============================================================
// Renderer, scene, camera
// ============================================================
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // sharp yet light enough for phones
renderer.setSize(window.innerWidth, window.innerHeight, true);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(PAL.bg, 0.004); // lighter haze so distant enemies stay clear

// Realistic reflections on the metal parts
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

// Sky gradient
scene.background = new THREE.Color(PAL.bg);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
// Look straight down the lane at x = 0, with the cannon in the lower-middle of the screen
const camTarget = new THREE.Vector3(0, 0, PLAYER_Z - 1.0); // cannon sits at the bottom of the screen
const camDir = new THREE.Vector3(0, 0.5, 0.87).normalize();

// Frame the playfield so the full width is visible on any screen shape.
function fitCamera() {
  // Canvas is full-screen; buffer and CSS size are kept identical so the view is never stretched
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, true);
  const aspect = w / h;
  camera.aspect = aspect;
  camera.fov = 60;
  const halfNeeded = PLAY_HALF + 2.2;
  const dist = Math.max(11, halfNeeded / (Math.tan(THREE.MathUtils.degToRad(30)) * aspect));
  camera.position.copy(camTarget).addScaledVector(camDir, dist);
  camera.lookAt(camTarget);
  // Shift the picture down so the cannon sits at the bottom, above the controls (centre x unchanged)
  camera.setViewOffset(w, h, 0, -h * 0.42, w, h);
  camera.updateProjectionMatrix();
  camBase.copy(camera.position);
}
const camBase = new THREE.Vector3();
fitCamera();

window.addEventListener('resize', fitCamera);
window.visualViewport?.addEventListener('resize', fitCamera);

// ============================================================
// Lights
// ============================================================
scene.add(new THREE.HemisphereLight(0xffffff, NEUTRAL.body, 0.6));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
sunLight.position.set(-6, 14, 12);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
Object.assign(sunLight.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 60 });
sunLight.shadow.bias = -0.0008;
scene.add(sunLight);
const shipGlow = new THREE.PointLight(PAL.primary, 18, 12, 2);
scene.add(shipGlow);

// ============================================================
// Ground: neon grid texture that scrolls toward the camera
// ============================================================
const GRID_REPEAT = { x: 6, y: 30 };
const GROUND_LEN = 200;
function makeGridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = cssColor(PAL.bg);
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = cssColor(PAL.primary);
  ctx.fillRect(0, 0, 256, 4);
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GRID_REPEAT.x, GRID_REPEAT.y);
  tex.anisotropy = 4;
  return tex;
}
const gridTex = makeGridTexture();
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, GROUND_LEN),
  new THREE.MeshStandardMaterial({
    map: gridTex, emissiveMap: gridTex, emissive: 0xffffff, emissiveIntensity: 0.55,
    roughness: 0.85, metalness: 0.1,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -1.0, -30); // runs past the bottom of the screen
ground.receiveShadow = true;
scene.add(ground);


// Stars
const starPos = new Float32Array(900 * 3);
for (let i = 0; i < 900; i++) {
  starPos[i * 3] = rand(-200, 200);
  starPos[i * 3 + 1] = rand(-5, 120);
  starPos[i * 3 + 2] = rand(-260, -90);
}
const stars = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos, 3)),
  new THREE.PointsMaterial({ color: PAL.text, size: 1.2, transparent: true, opacity: 0.5, fog: false }),
);
scene.add(stars);

// ============================================================
// Shared materials, geometry and glow sprites
// ============================================================
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const glowTex = makeGlowTexture();
const glowMat = (hex) => new THREE.SpriteMaterial({
  map: glowTex, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false,
});
const GLOW = {
  cyan: glowMat(PAL.primary), magenta: glowMat(PAL.secondary), amber: glowMat(PAL.text),
  lime: glowMat(PAL.primary), red: glowMat(PAL.secondary),
};

const M = {
  steel: new THREE.MeshStandardMaterial({ color: NEUTRAL.steel, metalness: 0.8, roughness: 0.3 }),
  steelDark: new THREE.MeshStandardMaterial({ color: NEUTRAL.dark, metalness: 0.7, roughness: 0.45 }),
  armor: new THREE.MeshStandardMaterial({ color: NEUTRAL.body, metalness: 0.65, roughness: 0.38 }),
  droneBody: new THREE.MeshStandardMaterial({ color: NEUTRAL.dark, metalness: 0.6, roughness: 0.35 }),
  podBody: new THREE.MeshStandardMaterial({ color: NEUTRAL.dark, metalness: 0.5, roughness: 0.4 }),
  gunBody: new THREE.MeshStandardMaterial({ color: NEUTRAL.body, metalness: 0.6, roughness: 0.35 }),
  glass: new THREE.MeshStandardMaterial({ color: NEUTRAL.dark, metalness: 0.9, roughness: 0.05 }),
  rotor: new THREE.MeshBasicMaterial({ color: PAL.primary, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  cyanGlow: new THREE.MeshBasicMaterial({ color: PAL.primary, toneMapped: false }),
  magentaGlow: new THREE.MeshBasicMaterial({ color: PAL.secondary, toneMapped: false }),
  amberGlow: new THREE.MeshBasicMaterial({ color: PAL.text, toneMapped: false }),
};
const BULLET_MAT = {
  cyan: new THREE.MeshBasicMaterial({ color: PAL.primary, toneMapped: false }),
  amber: new THREE.MeshBasicMaterial({ color: PAL.text, toneMapped: false }),
  lime: new THREE.MeshBasicMaterial({ color: PAL.primary, toneMapped: false }),
};
const BULLET_GEO = new THREE.CapsuleGeometry(0.09, 0.9, 4, 10);
BULLET_GEO.rotateX(Math.PI / 2);
const BULLET_GLOW = { cyan: GLOW.cyan, amber: GLOW.amber, lime: GLOW.lime };

// ============================================================
// Player cannon: armored hover-tank
// ============================================================
const ship = new THREE.Group();
ship.scale.setScalar(1.3); // a little larger so the cannon is easy to see
const hullBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 2.6), M.armor);
hullBody.position.y = 0.35;
const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 2.8), M.steelDark);
const skirtR = skirtL.clone();
skirtL.position.set(-1.75, 0.15, 0);
skirtR.position.set(1.75, 0.15, 0);
const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.steel);
dome.position.y = 0.62;
const turretRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 10, 48), M.cyanGlow);
turretRing.rotation.x = Math.PI / 2;
turretRing.position.y = 0.62;
const frontLight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), M.cyanGlow);
frontLight.position.set(0, 0.42, -1.33);

const barrelPivot = new THREE.Group();
barrelPivot.position.set(0, 0.95, 0);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 2.7, 20), M.steelDark);
barrel.rotation.x = Math.PI / 2;
barrel.position.z = -1.35;
const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.4, 20), M.steel);
muzzle.rotation.x = Math.PI / 2;
muzzle.position.z = -2.7;
barrelPivot.add(barrel, muzzle);

const shipShield = new THREE.Mesh(
  new THREE.SphereGeometry(2.4, 32, 20),
  new THREE.MeshBasicMaterial({
    color: PAL.primary, wireframe: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }),
);
shipShield.position.y = 0.5;
const engineGlow = new THREE.Sprite(glowMat(PAL.primary));
engineGlow.position.set(0, -0.1, 1.6);
engineGlow.scale.setScalar(2.2);

ship.add(hullBody, skirtL, skirtR, dome, turretRing, frontLight, barrelPivot, shipShield, engineGlow);
ship.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
ship.position.set(0, -0.4, PLAYER_Z);
scene.add(ship);

// ============================================================
// Enemies: drone, pod, gunship
// ============================================================
// Enemies are drawn with instanced meshes: one draw call per part, so hundreds of ships stay fast
const MAX_ENEMIES_PER_TYPE = 700;
const MAX_ENEMIES_TOTAL = 200;
const ENEMY_PARTS = {
  drone: { geo: new THREE.SphereGeometry(0.5, 14, 10), mat: M.droneBody,
           ringGeo: new THREE.TorusGeometry(0.62, 0.06, 6, 20).rotateX(Math.PI / 2), ringMat: M.cyanGlow },
  pod: { geo: new THREE.CapsuleGeometry(0.55, 1.0, 4, 10).rotateX(Math.PI / 2), mat: M.podBody,
         ringGeo: new THREE.TorusGeometry(0.56, 0.06, 6, 24).rotateX(Math.PI / 2), ringMat: M.magentaGlow },
  gunship: { geo: new THREE.CylinderGeometry(1.3, 1.5, 0.45, 6), mat: M.gunBody,
             ringGeo: new THREE.TorusGeometry(1.35, 0.05, 6, 32).rotateX(Math.PI / 2), ringMat: M.amberGlow },
};
const enemyMeshes = {};
for (const type of Object.keys(ENEMY_PARTS)) {
  const part = ENEMY_PARTS[type];
  const body = new THREE.InstancedMesh(part.geo, part.mat, MAX_ENEMIES_PER_TYPE);
  const ring = new THREE.InstancedMesh(part.ringGeo, part.ringMat, MAX_ENEMIES_PER_TYPE);
  body.frustumCulled = false;
  ring.frustumCulled = false;
  body.count = 0;
  ring.count = 0;
  scene.add(body, ring);
  enemyMeshes[type] = { body, ring };
}
const enemyPos = (e) => new THREE.Vector3(e.x, 0.9, e.z);
const _em = new THREE.Matrix4();
const _ep = new THREE.Vector3();
const _eq = new THREE.Quaternion();
const _es = new THREE.Vector3();
const _ee = new THREE.Euler();
function syncEnemies() {
  const counts = { drone: 0, pod: 0, gunship: 0 };
  for (const e of enemies) {
    const i = counts[e.type];
    if (i >= MAX_ENEMIES_PER_TYPE) continue;
    counts[e.type] = i + 1;
    _ep.set(e.x, 0.9, e.z);
    _eq.setFromEuler(_ee.set(0, e.yaw || 0, 0));
    _es.setScalar(ENEMY_SCALE * e.def.size * (1 + e.flash * 0.22));
    _em.compose(_ep, _eq, _es);
    enemyMeshes[e.type].body.setMatrixAt(i, _em);
    enemyMeshes[e.type].ring.setMatrixAt(i, _em);
  }
  for (const type of Object.keys(enemyMeshes)) {
    const { body, ring } = enemyMeshes[type];
    body.count = counts[type];
    ring.count = counts[type];
    body.instanceMatrix.needsUpdate = true;
    ring.instanceMatrix.needsUpdate = true;
  }
}

// ============================================================
// Particles and shockwaves
// ============================================================
class Sparks {
  constructor(max = 900) {
    this.max = max;
    this.next = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.34, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(p, hex, count, speed, life = 0.8) {
    const c = new THREE.Color(hex);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const k = i * 3;
      this.pos[k] = p.x; this.pos[k + 1] = p.y; this.pos[k + 2] = p.z;
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u) * speed * rand(0.3, 1);
      this.vel[k] = Math.cos(th) * s;
      this.vel[k + 1] = u * speed * rand(0.3, 1);
      this.vel[k + 2] = Math.sin(th) * s;
      this.base[k] = c.r; this.base[k + 1] = c.g; this.base[k + 2] = c.b;
      this.life[i] = life;
      this.maxLife[i] = life;
    }
  }

  update(dt) {
    const { pos, vel, col, base, life } = this;
    const drag = Math.exp(-2.2 * dt);
    for (let i = 0; i < this.max; i++) {
      const k = i * 3;
      if (life[i] > 0) {
        life[i] -= dt;
        vel[k + 1] -= 6 * dt;
        vel[k] *= drag; vel[k + 1] *= drag; vel[k + 2] *= drag;
        pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
        const f = Math.max(0, life[i] / this.maxLife[i]);
        col[k] = base[k] * f; col[k + 1] = base[k + 1] * f; col[k + 2] = base[k + 2] * f;
      } else {
        col[k] = col[k + 1] = col[k + 2] = 0;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
const sparks = new Sparks(900);

const effects = [];
const RING_GEO = new THREE.RingGeometry(0.85, 1, 56);
function shockwave(x, z, hex, maxScale = 5, dur = 0.55) {
  const mat = new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const ring = new THREE.Mesh(RING_GEO, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, -0.9, z);
  scene.add(ring);
  effects.push({
    t: 0, dur,
    update(p) { ring.scale.setScalar(0.5 + p * maxScale); mat.opacity = 0.9 * (1 - p); },
    done() { scene.remove(ring); mat.dispose(); },
  });
}

// ============================================================
// Game state
// ============================================================
const game = {
  mode: 'menu', // menu | playing | paused | over
  diff: store.get('canonArmed.diff', 'medium'),
  score: 0,
  lives: 3,
  maxLives: 3,
  combo: 0,
  comboT: 0,
  mult: 1,
  elapsed: 0,
  level: -1,
  kills: 0,
  spawnT: 0,
  fireT: 0,
  invuln: 0,
  recoil: 0,
  autoFire: store.get('canonArmed.autoFire', '1') === '1',
  timers: { spread: 0, rapid: 0, shield: 0 },
};
if (!DIFFICULTY[game.diff]) game.diff = 'medium';
const player = { x: 0, lastX: 0 };
const input = { left: false, right: false, fire: false, drag: null };
let enemies = [];
let bullets = [];
let powerups = [];
let shake = 0;
let time = 0;

function resetWorld() {
  for (const b of bullets) scene.remove(b.mesh);
  for (const p of powerups) disposePowerup(p);
  enemies = []; bullets = []; powerups = [];
  const cfg = DIFFICULTY[game.diff];
  Object.assign(game, {
    score: 0, lives: cfg.lives, maxLives: cfg.lives, combo: 0, comboT: 0, mult: 1, elapsed: 0,
    level: -1, kills: 0, spawnT: 1, fireT: 0, invuln: 0, recoil: 0,
    waveSpawned: 0, waveBudget: 0, spawnAcc: 0,
  });
  game.timers.spread = game.timers.rapid = game.timers.shield = 0;
  player.x = 0;
  player.lastX = 0;
}

// ============================================================
// Spawning
// ============================================================
function spawnEnemy() {
  const lvl = Math.max(0, game.level);
  const r = Math.random();
  // Enemy mix shifts toward tougher ships as waves go on
  let type = 'drone';
  const gunshipChance = lvl >= 2 ? Math.min(0.35, 0.03 * lvl) : 0;
  const podChance = lvl >= 1 ? 0.22 + Math.min(0.2, 0.02 * lvl) : 0;
  if (r < gunshipChance) type = 'gunship';
  else if (r < gunshipChance + podChance) type = 'pod';

  const def = ENEMY[type];
  const x = rand(-PLAY_HALF + 1.3, PLAY_HALF - 1.3);
  const speedMul = DIFFICULTY[game.diff].speed * (1 + lvl * 0.12); // +12% speed every wave
  enemies.push({
    type, def, yaw: 0,
    x, z: SPAWN_Z, baseX: x,
    amp: rand(0.2, 0.8), freq: rand(0.6, 1.2), phase: rand(0, Math.PI * 2),
    speed: rand(def.speed[0], def.speed[1]) * speedMul,
    hp: def.hp + (type !== 'drone' && lvl >= 6 ? 1 : 0), flash: 0, r: def.size * 0.95 * ENEMY_SCALE,
  });
}

function pickPowerType() {
  const weights = [['spread', 0.35], ['rapid', 0.3], ['shield', 0.2], ['life', 0.15]]
    .filter(([k]) => k !== 'life' || game.lives < game.maxLives);
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of weights) { r -= w; if (r <= 0) return k; }
  return weights[0][0];
}

function makePowerup(type, x, z) {
  const def = POWER[type];
  const group = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({ color: NEUTRAL.dark, emissive: def.color, emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.2 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), coreMat);
  const ringMat = new THREE.MeshBasicMaterial({ color: def.color, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 40), ringMat);
  ring.rotation.x = Math.PI / 2;
  const glow = new THREE.Sprite(glowMat(def.color));
  glow.scale.setScalar(2.4);
  group.add(core, ring, glow);
  group.position.set(x, 0.9, z);
  scene.add(group);
  return { type, mesh: group, core, coreMat, ring, ringMat, glow, x, z, life: 12, phase: rand(0, 6.28) };
}

function disposePowerup(p) {
  scene.remove(p.mesh);
  p.coreMat.dispose();
  p.ringMat.dispose();
  p.glow.material.dispose();
}

function fireVolley() {
  const rapid = game.timers.rapid > 0;
  const spread = game.timers.spread > 0;
  game.fireT = rapid ? 0.09 : 0.2;
  const matKey = spread ? 'amber' : rapid ? 'lime' : 'cyan';
  const shots = spread ? [-7, 0, 7] : [0];
  for (const vx of shots) {
    const mesh = new THREE.Mesh(BULLET_GEO, BULLET_MAT[matKey]);
    const glow = new THREE.Sprite(BULLET_GLOW[matKey]);
    glow.scale.setScalar(1.3);
    mesh.add(glow);
    const bullet = { mesh, x: player.x, z: PLAYER_Z - 2.9, pz: PLAYER_Z - 2.9, vx };
    mesh.position.set(bullet.x, 0.9, bullet.z);
    scene.add(mesh);
    bullets.push(bullet);
  }
  game.recoil = 1;
  sparks.burst({ x: player.x, y: 0.9, z: PLAYER_Z - 2.9 }, spread ? PAL.text : PAL.primary, 4, 3, 0.2);
  sfx.shoot(spread);
}

// ============================================================
// Gameplay events
// ============================================================
function screenPos(v) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
}
const tmpV = new THREE.Vector3();
function popupAt(vec, text, hex) {
  const s = screenPos(vec);
  ui.popup(s.x, s.y, text, cssColor(hex));
}
function addShake(amount) { if (!reduceMotion) shake = Math.max(shake, amount); }

function hitEnemy(e, idx) {
  e.hp -= 1;
  e.flash = 1;
  sfx.hit();
  sparks.burst(enemyPos(e), PAL.text, 8, 5, 0.3);
  if (e.hp <= 0) killEnemy(e, idx);
}

function killEnemy(e, idx) {
  enemies.splice(idx, 1);
  const pos = enemyPos(e);
  const big = e.type === 'gunship';
  const col = ENEMY[e.type].color;
  sparks.burst(pos, col, big ? 140 : e.type === 'pod' ? 60 : 36, big ? 10 : 6.5, big ? 1.1 : 0.8);
  shockwave(pos.x, pos.z, col, big ? 7 : 4.2);
  sfx.explode(e.def.size);
  addShake(big ? 0.6 : 0.25);

  game.kills += 1;
  game.combo += 1;
  game.comboT = 2.0;
  game.mult = 1 + Math.min(4, Math.floor(game.combo / 4));
  const pts = e.def.pts * game.mult;
  game.score += pts;
  if (game.combo >= 4 && game.combo % 4 === 0) sfx.combo(game.mult);
  popupAt(pos, `+${pts}`, col);

  if (Math.random() < DIFFICULTY[game.diff].drop) powerups.push(makePowerup(pickPowerType(), pos.x, pos.z));
}

function removeEnemy(idx) {
  const e = enemies[idx];
  enemies.splice(idx, 1);
  return e;
}

function damagePlayer() {
  if (game.invuln > 0) return;
  if (game.timers.shield > 0) {
    game.timers.shield = 0;
    game.invuln = 0.6;
    sfx.shieldHit();
    shockwave(player.x, PLAYER_Z, PAL.primary, 4, 0.45);
    popupAt(ship.position.clone().add(tmpV.set(0, 2.6, 0)), 'SHIELD BLOCKED', PAL.primary);
    addShake(0.3);
    return;
  }
  game.lives -= 1;
  game.invuln = 1.2;
  game.combo = 0;
  game.mult = 1;
  sfx.playerHit();
  sparks.burst(ship.position.clone().add(tmpV.set(0, 0.8, 0)), PAL.secondary, 70, 9, 1);
  shockwave(player.x, PLAYER_Z, PAL.secondary, 6, 0.6);
  ui.flash();
  addShake(0.9);
  if (game.lives <= 0) gameOver();
}

function collectPowerup(p) {
  sfx.pickup();
  const at = ship.position.clone().add(tmpV.set(0, 2.2, 0));
  if (p.type === 'life') {
    if (game.lives < game.maxLives) {
      game.lives += 1;
      popupAt(at, '+1 LIFE', PAL.secondary);
    } else {
      game.score += 100;
      popupAt(at, '+100', PAL.secondary);
    }
  } else {
    game.timers[p.type] = POWER[p.type].dur;
    popupAt(at, POWER[p.type].label, POWER[p.type].color);
    ui.toast(POWER[p.type].label);
  }
  sparks.burst(p.mesh.position, POWER[p.type].color, 40, 7, 0.7);
}

// ============================================================
// Game flow
// ============================================================
function renderHud() {
  ui.hud({
    score: game.score,
    best: Math.max(bestOf(game.diff), game.score),
    lives: game.lives,
    maxLives: game.maxLives,
    wave: Math.max(1, game.level + 1),
    mult: game.mult,
    combo: game.combo,
    active: Object.keys(game.timers)
      .filter((k) => game.timers[k] > 0)
      .map((k) => ({ key: k, label: POWER[k].label, seconds: game.timers[k] })),
  });
}

function bestOf(diff) {
  return Number(store.get(bestKey(diff), '0')) || 0;
}

async function startGame() {
  if (game.mode === 'playing') return;
  resetWorld();
  game.mode = 'playing';
  ui.showPanel(null);
  ui.setGameUI(true);
  renderHud();
  await sfx.init();
  sfx.click();
  sfx.playMusic();
  ui.toast('Get ready');
}

function togglePause() {
  if (game.mode === 'playing') {
    game.mode = 'paused';
    input.fire = false;
    input.left = input.right = false;
    input.drag = null;
    sfx.pauseMusic();
    ui.showPanel('pause');
  } else if (game.mode === 'paused') {
    game.mode = 'playing';
    sfx.click();
    sfx.playMusic();
    ui.showPanel(null);
  }
}

function gameOver() {
  game.mode = 'over';
  input.fire = false;
  input.left = input.right = false;
  input.drag = null;
  renderHud();
  sfx.stopMusic();
  const best = bestOf(game.diff);
  const newBest = game.score > best;
  if (newBest) {
    store.set(bestKey(game.diff), game.score);
    sfx.best();
  } else {
    sfx.gameOver();
  }
  ui.setGameUI(false);
  ui.showOver({
    score: game.score,
    best: Math.max(best, game.score),
    kills: game.kills,
    wave: Math.max(1, game.level + 1),
    diff: DIFFICULTY[game.diff].label,
    newBest,
  });
  ui.setBest(Math.max(best, game.score));
}

function goMenu() {
  game.mode = 'menu';
  resetWorld();
  sfx.stopMusic();
  ui.setGameUI(false);
  refreshMenu();
  ui.showPanel('menu');
}

function refreshMenu() {
  ui.setDifficulty(game.diff, DIFF_NOTES);
  ui.setBest(bestOf(game.diff));
  ui.setAutoFire(game.autoFire);
}

function setDifficulty(key) {
  if (!DIFFICULTY[key]) return;
  game.diff = key;
  store.set('canonArmed.diff', key);
  refreshMenu();
  sfx.click();
}

// ============================================================
// Input
// ============================================================
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLAYER_Z);
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const hitPoint = new THREE.Vector3();
function pointerToX(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (!raycaster.ray.intersectPlane(aimPlane, hitPoint)) return null;
  return clamp(hitPoint.x, -PLAY_HALF, PLAY_HALF);
}

function toggleAutoFire() {
  game.autoFire = !game.autoFire;
  store.set('canonArmed.autoFire', game.autoFire ? '1' : '0');
  ui.setAutoFire(game.autoFire);
  sfx.click();
}

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowLeft': case 'KeyA': input.left = true; e.preventDefault(); break;
    case 'ArrowRight': case 'KeyD': input.right = true; e.preventDefault(); break;
    case 'Space': input.fire = true; e.preventDefault(); break;
    case 'KeyF': if (!e.repeat) toggleAutoFire(); break;
    case 'KeyP': case 'Escape': if (!e.repeat) togglePause(); break;
    case 'KeyM': if (!e.repeat) ui.setMuted(sfx.toggleMute()); break;
    case 'Enter':
      if (e.repeat || document.activeElement?.tagName === 'BUTTON') break;
      if (game.mode === 'paused') togglePause();
      else if (game.mode === 'menu') startGame();
      else if (game.mode === 'over') startGame();
      break;
    default: break;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  if (e.code === 'Space') input.fire = false;
});

// Drag anywhere on the playfield to steer (touch and mouse)
window.addEventListener('pointerdown', (e) => {
  if (game.mode !== 'playing' || e.target.closest('button')) return;
  const x = pointerToX(e);
  if (x !== null) input.drag = x;
  input.fire = true; // tap or hold anywhere to fire
});
window.addEventListener('pointermove', (e) => {
  if (game.mode !== 'playing' || input.drag === null) return;
  const x = pointerToX(e);
  if (x !== null) input.drag = x;
});
const endDrag = () => { input.drag = null; input.fire = false; };
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

window.addEventListener('blur', () => {
  input.left = input.right = input.fire = false;
  input.drag = null;
  if (game.mode === 'playing') togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.mode === 'playing') togglePause();
});


// Buttons
const on = (id, fn) => document.getElementById(id).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
on('btn-start', startGame);
on('btn-retry', startGame);
on('btn-resume', togglePause);
on('btn-pause', togglePause);
on('btn-quit', goMenu);
on('btn-menu-over', goMenu);
on('btn-auto', toggleAutoFire);
on('btn-sound', () => ui.setMuted(sfx.toggleMute()));
on('btn-howto', () => ui.showPanel('howto'));
on('btn-howto-close', () => { store.set('canonArmed.seenHowto', '1'); goMenu(); });
document.querySelectorAll('[data-diff]').forEach((btn) => {
  btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
});

// ============================================================
// Per-frame update
// ============================================================
function updatePlaying(dt, t) {
  game.elapsed += dt;
  const lvl = Math.floor(game.elapsed / WAVE_SECONDS);
  if (lvl !== game.level) {
    game.level = lvl;
    ui.toast(`${WAVE_SHOW} ${lvl + 1}`);
    sfx.wave();
    // Every wave brings 100 enemies, rising to 150
    game.waveSpawned = 0;
    game.waveBudget = Math.min(150, 100 + 5 * lvl);
    game.spawnAcc = 0;
  }

  for (const k of Object.keys(game.timers)) game.timers[k] = Math.max(0, game.timers[k] - dt);
  game.invuln = Math.max(0, game.invuln - dt);
  if (game.combo > 0) {
    game.comboT -= dt;
    if (game.comboT <= 0) { game.combo = 0; game.mult = 1; }
  }

  // Movement: buttons and keys first, then drag
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) {
    player.x += dir * MOVE_SPEED * dt;
  } else if (input.drag !== null) {
    player.x += (input.drag - player.x) * Math.min(1, dt * 10);
  }
  player.x = clamp(player.x, -PLAY_HALF, PLAY_HALF);

  // Firing
  game.fireT -= dt;
  if ((game.autoFire || input.fire) && game.fireT <= 0) fireVolley();

  // Spawning
  const cfg = DIFFICULTY[game.diff];
  // Spawns get faster and denser with every wave
  // Each wave spends its enemy budget (100 rising to 150) across the first part of the wave
  if (game.waveBudget === 0) game.waveBudget = Math.min(150, 100 + 5 * lvl);
  const rate = game.waveBudget / (WAVE_SECONDS * 0.85); // enemies per second
  if (game.waveSpawned < game.waveBudget && enemies.length < MAX_ENEMIES_TOTAL) {
    game.spawnAcc += dt * rate;
    while (game.spawnAcc >= 1 && game.waveSpawned < game.waveBudget && enemies.length < MAX_ENEMIES_TOTAL) {
      spawnEnemy();
      game.waveSpawned++;
      game.spawnAcc -= 1;
    }
  }

  // Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.z += e.speed * dt;
    // Enemies drift toward the cannon's lane as they come in, so they always aim at you
    e.baseX += (player.x - e.baseX) * Math.min(1, dt * 0.35);
    e.x = clamp(e.baseX + Math.sin(t * e.freq + e.phase) * e.amp, -PLAY_HALF, PLAY_HALF);
    e.flash = Math.max(0, e.flash - dt * 5);
    e.yaw = Math.sin(t * 0.8 + e.phase) * 0.25;

    if (e.z >= PLAYER_Z - 0.6 && Math.abs(e.x - player.x) < e.r + 1.1) {
      const ex = removeEnemy(i);
      sparks.burst(enemyPos(ex), ENEMY[ex.type].color, 40, 7, 0.8);
      sfx.explode(ex.def.size);
      damagePlayer();
      if (game.mode !== 'playing') { renderHud(); return; }
    } else if (e.z > PLAYER_Z + 1.6) {
      const ex = removeEnemy(i);
      sparks.burst(tmpV.set(ex.x, 0.9, PLAYER_Z + 1), ENEMY[ex.type].color, 30, 6, 0.7);
      sfx.explode(ex.def.size * 0.6);
      damagePlayer();
      if (game.mode !== 'playing') { renderHud(); return; }
    }
  }

  // Bullets (swept collision: fast shots cannot skip past an enemy)
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.pz = b.z;
    b.z -= BULLET_SPEED * dt;
    b.x += b.vx * dt;
    b.mesh.position.set(b.x, 0.9, b.z);
    let consumed = false;
    if (b.z < SPAWN_Z || Math.abs(b.x) > PLAY_HALF + 3) {
      consumed = true;
    } else {
      const lo = b.z - 0.4;
      const hi = b.pz + 0.4;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (e.z >= lo - e.r && e.z <= hi + e.r && Math.abs(b.x - e.x) < e.r + 0.1) {
          hitEnemy(e, j);
          consumed = true;
          break;
        }
      }
    }
    if (consumed) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }

  // Power-ups drift toward the cannon
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.life -= dt;
    p.z += 3.0 * dt;
    p.mesh.position.set(p.x, 1.0 + Math.sin(t * 3 + p.phase) * 0.2, p.z);
    p.core.rotation.y += dt * 2;
    p.ring.rotation.z += dt * 2;
    if (Math.abs(p.x - player.x) < 1.7 && Math.abs(p.z - PLAYER_Z) < 1.7) {
      collectPowerup(p);
      disposePowerup(p);
      powerups.splice(i, 1);
    } else if (p.life <= 0 || p.z > PLAYER_Z + 2) {
      disposePowerup(p);
      powerups.splice(i, 1);
    }
  }

  renderHud();
}

function updateWorld(dt, t) {
  const scroll = game.mode === 'playing' ? 14 : game.mode === 'menu' ? 4 : game.mode === 'paused' ? 0 : 5;
  gridTex.offset.y = (gridTex.offset.y + dt * scroll * (GRID_REPEAT.y / GROUND_LEN)) % 1;
  stars.rotation.y += dt * 0.01;

  // Ship
  const vx = (player.x - player.lastX) / Math.max(dt, 1e-3);
  player.lastX = player.x;
  ship.position.set(player.x, -0.4 + Math.sin(t * 2.2) * 0.05, PLAYER_Z);
  ship.rotation.z = lerp(ship.rotation.z, clamp(-vx * 0.015, -0.3, 0.3), 0.12);
  ship.visible = !(game.invuln > 0 && Math.floor(t * 14) % 2 === 0);
  barrelPivot.position.z = game.recoil * 0.3;
  game.recoil = Math.max(0, game.recoil - dt * 6);
  shipShield.material.opacity = game.timers.shield > 0 ? 0.25 + 0.07 * Math.sin(t * 9) : 0;
  shipShield.rotation.y += dt;
  engineGlow.material.opacity = 0.6 + 0.3 * Math.sin(t * 18);
  shipGlow.position.set(player.x, 1.5, PLAYER_Z);

  // Camera with a small follow and shake
  const sh = reduceMotion ? 0 : shake;
  camera.position.x = camBase.x + (Math.random() * 2 - 1) * sh;
  camera.position.y = camBase.y + (Math.random() * 2 - 1) * sh * 0.5;
  camera.position.z = camBase.z;
  camera.lookAt(camTarget);
  shake *= Math.exp(-dt * 6);

  for (let i = effects.length - 1; i >= 0; i--) {
    const f = effects[i];
    f.t += dt;
    const p = Math.min(1, f.t / f.dur);
    f.update(p);
    if (p >= 1) { f.done(); effects.splice(i, 1); }
  }
  sparks.update(dt);
}

// ============================================================
// Main loop
// ============================================================
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.1); // no slow motion when a phone dips in frame rate
  const sim = game.mode === 'paused' ? 0 : dt;
  time += sim;

  if (game.mode === 'playing') updatePlaying(sim, time);
  else if (game.mode === 'menu') player.x = Math.sin(time * 0.5) * 3.2;

  updateWorld(sim, time);
  syncEnemies();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ============================================================
// Boot
// ============================================================
applyStyles();
ui.setMuted(sfx.muted);
ui.setGameUI(false);
refreshMenu();
const seenHowto = store.get('canonArmed.seenHowto', '0') === '1';
ui.showPanel(seenHowto ? 'menu' : 'howto');
tick();
