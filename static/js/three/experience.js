import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;

const COL = {
  navy: 0x050b18,
  navy2: 0x081226,
  cyan: 0x38e1ff,
  blue: 0x2f7bff,
  white: 0xeaf5ff,
  skin: 0xe8c4a8,
  coat: 0x2f6fb0,
  patient: 0x9fb8d6,
};

const state = {
  scroll: 0,
  activeScene: null,
  running: false,
};

const anchors = {
  doctor: new THREE.Vector3(4.5, 0, -2),
  patient: new THREE.Vector3(-4.5, 0, -2),
  chat: new THREE.Vector3(0, 1.2, -16),
  appointments: new THREE.Vector3(0, 0.5, -32),
  records: new THREE.Vector3(0, 0.5, -48),
  ai: new THREE.Vector3(0, 2.5, -64),
};

const CAM_KEYS = [
  { t: 0.0, pos: new THREE.Vector3(0, 2.6, 24), look: new THREE.Vector3(0, 1.5, -4) },
  { t: 0.15, pos: new THREE.Vector3(0.5, 2.4, 16), look: new THREE.Vector3(0, 1.4, -3) },
  { t: 0.30, pos: new THREE.Vector3(0, 1.9, 6), look: new THREE.Vector3(0, 1.2, -16) },
  { t: 0.45, pos: new THREE.Vector3(0, 1.5, -10.5), look: new THREE.Vector3(0, 1.1, -16) },
  { t: 0.60, pos: new THREE.Vector3(0, 1.6, -28), look: new THREE.Vector3(0, 0.6, -34) },
  { t: 0.75, pos: new THREE.Vector3(0, 1.5, -44), look: new THREE.Vector3(0, 1.0, -50) },
  { t: 0.90, pos: new THREE.Vector3(0, 2.2, -58), look: new THREE.Vector3(0, 1.6, -66) },
  { t: 1.0, pos: new THREE.Vector3(0, 8.5, 40), look: new THREE.Vector3(0, 0, -34) },
];

const SCENE_RANGES = [
  { name: 'hero', from: 0.0, to: 0.15 },
  { name: 'connection', from: 0.15, to: 0.30 },
  { name: 'chat', from: 0.30, to: 0.45 },
  { name: 'appointments', from: 0.45, to: 0.60 },
  { name: 'records', from: 0.60, to: 0.75 },
  { name: 'ai', from: 0.75, to: 0.90 },
  { name: 'ecosystem', from: 0.90, to: 1.01 },
];

let renderer, scene, camera, composer, bloomPass, clock;
let particles, pulse, aiGroup, ecoLines, heartTube, heartCurve;
const mixers = [];
let doctorPlaceholder = null;
let patientPlaceholder = null;
const dynamic = [];

function init() {
  if (!gsap || !ScrollTrigger || !Lenis) {
    throw new Error('Required libraries (gsap/ScrollTrigger/Lenis) failed to load.');
  }

  const canvas = document.getElementById('experience-canvas');
  if (!canvas) throw new Error('Canvas missing');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.navy);
  scene.fog = new THREE.FogExp2(COL.navy, 0.018);

  camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.copy(CAM_KEYS[0].pos);

  clock = new THREE.Clock();

  buildLights();
  buildEnvironment();
  buildFigures();
  loadDoctorModel();
  loadPatientModel();
  buildHeartbeat();
  buildPanels();
  buildAppointmentCards();
  buildRecords();
  buildAINetwork();
  buildEcosystemLines();
  buildParticles();

  setupComposer();
  setupScroll();
  setupResize();
  setupVisibility();

  document.body.classList.remove('experience-loading');
  document.body.classList.add('experience-active');
  ScrollTrigger.refresh();
  state.running = true;

  window.__mcExperience = { destroy: destroy };
  animate();
}

function buildLights() {
  scene.add(new THREE.HemisphereLight(0x4a78b0, 0x05070d, 0.55));
  scene.add(new THREE.AmbientLight(0x223a5c, 0.4));

  const key = new THREE.DirectionalLight(0xcfe8ff, 1.4);
  key.position.set(8, 16, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const cyan = new THREE.PointLight(COL.cyan, 18, 40, 2);
  cyan.position.set(0, 4, -16);
  scene.add(cyan);

  const blue = new THREE.PointLight(COL.blue, 26, 50, 2);
  blue.position.set(0, 5, -64);
  scene.add(blue);

  const fill = new THREE.PointLight(0x7fd0ff, 8, 30, 2);
  fill.position.set(-6, 3, 4);
  scene.add(fill);
}

function buildEnvironment() {
  const groundGeo = new THREE.CircleGeometry(120, 64);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.85, metalness: 0.2 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.4;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(240, 120, 0x1d3a5c, 0x102338);
  grid.position.y = -1.39;
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);

}

function makeFigure(tint, isDoctor) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55, metalness: 0.15 });
  const skinMat = new THREE.MeshStandardMaterial({ color: COL.skin, roughness: 0.7 });

  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 1.5, 16), bodyMat);
  legs.position.y = -0.55;
  legs.castShadow = true;
  g.add(legs);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.1, 6, 16), bodyMat);
  torso.position.y = 0.85;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), skinMat);
  head.position.y = 1.95;
  head.castShadow = true;
  g.add(head);

  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.16, 0.06),
    new THREE.MeshStandardMaterial({ color: COL.cyan, emissive: COL.cyan, emissiveIntensity: 1.4, roughness: 0.4 })
  );
  cross.position.set(0, 1.0, 0.62);
  g.add(cross);
  const crossV = cross.clone();
  crossV.geometry = new THREE.BoxGeometry(0.16, 0.5, 0.06);
  g.add(crossV);

  if (isDoctor) {
    const steth = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x0c4a6e, metalness: 0.6, roughness: 0.3 })
    );
    steth.position.set(0.25, 0.7, 0.6);
    steth.rotation.x = Math.PI / 2;
    g.add(steth);
  }

  g.userData.cross = cross;
  g.userData.crossV = crossV;
  return g;
}

function buildFigures() {
  const doctor = makeFigure(COL.coat, true);
  doctor.position.copy(anchors.doctor);
  doctor.position.y = 0.34;
  doctor.rotation.y = -Math.PI / 5;
  doctor.userData.isFigure = true;
  scene.add(doctor);
  dynamic.push(doctor);
  doctorPlaceholder = doctor;

  const patient = makeFigure(COL.patient, false);
  patient.position.copy(anchors.patient);
  patient.scale.setScalar(1.3);
  patient.position.y = 0.34;
  patient.rotation.y = Math.PI / 5;
  patient.userData.isFigure = true;
  scene.add(patient);
  dynamic.push(patient);
  patientPlaceholder = patient;
}

function coreExtents(root) {
  root.updateMatrixWorld(true);
  const ys = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.attributes.position) {
      const pos = o.geometry.attributes.position;
      const m = o.matrixWorld;
      const step = Math.max(1, Math.floor(pos.count / 2000));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        ys.push(v.y);
      }
    }
  });
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  return {
    lo: ys[Math.floor(ys.length * 0.02)],
    hi: ys[Math.floor(ys.length * 0.98)],
  };
}

function placeModel(root, animations, anchor, targetH, rotationY, placeholder) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material && 'envMapIntensity' in o.material) o.material.envMapIntensity = 1.0;
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const core = coreExtents(root);
  let scale, loY;
  if (core) {
    const coreH = Math.max(0.001, core.hi - core.lo);
    scale = targetH / coreH;
    loY = core.lo;
  } else {
    const size = new THREE.Vector3();
    box.getSize(size);
    scale = targetH / Math.max(0.001, size.y);
    loY = box.min.y;
  }

  root.position.set(-center.x, -loY, -center.z);

  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(scale);

  const groundY = -1.35;
  holder.position.set(anchor.x, groundY, anchor.z);
  holder.rotation.y = rotationY;
  scene.add(holder);

  if (animations && animations.length) {
    const m = new THREE.AnimationMixer(root);
    m.clipAction(animations[0]).play();
    mixers.push(m);
  }

  if (placeholder) {
    scene.remove(placeholder);
    const idx = dynamic.indexOf(placeholder);
    if (idx !== -1) dynamic.splice(idx, 1);
  }
  return holder;
}

function loadDoctorModel() {
  const loader = new GLTFLoader();
  loader.load(
    '/static/3d/doctor.glb',
    (gltf) => {
      placeModel(gltf.scene, gltf.animations, anchors.doctor, 5.0, -Math.PI / 5, doctorPlaceholder);
      doctorPlaceholder = null;
    },
    undefined,
    (err) => {
      console.warn('[MediConnect] doctor.glb failed to load; keeping placeholder figure.', err);
    }
  );
}

function loadPatientModel() {
  const loader = new FBXLoader();
  loader.load(
    '/static/3d/patient.fbx',
    (fbx) => {
      placeModel(fbx, fbx.animations, anchors.patient, 5.0, Math.PI / 5, patientPlaceholder);
      patientPlaceholder = null;
    },
    undefined,
    (err) => {
      console.warn('[MediConnect] patient.fbx failed to load; keeping placeholder figure.', err);
    }
  );
}

function buildHeartbeat() {
  const a = new THREE.Vector3(anchors.doctor.x, 1.4, anchors.doctor.z + 0.6);
  const b = new THREE.Vector3(anchors.patient.x, 1.4, anchors.patient.z + 0.6);
  const mid = new THREE.Vector3(0, 3.2, -2);
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);
  heartCurve = curve;
  const geo = new THREE.TubeGeometry(curve, 60, 0.035, 8, false);
  const mat = new THREE.MeshStandardMaterial({ color: COL.cyan, emissive: COL.cyan, emissiveIntensity: 1.2, roughness: 0.3, transparent: true, opacity: 0 });
  heartTube = new THREE.Mesh(geo, mat);
  scene.add(heartTube);

  const pulseGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const pulseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: COL.cyan, emissiveIntensity: 3, roughness: 0.2 });
  pulse = new THREE.Mesh(pulseGeo, pulseMat);
  scene.add(pulse);
}

function drawPanel(kind) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 640;
  const x = c.getContext('2d');
  const r = 28;

  x.fillStyle = 'rgba(10,28,52,0.82)';
  roundRect(x, 8, 8, 496, 624, r); x.fill();
  x.strokeStyle = 'rgba(120,200,255,0.4)'; x.lineWidth = 2;
  roundRect(x, 8, 8, 496, 624, r); x.stroke();

  x.fillStyle = '#38e1ff';
  x.font = '600 26px Inter, sans-serif';

  if (kind === 'chat') {
    x.fillText('Chat médical', 36, 60);
    x.strokeStyle = 'rgba(120,200,255,0.2)';
    x.beginPath(); x.moveTo(36, 84); x.lineTo(476, 84); x.stroke();
    const bubbles = [['in', 'Bonjour, j\'ai un renouvellement?', 120], ['out', 'Bien sûr, Docteur Martin.', 200], ['in', 'Vos résultats sont prêts.', 280], ['out', 'Merci, parfait.', 360]];
    bubbles.forEach(([t, text, y]) => {
      x.fillStyle = t === 'in' ? 'rgba(20,45,80,0.9)' : 'rgba(47,123,255,0.9)';
      const w = 300;
      const bx = t === 'in' ? 36 : 476 - w;
      roundRect(x, bx, y, w, 46, 16); x.fill();
      x.fillStyle = t === 'in' ? '#eaf5ff' : '#021326';
      x.font = '400 18px Inter, sans-serif';
      x.fillText(text.slice(0, 26), bx + 16, y + 29);
      x.font = '600 26px Inter, sans-serif';
    });
  } else if (kind === 'appointments') {
    x.fillText('Rendez-vous', 36, 60);
    x.strokeStyle = 'rgba(120,200,255,0.2)';
    x.beginPath(); x.moveTo(36, 84); x.lineTo(476, 84); x.stroke();
    const cards = [['Cardiologie', '24 Sep · 10:30', '#38e1ff'], ['Suivi', '28 Sep · 14:00', '#2f7bff']];
    cards.forEach(([t, d, col], i) => {
      const y = 120 + i * 130;
      x.fillStyle = 'rgba(8,22,42,0.9)';
      roundRect(x, 36, y, 440, 110, 18); x.fill();
      x.fillStyle = col; x.beginPath(); x.arc(80, y + 55, 22, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#021326'; x.font = '700 22px Inter'; x.fillText('+', 72, y + 63);
      x.fillStyle = '#eaf5ff'; x.font = '600 22px Inter'; x.fillText(t, 130, y + 50);
      x.fillStyle = 'rgba(207,232,255,0.7)'; x.font = '400 18px Inter'; x.fillText(d, 130, y + 82);
    });
  } else if (kind === 'records') {
    x.fillText('Dossier médical', 36, 60);
    x.strokeStyle = 'rgba(120,200,255,0.2)';
    x.beginPath(); x.moveTo(36, 84); x.lineTo(476, 84); x.stroke();
    x.fillStyle = 'rgba(207,232,255,0.85)'; x.font = '400 18px Inter';
    for (let i = 0; i < 9; i++) { x.fillText('—  Analyse clinique ' + (i + 1), 40, 140 + i * 50); }
  } else if (kind === 'prescriptions') {
    x.fillText('Ordonnances', 36, 60);
    x.strokeStyle = 'rgba(120,200,255,0.2)';
    x.beginPath(); x.moveTo(36, 84); x.lineTo(476, 84); x.stroke();
    const meds = ['Amoxicilline 500mg', 'Paracétamol 1g', 'Vitamine D'];
    meds.forEach((m, i) => {
      const y = 140 + i * 120;
      x.fillStyle = 'rgba(8,22,42,0.9)';
      roundRect(x, 36, y, 440, 100, 18); x.fill();
      x.fillStyle = '#38e1ff'; x.beginPath(); x.arc(80, y + 50, 24, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#021326'; x.font = '700 22px Inter'; x.fillText('℞', 70, y + 58);
      x.fillStyle = '#eaf5ff'; x.font = '600 20px Inter'; x.fillText(m, 130, y + 56);
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makePanel(kind, w, h, pos, rotY) {
  const tex = drawPanel(kind);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, metalness: 0.1, emissive: 0x0a2a4a, emissiveIntensity: 0.5, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.copy(pos);
  mesh.rotation.y = rotY || 0;
  scene.add(mesh);
  return mesh;
}

function buildPanels() {
  makePanel('chat', 4.2, 5.2, new THREE.Vector3(0, 1.4, -16), 0);
  makePanel('prescriptions', 3.6, 4.5, new THREE.Vector3(3.4, 1.2, -48), -0.5);
}

function buildAppointmentCards() {
  const group = new THREE.Group();
  const tex = drawPanel('appointments');
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, metalness: 0.1, emissive: 0x0a2a4a, emissiveIntensity: 0.5, side: THREE.DoubleSide });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.2), mat);
    const ang = (i / 4) * Math.PI * 2;
    card.position.set(Math.cos(ang) * 3.4, Math.sin(ang) * 0.6 + 0.5, Math.sin(ang) * 3.4);
    card.lookAt(anchors.appointments);
    group.add(card);
  }
  group.position.copy(anchors.appointments);
  scene.add(group);
  dynamic.push(group);
}

function buildRecords() {
  const group = new THREE.Group();
  const tex = drawPanel('records');
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4, metalness: 0.1, emissive: 0x0a2a4a, emissiveIntensity: 0.5, side: THREE.DoubleSide });
    const doc = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.5), mat);
    doc.position.set(-2.4 + i * 2.4, 0.6, -1.2 + i * 1.2);
    doc.rotation.y = (i - 1) * 0.25;
    group.add(doc);
  }
  group.position.copy(anchors.records);
  scene.add(group);
  dynamic.push(group);
}

function buildAINetwork() {
  aiGroup = new THREE.Group();
  aiGroup.position.copy(anchors.ai);

  const N = 26;
  const nodeGeo = new THREE.SphereGeometry(0.09, 12, 12);
  const nodeMat = new THREE.MeshStandardMaterial({ color: COL.cyan, emissive: COL.cyan, emissiveIntensity: 1.6, roughness: 0.3 });
  const inst = new THREE.InstancedMesh(nodeGeo, nodeMat, N);
  const dummy = new THREE.Object3D();
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const p = new THREE.Vector3(Math.cos(theta) * rad, y, Math.sin(theta) * rad).multiplyScalar(2.6);
    pts.push(p);
    dummy.position.copy(p);
    dummy.scale.setScalar(0.7 + Math.random() * 0.6);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  aiGroup.add(inst);

  const linePos = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (pts[i].distanceTo(pts[j]) < 1.9) {
        linePos.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.35 });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  aiGroup.add(lines);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7, 1),
    new THREE.MeshStandardMaterial({ color: 0x0a3a66, emissive: COL.blue, emissiveIntensity: 0.8, roughness: 0.3, transparent: true, opacity: 0.85 })
  );
  aiGroup.add(core);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(3.1, 0.03, 10, 90),
    new THREE.MeshStandardMaterial({ color: COL.cyan, emissive: COL.cyan, emissiveIntensity: 1.2, roughness: 0.4 })
  );
  aiGroup.add(halo);
  aiGroup.userData.halo = halo;
  aiGroup.userData.lines = lines;

  scene.add(aiGroup);
  dynamic.push(aiGroup);
}

function buildEcosystemLines() {
  const order = [anchors.doctor, anchors.patient, anchors.chat, anchors.appointments, anchors.records, anchors.ai, anchors.doctor];
  const pos = [];
  for (let i = 0; i < order.length - 1; i++) {
    pos.push(order[i].x, order[i].y + 1.4, order[i].z, order[i + 1].x, order[i + 1].y + 1.4, order[i + 1].z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0 });
  ecoLines = new THREE.LineSegments(geo, mat);
  scene.add(ecoLines);
}

function buildParticles() {
  const count = window.innerWidth < 768 ? 900 : 1800;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const palette = [new THREE.Color(COL.cyan), new THREE.Color(COL.blue), new THREE.Color(COL.white)];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 50 + 4;
    pos[i * 3 + 2] = -Math.random() * 120 + 20;
    const c = palette[Math.floor(Math.random() * palette.length)];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  particles = new THREE.Points(geo, mat);
  scene.add(particles);
  dynamic.push(particles);
}

function setupComposer() {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.55, 0.8);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
}

function setupScroll() {
  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({ duration: 1.1, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const spacer = document.getElementById('experience-spacer');
  ScrollTrigger.create({
    trigger: spacer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      state.scroll = self.progress;
      const bar = document.getElementById('experience-progress');
      if (bar) bar.style.width = (self.progress * 100).toFixed(2) + '%';
    },
  });
}

function setupResize() {
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
  });
}

function setupVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.running = false;
    } else if (!state.running) {
      state.running = true;
      clock.getDelta();
      animate();
    }
  });
}

function sampleCamera(p, outPos, outLook) {
  let i = 0;
  while (i < CAM_KEYS.length - 1 && p > CAM_KEYS[i + 1].t) i++;
  const a = CAM_KEYS[i], b = CAM_KEYS[Math.min(i + 1, CAM_KEYS.length - 1)];
  const span = Math.max(0.0001, b.t - a.t);
  let f = (p - a.t) / span;
  f = Math.min(1, Math.max(0, f));
  f = f * f * (3 - 2 * f);
  outPos.lerpVectors(a.pos, b.pos, f);
  outLook.lerpVectors(a.look, b.look, f);
}

function activeSceneName(p) {
  for (const s of SCENE_RANGES) {
    if (p >= s.from && p < s.to) return s.name;
  }
  return 'ecosystem';
}

function updateScene(dt, t) {
  const p = state.scroll;

  const fade = Math.min(1, Math.max(0, (p - 0.8) / 0.2));
  const fogTarget = THREE.MathUtils.lerp(0.02, 0.006, fade * fade * (3 - 2 * fade));
  scene.fog.density += (fogTarget - scene.fog.density) * 0.05;

  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  sampleCamera(p, pos, look);
  pos.x += Math.sin(t * 0.3) * 0.35;
  pos.y += Math.sin(t * 0.45) * 0.18;
  camera.position.lerp(pos, 0.12);
  camera.lookAt(look);

  if (pulse && heartCurve) {
    const tp = (t * 0.25) % 1;
    pulse.position.copy(heartCurve.getPointAt(tp));
    const vis = p > 0.12 && p < 0.32 ? 1 : 0.25;
    pulse.material.opacity = vis;
    pulse.material.transparent = true;
  }
  if (heartTube) {
    const target = p > 0.12 && p < 0.34 ? 0.9 : 0.0;
    heartTube.material.opacity += (target - heartTube.material.opacity) * 0.08;
  }

  dynamic.forEach((o) => {
    if (o === particles) {
      o.rotation.y = t * 0.02;
    } else if (o.userData && o.userData.cross) {
      const s = 1 + Math.sin(t * 2) * 0.12;
      o.userData.cross.scale.setScalar(s);
      o.userData.crossV.scale.setScalar(s);
    } else if (o === aiGroup) {
      o.rotation.y = t * 0.15;
      if (o.userData.halo) o.userData.halo.rotation.z = t * 0.2;
      if (o.userData.lines) o.userData.lines.material.opacity = 0.2 + Math.sin(t * 1.5) * 0.12 + 0.15;
    } else if (!o.userData.isFigure) {
      o.rotation.y += dt * 0.1;
    }
  });

  if (ecoLines) {
    const target = p > 0.86 ? Math.min(1, (p - 0.86) / 0.12) * 0.7 : 0;
    ecoLines.material.opacity += (target - ecoLines.material.opacity) * 0.08;
  }

  const sceneName = activeSceneName(p);
  if (sceneName !== state.activeScene) {
    state.activeScene = sceneName;
    document.querySelectorAll('.scene-section').forEach((el) => {
      el.classList.toggle('is-visible', el.dataset.scene === sceneName);
    });
  }
}

function animate() {
  if (!state.running) return;
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  updateScene(dt, t);
  mixers.forEach((m) => m.update(dt));
  composer.render();
}

function destroy() {
  state.running = false;
  window.removeEventListener('resize', setupResize);
  if (renderer) renderer.dispose();
}

export { init };
