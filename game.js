/**
 * STEM Racing VR Design Lab, v1.0
 * Browser-based immersive WebXR prototype for Meta Quest 2, with desktop support.
 * Educational vehicle physics are intentionally illustrative, not competition calibrated.
 * Dependencies: Three.js ES modules loaded using index.html importmap.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const $ = (id) => document.getElementById(id);
const TRACK_LENGTH = 20;
const START_Z = -4.1;
const LANES = [-0.68, 0.68];
const AERO = [
  { name: 'Standard', cda: 0.00100, addedMass: 0 },
  { name: 'Streamlined', cda: 0.00078, addedMass: 1 },
  { name: 'Race profile', cda: 0.00060, addedMass: 3 },
];
const WHEELS = [
  { name: 'Standard', rolling: 0.30, addedMass: 0 },
  { name: 'Low-friction', rolling: 0.17, addedMass: 2 },
  { name: 'Precision', rolling: 0.09, addedMass: 4 },
];
const state = {
  mass: 55, aero: 1, wheels: 1,
  phase: 'ready', phaseAt: 0, greenAt: 0,
  player: null, cpu: null, cpuReaction: 0.18,
  notice: 'Choose a design, then stage the race.',
  lastHudAt: 0,
};
let best = null;
try { const n = Number(localStorage.getItem('stem-racing-vr-best-v1')); if (n > 0 && Number.isFinite(n)) best = n; } catch (_) {}

function design() {
  const aero = AERO[state.aero];
  const wheels = WHEELS[state.wheels];
  return {
    massGrams: state.mass + aero.addedMass + wheels.addedMass,
    cda: aero.cda,
    rolling: wheels.rolling,
  };
}
function fmt(n) { return Number.isFinite(n) ? n.toFixed(3) : '–.–––'; }
function newVehicle(config) {
  return { ...config, x: 0, v: 0, t: 0, started: false, finished: false,
    startedAt: null, carTime: null, finishSpeed: 0 };
}
const sound = (() => {
  let ctx;
  return (pitch = 550, duration = .08, volume = .055) => {
    try {
      ctx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = pitch;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now); osc.stop(now + duration);
    } catch (_) { /* audio unavailable, continue without sound */ }
  };
})();

// SCENE AND RENDERER ---------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#071221');
scene.fog = new THREE.FogExp2('#071221', 0.027);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 90);
camera.position.set(8.3, 5.1, 7.8);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.55));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
$('scene').appendChild(renderer.domElement);
const vrButton = VRButton.createButton(renderer);
document.body.appendChild(vrButton);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.12, -10.1);
controls.enableDamping = true;
controls.dampingFactor = .065;
controls.minDistance = 3;
controls.maxDistance = 36;
controls.maxPolarAngle = Math.PI / 2.02;
controls.update();
renderer.xr.addEventListener('sessionstart', () => {
  controls.enabled = false;
  $('garage').style.display = 'none';
  document.querySelector('.timing').style.display = 'none';
  document.querySelector('.topbrand').style.display = 'none';
  document.querySelector('footer').style.display = 'none';
});
renderer.xr.addEventListener('sessionend', () => {
  controls.enabled = true;
  $('garage').style.display = '';
  document.querySelector('.timing').style.display = '';
  document.querySelector('.topbrand').style.display = '';
  document.querySelector('footer').style.display = '';
});

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({ color: '#0a1c2d', roughness: .95, metalness: .05 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.055;
scene.add(floor);
scene.add(new THREE.HemisphereLight('#bbebff', '#14334f', 2.5));
const mainLight = new THREE.DirectionalLight('#b8eeff', 2.2);
mainLight.position.set(-8, 16, 5); scene.add(mainLight);
const rimLight = new THREE.DirectionalLight('#ff6897', 1.15);
rimLight.position.set(6, 7, -20); scene.add(rimLight);

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .52, metalness: .3, ...opts });
}
function block(w, h, d, color, x, y, z, material = null, parent = scene) {
  const obj = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || mat(color));
  obj.position.set(x, y, z); parent.add(obj); return obj;
}
function stripe(x1, y1, z1, x2, y2, z2, color, opacity = 1) {
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
  ]);
  const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
  scene.add(line); return line;
}
function textCanvas(width, height) {
  const el = document.createElement('canvas'); el.width = width; el.height = height;
  const ctx = el.getContext('2d');
  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return { el, ctx, texture };
}
function createSign(w, h, pxw = 1024, pxh = 512) {
  const t = textCanvas(pxw, pxh);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: t.texture, side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false }));
  return { ...t, mesh };
}
function text(ctx, str, x, y, size, color = '#ffffff', align = 'left', weight = 700) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px Arial, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y);
}
function rounded(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}

// PHYSICAL RACE TRACK --------------------------------------------------------
const platform = block(3.9, .18, 23.5, '#223146', 0, -.13, START_Z - 10.25);
const deckMat = mat('#0d1d31', { metalness: .55, roughness: .42 });
for (let i = 0; i < 2; i++) {
  const x = LANES[i];
  block(1.15, .05, 21.25, '#0c263b', x, .02, START_Z - 9.88, deckMat);
  block(.042, .08, 21.2, i === 0 ? '#38dffc' : '#ff638c', x - .57, .11, START_Z - 9.9,
    new THREE.MeshBasicMaterial({ color: i === 0 ? '#38dffc' : '#ff638c' }));
  block(.042, .08, 21.2, i === 0 ? '#38dffc' : '#ff638c', x + .57, .11, START_Z - 9.9,
    new THREE.MeshBasicMaterial({ color: i === 0 ? '#38dffc' : '#ff638c' }));
  stripe(x, .15, START_Z + .4, x, .15, START_Z - 20.4, '#cbdcf0', .55); // tether line
}
for (let m = 0; m <= 20; m += 1) {
  const z = START_Z - m;
  const alpha = m % 5 === 0 ? .68 : .18;
  stripe(-1.95, .07, z, 1.95, .07, z, '#9fc2dc', alpha);
}
for (const x of [-2.0, 2.0]) {
  block(.09, .16, 22.3, '#294258', x, .06, START_Z - 10);
}
function distanceMarker(m) {
  const sign = createSign(.95, .36, 480, 180);
  const { ctx, texture, el } = sign;
  ctx.fillStyle = '#0b2438'; ctx.fillRect(0, 0, el.width, el.height);
  text(ctx, `${m} M`, 240, 88, 85, '#8be8ff', 'center', 900);
  texture.needsUpdate = true;
  sign.mesh.position.set(2.5, .33, START_Z - m);
  sign.mesh.rotation.y = -.6;
  scene.add(sign.mesh);
}
[0, 5, 10, 15, 20].forEach(distanceMarker);
// start line, finish checkerboard, illuminated overhead arch
block(3.55, .012, .14, '#ebf8ff', 0, .07, START_Z - .11,
  new THREE.MeshBasicMaterial({ color: '#e9faff' }));
for (let i = 0; i < 14; i++) {
  block(3.6 / 14, .017, .12, i % 2 ? '#0b1520' : '#ffffff', -1.8 + (i + .5) * 3.6 / 14, .078, START_Z - 20,
    new THREE.MeshBasicMaterial({ color: i % 2 ? '#0b1520' : '#ffffff' }));
}
for (const x of [-1.9, 1.9]) {
  block(.2, 3.0, .2, '#1b415a', x, 1.48, START_Z - 20);
  block(.12, 2.7, .11, '#4bcaf2', x, 1.47, START_Z - 20,
    new THREE.MeshBasicMaterial({ color: '#32adce' }));
}
block(4.05, .55, .22, '#0d2d43', 0, 2.91, START_Z - 20);
const finishSign = createSign(3.75, .45, 960, 140);
finishSign.ctx.fillStyle = '#071f32'; finishSign.ctx.fillRect(0, 0, 960, 140);
text(finishSign.ctx, '20 METRE FINISH', 480, 70, 77, '#87ebff', 'center', 900);
finishSign.texture.needsUpdate = true;
finishSign.mesh.position.set(0, 2.92, START_Z - 19.88);
scene.add(finishSign.mesh);
// arena edge, stands and overhead accent lighting
for (let i = 0; i < 17; i++) {
  const z = -3.5 - i * 1.45;
  for (const side of [-1, 1]) {
    const x = side * (3.8 + (i % 3) * .13);
    block(1.0, .21, 1.28, i % 3 === 0 ? '#19374c' : '#102a41', x, .18, z);
    block(.9, .18, 1.28, '#0d2031', x + side * .5, .4, z);
    if (i % 2 === 0) block(.11, 2.4, .11, '#245071', side * 3.05, 1.2, z);
  }
}
const grid = new THREE.GridHelper(120, 80, '#1f415e', '#102b44');
grid.position.y = -.047;
scene.add(grid);
// decorative first gantry
for (const x of [-2.25, 2.25]) block(.17, 2.6, .17, '#23536d', x, 1.24, START_Z - .45);
block(4.65, .27, .3, '#173d5b', 0, 2.49, START_Z - .45);
const banner = createSign(3.45, .34);
text(banner.ctx, 'STEM RACING  //  START GANTRY', 512, 250, 61, '#baf5ff', 'center', 900);
banner.texture.needsUpdate = true;
banner.mesh.position.set(0, 2.49, START_Z - .25);
scene.add(banner.mesh);

// START LIGHTS ---------------------------------------------------------------
const lamps = { red: [], green: [] };
const lampOuter = mat('#0a141f', { roughness: .3 });
for (let i = 0; i < 3; i++) {
  const x = -.53 + i * .53;
  block(.39, .55, .15, '#0b2234', x, 2.08, START_Z - .23, lampOuter);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 9),
    new THREE.MeshBasicMaterial({ color: '#481b28' }));
  glass.scale.z = .5;
  glass.position.set(x, 2.08, START_Z - .132); scene.add(glass);
  lamps.red.push(glass);
}
const greenCase = block(.44, .56, .15, '#0b2234', .98, 2.08, START_Z - .23, lampOuter);
const greenLamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 9),
  new THREE.MeshBasicMaterial({ color: '#123c30' }));
greenLamp.scale.z = .5;
greenLamp.position.set(.98, 2.08, START_Z - .132); scene.add(greenLamp);
lamps.green.push(greenLamp);
function setLights(numRed, isGreen) {
  for (let i = 0; i < 3; i++) {
    lamps.red[i].material.color.set(i < numRed ? '#ff3f65' : '#481b28');
  }
  greenLamp.material.color.set(isGreen ? '#45ffb6' : '#123c30');
}
setLights(0, false);

// MINIATURE VEHICLES ---------------------------------------------------------
function carModel(bodyHex, glowHex, lane) {
  const group = new THREE.Group(); group.position.set(lane, 0, START_Z + .3); scene.add(group);
  const bodyMat = mat(bodyHex, { metalness: .56, roughness: .25 });
  const dark = mat('#051220', { roughness: .65 });
  const metal = mat('#adb8c8', { roughness: .27, metalness: .83 });
  const glow = new THREE.MeshBasicMaterial({ color: glowHex });
  block(.40, .18, .92, bodyHex, 0, .27, .06, bodyMat, group);
  block(.28, .10, .45, '#173c5a', 0, .39, .05, mat('#1a415b', { metalness: .62 }), group);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.205, .48, 6), bodyMat);
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, .255, -.57); group.add(nose);
  block(.81, .065, .14, '#d7e7f1', 0, .24, .55, metal, group);
  block(.66, .050, .12, bodyHex, 0, .21, -.42, bodyMat, group);
  block(.26, .05, .14, '#1a2636', 0, .25, .66, dark, group);
  block(.08, .04, .22, glowHex, 0, .41, .02, glow, group);
  for (let front of [-.33, .41]) {
    for (let side of [-1, 1]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .115, 14), dark);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(side * .32, .165, front);
      group.add(wh);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .12, 12), metal);
      hub.rotation.z = Math.PI / 2; hub.position.copy(wh.position); group.add(hub);
    }
  }
  const tailGlow = block(.24, .075, .075, glowHex, 0, .29, .63, glow, group);
  const trail = block(.15, .02, .10, glowHex, 0, .05, .74, glow, group);
  trail.visible = false;
  return { group, trail, tailGlow };
}
const playerMesh = carModel('#20c5ee', '#67f9ff', LANES[0]);
const cpuMesh = carModel('#f85079', '#ffaf6b', LANES[1]);

// IN-WORLD VR BOARDS ---------------------------------------------------------
const vrTargets = [];
function makePanel(position, header, subtitle, color) {
  const group = new THREE.Group(); group.position.set(...position); scene.add(group);
  const back = block(1.7, 2.20, .065, '#0d2c41', 0, 0, 0,
    mat('#0d2b42', { metalness: .35 }), group);
  const t = createSign(1.67, 2.14, 720, 980);
  const { ctx, el, texture } = t;
  const grad = ctx.createLinearGradient(0, 0, 720, 980);
  grad.addColorStop(0, '#082137'); grad.addColorStop(1, '#061625');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 720, 980);
  ctx.fillStyle = color; ctx.fillRect(26, 36, 8, 45);
  text(ctx, header, 55, 56, 43, '#e7faff', 'left', 900);
  text(ctx, subtitle, 54, 111, 23, '#83bad4', 'left', 600);
  texture.needsUpdate = true;
  t.mesh.position.z = .038; group.add(t.mesh);
  return group;
}
const garageBoard = makePanel([-2.05, 1.67, -2.30], 'DESIGN GARAGE', 'ENGINEER YOUR RACE CAR', '#4fe7ff');
const raceBoard = makePanel([2.05, 1.67, -2.30], 'RACE CONTROL', '20 M / TWO-LANE CHALLENGE', '#ff749c');
function makeDynamicDisplay(parent, w, h, pos, painter) {
  const display = createSign(w, h, 720, 360);
  display.mesh.position.set(...pos); parent.add(display.mesh);
  const repaint = () => { const { ctx } = display; ctx.clearRect(0, 0, 720, 360); painter(ctx); display.texture.needsUpdate = true; };
  return repaint;
}
const repaintGarage = makeDynamicDisplay(garageBoard, 1.50, .72, [0, .46, .075], (ctx) => {
  rounded(ctx, 5, 5, 710, 350, 27, '#143852', '#29617a');
  const specs = design();
  text(ctx, `CHASSIS: ${state.mass} g  |  TOTAL: ${specs.massGrams} g`, 32, 54, 33, '#ecfaff');
  text(ctx, `BODY: ${AERO[state.aero].name.toUpperCase()}`, 32, 128, 32, '#60dfff');
  text(ctx, `WHEELS: ${WHEELS[state.wheels].name.toUpperCase()}`, 32, 198, 32, '#60dfff');
  text(ctx, `CdA ${String((specs.cda * 10000).toFixed(1))} cm²  •  ${specs.rolling.toFixed(2)} N`, 32, 280, 28, '#b2d5e6');
});
const repaintRace = makeDynamicDisplay(raceBoard, 1.52, .80, [0, .42, .075], (ctx) => {
  rounded(ctx, 5, 5, 710, 350, 27, '#143048', '#386984');
  const blue = state.player?.carTime ?? (state.player?.started ? state.player.t : NaN);
  const red = state.cpu?.carTime ?? (state.cpu?.started ? state.cpu.t : NaN);
  text(ctx, state.phase.toUpperCase().replace('FALSE', 'FALSE START'), 32, 45, 38, '#ffe9b2');
  text(ctx, `BLUE     ${fmt(blue)} s`, 32, 127, 50, '#84ebff');
  text(ctx, `PINK     ${fmt(red)} s`, 32, 215, 50, '#ff8ead');
  const react = state.player?.startedAt != null ? (state.player.startedAt - state.greenAt) / 1000 : NaN;
  text(ctx, `REACTION  ${fmt(react)} s`, 32, 295, 28, '#d1eaff');
});
function makeButton(parent, label, x, y, w, h, action, accent = '#19708a') {
  const t = createSign(w, h, 560, 180);
  rounded(t.ctx, 8, 8, 544, 164, 23, accent, '#5eb1c7');
  text(t.ctx, label, 280, 95, 50, '#f2fcff', 'center', 900);
  t.texture.needsUpdate = true;
  t.mesh.position.set(x, y, .12);
  parent.add(t.mesh);
  t.mesh.userData.action = action;
  t.mesh.userData.defaultScale = 1;
  vrTargets.push(t.mesh);
  return t.mesh;
}
// Each option has an XR controller-trigger target.
makeButton(garageBoard, 'MASS  −', -.41, -.10, .69, .30, 'massDown');
makeButton(garageBoard, 'MASS  +', .41, -.10, .69, .30, 'massUp');
makeButton(garageBoard, 'AERO  ◀', -.41, -.49, .69, .30, 'aeroDown');
makeButton(garageBoard, 'AERO  ▶', .41, -.49, .69, .30, 'aeroUp');
makeButton(garageBoard, 'WHEELS  ◀', -.41, -.88, .69, .30, 'wheelDown');
makeButton(garageBoard, 'WHEELS  ▶', .41, -.88, .69, .30, 'wheelUp');
makeButton(raceBoard, 'STAGE RACE', 0, -.36, 1.42, .40, 'stage', '#087a95');
makeButton(raceBoard, 'LAUNCH / TRIGGER', 0, -.82, 1.42, .40, 'launch', '#8a2a5b');

// XR controllers: point to an in-world panel and use the trigger.
const raycaster = new THREE.Raycaster();
const rotation = new THREE.Matrix4();
const tempDir = new THREE.Vector3();
const tempPos = new THREE.Vector3();
const controllerLights = [];
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  controller.addEventListener('selectstart', () => selectVR(controller));
  const ray = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -8)]),
    new THREE.LineBasicMaterial({ color: '#62efff', opacity: .65, transparent: true })
  );
  controller.add(ray); scene.add(controller); controllerLights.push(ray);
}
function hitTarget(controller) {
  controller.updateMatrixWorld(true);
  rotation.identity().extractRotation(controller.matrixWorld);
  tempPos.setFromMatrixPosition(controller.matrixWorld);
  tempDir.set(0, 0, -1).applyMatrix4(rotation);
  raycaster.set(tempPos, tempDir);
  raycaster.far = 9;
  return raycaster.intersectObjects(vrTargets, false)[0]?.object || null;
}
function selectVR(controller) {
  const target = hitTarget(controller);
  if (target) {
    doAction(target.userData.action);
  } else {
    doLaunch(); // trigger in free space also releases the car
  }
}
function doAction(action) {
  if (action === 'stage') return stageRace();
  if (action === 'launch') return doLaunch();
  if (['massDown','massUp','aeroDown','aeroUp','wheelDown','wheelUp'].includes(action)) {
    if (['countdown', 'green', 'running'].includes(state.phase)) {
      state.notice = 'Car setup locked until the next race.'; updateHUD(true); return;
    }
    if (action === 'massDown') state.mass = Math.max(45, state.mass - 1);
    if (action === 'massUp') state.mass = Math.min(70, state.mass + 1);
    if (action === 'aeroDown') state.aero = (state.aero + AERO.length - 1) % AERO.length;
    if (action === 'aeroUp') state.aero = (state.aero + 1) % AERO.length;
    if (action === 'wheelDown') state.wheels = (state.wheels + WHEELS.length - 1) % WHEELS.length;
    if (action === 'wheelUp') state.wheels = (state.wheels + 1) % WHEELS.length;
    syncDesignControls(); sound(450, .05); updateHUD(true);
  }
}

// GAMEPLAY -------------------------------------------------------------------
function syncDesignControls() {
  $('mass').value = state.mass; $('massValue').textContent = `${state.mass} g`;
  $('aero').value = String(state.aero); $('wheels').value = String(state.wheels);
  const cfg = design();
  $('totalMass').textContent = `${cfg.massGrams} g`;
  $('dragArea').textContent = `${(cfg.cda * 10000).toFixed(1)} cm²`;
  $('rollingLoss').textContent = `${cfg.rolling.toFixed(2)} N`;
  repaintGarage();
}
function syncCarPositions() {
  playerMesh.group.position.z = START_Z - Math.min(state.player?.x ?? 0, TRACK_LENGTH) + .3;
  cpuMesh.group.position.z = START_Z - Math.min(state.cpu?.x ?? 0, TRACK_LENGTH) + .3;
  playerMesh.trail.visible = !!state.player?.started && !state.player.finished && state.player.t < .3;
  cpuMesh.trail.visible = !!state.cpu?.started && !state.cpu.finished && state.cpu.t < .3;
}
function stageRace() {
  state.player = newVehicle({ ...design(), thrust: 6.70 });
  state.cpu = newVehicle({ massGrams: 58, cda: .00082, rolling: .17, thrust: 6.65 });
  state.cpuReaction = .15 + Math.random() * .115;
  state.phase = 'countdown'; state.phaseAt = performance.now();
  state.greenAt = 0;
  state.notice = 'Watch the lights. Trigger only when green.';
  setLights(0, false); syncCarPositions(); sound(450, .10);
  updateHUD(true);
}
function launchVehicle(car, time) {
  if (!car || car.started) return;
  car.started = true; car.startedAt = time;
}
function doLaunch() {
  const now = performance.now();
  if (state.phase === 'countdown') {
    state.phase = 'false'; state.notice = 'FALSE START! You launched before green. Stage again.';
    setLights(3, false); sound(140, .38, .08); updateHUD(true); return;
  }
  if (state.phase === 'green' || state.phase === 'running') {
    if (state.player.started) return;
    launchVehicle(state.player, now);
    state.phase = 'running'; state.notice = 'CAR RELEASED! Watch the finish line.';
    sound(880, .13, .045); updateHUD(true); return;
  }
  if (state.phase === 'ready' || state.phase === 'false' || state.phase === 'results') {
    state.notice = 'Stage a new race first.'; updateHUD(true);
  }
}
function simulateCar(car, dt) {
  if (!car?.started || car.finished) return;
  // Simplified CO2-thrust curve, aerodynamic drag and approximate rolling loss.
  // Not measured from any competition vehicle; intended for comparative learning.
  const timeBefore = car.t;
  const positionBefore = car.x;
  const thrustN = car.t < .65 ? car.thrust * Math.exp(-car.t / .23) : 0;
  const aeroN = .5 * 1.225 * car.cda * car.v * car.v;
  const accel = (thrustN - aeroN - car.rolling) / (car.massGrams / 1000);
  car.v = Math.max(0, car.v + accel * dt);
  car.x += car.v * dt;
  car.t += dt;
  if (car.x >= TRACK_LENGTH) {
    car.finished = true;
    const distanceInStep = car.x - positionBefore;
    const fraction = distanceInStep > 0 ? (TRACK_LENGTH - positionBefore) / distanceInStep : 1;
    car.carTime = timeBefore + dt * THREE.MathUtils.clamp(fraction, 0, 1);
    car.finishSpeed = car.v;
    car.x = TRACK_LENGTH;
    sound(1060, .16, .045);
  }
}
function finishRace() {
  state.phase = 'results';
  const p = state.player, c = state.cpu;
  if (!p.started || !p.finished) {
    state.notice = 'NO FINISH. Stage again and launch after green.';
  } else {
    const userTotal = (p.startedAt - state.greenAt) / 1000 + p.carTime;
    const cpuTotal = (c.startedAt - state.greenAt) / 1000 + c.carTime;
    const win = userTotal < cpuTotal;
    state.notice = win ? `YOU WIN! ${fmt(userTotal)} s total incl. reaction.` :
      `OPPONENT WINS. ${fmt(cpuTotal)} s total incl. reaction.`;
    if (best === null || p.carTime < best) {
      best = p.carTime;
      try { localStorage.setItem('stem-racing-vr-best-v1', String(best)); } catch (_) {}
    }
  }
  sound(state.player?.finished ? 700 : 250, .22);
  updateHUD(true);
}
function tick(now, dt) {
  if (state.phase === 'countdown') {
    const ms = now - state.phaseAt;
    const redCount = ms < 550 ? 0 : ms < 1100 ? 1 : ms < 1650 ? 2 : 3;
    if (redCount !== tick.prevRed) { tick.prevRed = redCount; setLights(redCount, false); if (redCount) sound(510, .06); }
    if (ms >= 2400) {
      state.phase = 'green'; state.greenAt = now;
      state.notice = 'GREEN! PRESS TRIGGER OR SPACE TO LAUNCH.';
      setLights(0, true); sound(1000, .17); updateHUD(true);
    }
  } else { tick.prevRed = -1; }
  if (state.phase === 'green' || state.phase === 'running') {
    if (!state.cpu.started && now >= state.greenAt + state.cpuReaction * 1000) {
      launchVehicle(state.cpu, state.greenAt + state.cpuReaction * 1000);
    }
    // Substeps stabilize physics if a slow frame occurs in the headset.
    const steps = Math.max(1, Math.ceil(dt / .008));
    for (let i = 0; i < steps; i++) {
      simulateCar(state.player, dt / steps);
      simulateCar(state.cpu, dt / steps);
    }
    syncCarPositions();
    if ((state.player?.finished && state.cpu?.finished) || (now - state.greenAt > 11000)) finishRace();
  }
  if (now - state.lastHudAt > 100) updateHUD();
}
function updateHUD(force = false) {
  const now = performance.now();
  if (!force && now - state.lastHudAt < 80) return;
  state.lastHudAt = now;
  const p = state.player, c = state.cpu;
  const phaseLabels = {
    ready: 'READY TO STAGE', countdown: 'START SEQUENCE', green: 'GREEN LIGHT!',
    running: 'RACE IN PROGRESS', false: 'FALSE START', results: 'RACE COMPLETE'
  };
  $('raceStatus').textContent = phaseLabels[state.phase];
  $('raceStatus').style.color = state.phase === 'false' ? '#ff728f' : '#70eaff';
  $('statusText').textContent = state.notice;
  $('yourTime').textContent = fmt(p?.carTime ?? (p?.started ? p.t : NaN));
  $('cpuTime').textContent = fmt(c?.carTime ?? (c?.started ? c.t : NaN));
  $('reactionTime').textContent = p?.startedAt != null && state.greenAt ?
    `${fmt((p.startedAt - state.greenAt) / 1000)} s` : '–.––– s';
  $('finishSpeed').textContent = p?.finished ? `${(p.finishSpeed * 3.6).toFixed(1)} km/h` : '– km/h';
  $('bestTime').textContent = best === null ? 'No record yet' : `${fmt(best)} s`;
  $('verdict').textContent = state.phase === 'results' || state.phase === 'false'
    ? `${state.notice} Try a different setup and see if you can improve.`
    : 'Engineering challenge: change one design variable and compare your next race.';
  const racing = ['countdown','green','running'].includes(state.phase);
  $('mass').disabled = racing; $('aero').disabled = racing; $('wheels').disabled = racing;
  repaintGarage(); repaintRace();
}

// DESKTOP CONTROLS -----------------------------------------------------------
$('mass').addEventListener('input', (event) => {
  if (['countdown','green','running'].includes(state.phase)) return;
  state.mass = Number(event.target.value); syncDesignControls(); updateHUD(true);
});
$('aero').addEventListener('change', (event) => {
  if (['countdown','green','running'].includes(state.phase)) return;
  state.aero = Number(event.target.value); syncDesignControls(); updateHUD(true);
});
$('wheels').addEventListener('change', (event) => {
  if (['countdown','green','running'].includes(state.phase)) return;
  state.wheels = Number(event.target.value); syncDesignControls(); updateHUD(true);
});
$('stage').addEventListener('click', stageRace);
$('launch').addEventListener('click', doLaunch);
$('reset').addEventListener('click', () => {
  if (['countdown','green','running'].includes(state.phase)) return;
  state.mass = 55; state.aero = 1; state.wheels = 1;
  state.phase = 'ready'; state.notice = 'Design reset. Stage a fresh race.';
  state.player = null; state.cpu = null;
  setLights(0, false); syncCarPositions(); syncDesignControls(); updateHUD(true);
});
window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) {
    event.preventDefault(); doLaunch();
  }
  if (event.code === 'Enter' && document.activeElement === document.body) stageRace();
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// START ----------------------------------------------------------------------
state.player = newVehicle({ ...design(), thrust: 6.70 });
state.cpu = newVehicle({ massGrams: 58, cda: .00082, rolling: .17, thrust: 6.65 });
syncCarPositions(); syncDesignControls(); updateHUD(true);
const loading = $('loading'); loading.classList.add('hidden');
loading.addEventListener('transitionend', () => loading.remove(), { once: true });
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(.05, Math.max(0, (now - previous) / 1000));
  previous = now;
  if (!renderer.xr.isPresenting) controls.update();
  tick(now, dt);
  renderer.render(scene, camera);
});