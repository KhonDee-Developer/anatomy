import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
   DOM REFS
   ============================================================ */
const viewport      = document.getElementById('viewport');
const deconSlider   = document.getElementById('decon-slider');
const deconValue    = document.getElementById('decon-value');
const layerListEl   = document.getElementById('layer-list');
const specSheetEl   = document.getElementById('spec-sheet');
const deviceTabsEl  = document.getElementById('device-tabs');
const vpDeviceName  = document.getElementById('vp-device-name');
const vpDeviceSub   = document.getElementById('vp-device-sub');
const hoverTip      = document.getElementById('hover-tip');
const inspEyebrow   = document.getElementById('inspector-eyebrow');
const inspName      = document.getElementById('inspector-name');
const inspMaterial  = document.getElementById('inspector-material');
const inspDesc      = document.getElementById('inspector-desc');
const inspHint      = document.getElementById('inspector-hint');
const btnTheme      = document.getElementById('btn-theme');
const btnSim        = document.getElementById('btn-sim');
const btnXray       = document.getElementById('btn-xray');
const btnIsolate    = document.getElementById('btn-isolate');

const calloutLayer  = document.getElementById('callout-layer');
const calloutLine   = document.getElementById('callout-line');
const calloutDot    = document.getElementById('callout-dot');
const calloutTag    = document.getElementById('callout-tag');
const calloutIdx    = document.getElementById('callout-idx');
const calloutTitle  = document.getElementById('callout-title');

/* ============================================================
   THEME & VISUAL MODES STATE
   ============================================================ */
const THEME_KEY  = 'chess-anatomy-theme';
let themeKey     = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
let isSimulating = false;
let isXray       = false;
let isIsolated   = false;
let deconFactor  = 0;

const SCENE_THEME = {
  dark: {
    bg: 0x0c1119,
    fogNear: 14, fogFar: 34,
    gridCenter: 0x2a3448, gridLines: 0x1a2334,
    pad: 0x10141e,
    exposure: 1.15,
    ambient: { color: 0x8fa3c8, intensity: 0.55 },
    hemi:    { sky: 0xaecbe8, ground: 0x1a1a1f, intensity: 0.6 },
    key:     { color: 0xfff3e2, intensity: 1.9 },
    rim:     { color: 0x5fa8ff, intensity: 0.5 },
    fill:    { color: 0xdd9553, intensity: 0.25 },
    hoverHex: 0x5fe1cd, hoverIntensity: 0.35,
    selectHex: 0xdd9553, selectIntensity: 0.55,
    xrayEdge: 0x5fe1cd
  },
  light: {
    bg: 0xf0f4fa,
    fogNear: 18, fogFar: 44,
    gridCenter: 0xb6c2d4, gridLines: 0xdbe2ed,
    pad: 0xe4eaf3,
    exposure: 1.0,
    ambient: { color: 0xffffff, intensity: 0.85 },
    hemi:    { sky: 0xffffff, ground: 0xd3dbe6, intensity: 0.95 },
    key:     { color: 0xffffff, intensity: 2.1 },
    rim:     { color: 0x7aa7ff, intensity: 0.4 },
    fill:    { color: 0xffcfa0, intensity: 0.35 },
    hoverHex: 0x14b8a6, hoverIntensity: 0.55,
    selectHex: 0xd97706, selectIntensity: 0.5,
    xrayEdge: 0x0e9384
  }
};

/* ============================================================
   SCENE SETUP
   ============================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1119);
scene.fog = new THREE.Fog(0x0c1119, 14, 34);

const camera = new THREE.PerspectiveCamera(38, viewport.clientWidth / viewport.clientHeight, 0.05, 100);
camera.position.set(6, 3.4, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 30;
controls.target.set(0, 0.3, 0);

const focusTarget = new THREE.Vector3(0, 0.3, 0);

const ambientLight = new THREE.AmbientLight(0x8fa3c8, 0.55);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xaecbe8, 0x1a1a1f, 0.6);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff3e2, 1.9);
keyLight.position.set(5, 9, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x5fa8ff, 0.5);
rimLight.position.set(-6, 3, -5);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xdd9553, 0.25);
fillLight.position.set(-3, 2, 6);
scene.add(fillLight);

let grid = null;
const padGeo = new THREE.CircleGeometry(10, 48);
const padMat = new THREE.MeshStandardMaterial({ color: 0x10141e, roughness: 1, metalness: 0 });
const pad = new THREE.Mesh(padGeo, padMat);
pad.rotation.x = -Math.PI / 2;
pad.receiveShadow = true;
scene.add(pad);

/* ============================================================
   THEME APPLICATION (3D)
   ============================================================ */
function rebuildGrid(t) {
  if (grid) {
    scene.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
  }
  grid = new THREE.GridHelper(30, 30, t.gridCenter, t.gridLines);
  grid.position.y = currentData ? currentData.floorY : -5;
  scene.add(grid);
}

function applySceneTheme(key) {
  const t = SCENE_THEME[key];
  scene.background.setHex(t.bg);
  scene.fog.color.setHex(t.bg);
  scene.fog.near = t.fogNear;
  scene.fog.far = t.fogFar;
  renderer.toneMappingExposure = t.exposure;
  pad.material.color.setHex(t.pad);

  ambientLight.color.setHex(t.ambient.color);
  ambientLight.intensity = t.ambient.intensity;
  hemiLight.color.setHex(t.hemi.sky);
  hemiLight.groundColor.setHex(t.hemi.ground);
  hemiLight.intensity = t.hemi.intensity;
  keyLight.color.setHex(t.key.color);
  keyLight.intensity = t.key.intensity;
  rimLight.color.setHex(t.rim.color);
  rimLight.intensity = t.rim.intensity;
  fillLight.color.setHex(t.fill.color);
  fillLight.intensity = t.fill.intensity;

  if (currentData) {
    currentData.order.forEach(id => {
      currentData.components[id].parts.forEach(p => {
        if (p.edgeLine) p.edgeLine.material.color.setHex(t.xrayEdge);
      });
    });
  }

  rebuildGrid(t);
}

/* ============================================================
   BUILD HELPERS
   ============================================================ */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function stdMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15, ...opts });
}

function newComponent(id, name, material, description) {
  return { id, name, material, description, parts: [], center: new THREE.Vector3() };
}

function addPart(comp, group, geometry, material, pos, explodeDir, rot) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(pos);
  if (rot) mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.componentId = comp.id;
  group.add(mesh);

  const edgesGeo = new THREE.EdgesGeometry(geometry, 28);
  const edgesMat = new THREE.LineBasicMaterial({
    color: SCENE_THEME[themeKey].xrayEdge,
    transparent: true,
    opacity: 0.45
  });
  const edgeLine = new THREE.LineSegments(edgesGeo, edgesMat);
  edgeLine.visible = isXray;
  mesh.add(edgeLine);

  const baseEmissiveHex = mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000;
  const baseEmissiveIntensity = mesh.material.emissiveIntensity !== undefined ? mesh.material.emissiveIntensity : 1;
  const baseTransparent = !!mesh.material.transparent;
  const baseOpacity = mesh.material.opacity !== undefined ? mesh.material.opacity : 1;

  const partRecord = {
    mesh,
    edgeLine,
    basePos: pos.clone(),
    baseRot: mesh.rotation.clone(),
    simOffset: new THREE.Vector3(),
    simRot: new THREE.Vector3(),
    explodeDir: explodeDir.clone(),
    baseEmissiveHex,
    baseEmissiveIntensity,
    baseTransparent,
    baseOpacity
  };
  comp.parts.push(partRecord);
  return partRecord;
}

function finalizeComponent(comp, componentsMap, order) {
  const c = new THREE.Vector3();
  comp.parts.forEach(p => c.add(p.basePos));
  c.divideScalar(comp.parts.length);
  comp.center.copy(c);
  componentsMap[comp.id] = comp;
  order.push(comp.id);
}

function disposeGroup(group) {
  group.traverse(obj => {
    if (obj.isMesh || obj.isLineSegments) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else obj.material.dispose();
    }
  });
}

// หมุนทั้งกลุ่มโมเดลรอบแกน Y ในแนวนอนอย่างเรียบร้อยโดยไม่กระทบมุมเอียงเฉพาะชิ้น
function createHorizontalSpinHandler(group, speed = 1.1) {
  return function onSimulate(t, active) {
    group.rotation.y = active ? t * speed : 0;
  };
}

// Helper สร้างฐานมาตรฐาน (ฐานไม้ + ก้อนถ่วงน้ำหนัก + ผ้าสักหลาด) สำหรับตัวหมากทุกตัว
function addStandardPieceBase(group, components, order, prefix, scaleRadius = 1.0, weightHeight = 0.2, feltColor = 0x15803d, woodMain, woodAccent) {
  let c = newComponent(`${prefix}-base`, 'ฐานรองตัวหมาก (Pedestal Base)', 'ไม้กลึงคว้านช่องถ่วงน้ำหนัก',
    'ฐานกว้างรองรับจุดศูนย์ถ่วงของตัวหมาก ภายในเจาะโพรงสำหรับฝังก้อนโลหะถ่วงน้ำหนักเพื่อป้องกันตัวหมากล้มง่ายระหว่างเดินเกม');
  addPart(c, group, new THREE.CylinderGeometry(0.46 * scaleRadius, 0.62 * scaleRadius, 0.34, 32), woodAccent,
    V3(0, 0.54, 0), V3(0, -0.4, 0));
  addPart(c, group, new THREE.CylinderGeometry(0.64 * scaleRadius, 0.66 * scaleRadius, 0.22, 32), woodMain,
    V3(0, 0.26, 0), V3(0, -0.4, 0));
  finalizeComponent(c, components, order);

  c = newComponent(`${prefix}-weight`, 'ก้อนโลหะถ่วงน้ำหนัก (Weighted Core)', 'เหล็กหล่อ / ตะกั่วถ่วงสมดุล',
    'ก้อนถ่วงน้ำหนักมาตรฐานแข่งขัน (Triple-Weighted) ฝังอยู่ใต้ฐานเพื่อดึงจุดศูนย์ถ่วงให้ต่ำ เพิ่มความมั่นคงเวลาวางหมาก');
  addPart(c, group, new THREE.CylinderGeometry(0.42 * scaleRadius, 0.42 * scaleRadius, weightHeight, 24),
    stdMat(0x475569, { metalness: 0.85, roughness: 0.28 }),
    V3(0, 0.22, 0), V3(0, -1.3, 0));
  finalizeComponent(c, components, order);

  c = newComponent(`${prefix}-felt`, 'แผ่นสักหลาดใต้ฐาน (Base Felt)', 'ผ้าสักหลาดกันลื่น (Baize Felt)',
    'ปิดทับก้อนถ่วงน้ำหนักด้านล่างสุด ช่วยให้เลื่อนตัวหมากบนกระดานได้อย่างนุ่มนวลและป้องกันรอยขีดข่วนบนผิวกระดาน');
  addPart(c, group, new THREE.CylinderGeometry(0.63 * scaleRadius, 0.63 * scaleRadius, 0.04, 32),
    stdMat(feltColor, { roughness: 0.92 }),
    V3(0, 0.12, 0), V3(0, -2.2, 0));
  finalizeComponent(c, components, order);
}

/* ============================================================
   1. กระดานหมากรุกมาตรฐาน (TOURNAMENT CHESSBOARD)
   ============================================================ */
function buildChessBoard() {
  const group = new THREE.Group();
  const components = {}; const order = [];

  const boardSpan = 3.6;
  const sqSize = boardSpan / 8;
  const frameThickness = 0.36;
  const totalSize = boardSpan + frameThickness * 2;

  let c = newComponent('board-lacquer', 'ชั้นเคลือบแลคเกอร์ด้าน (Satin Lacquer)', 'โพลียูรีเทนเคลือบด้าน',
    'ชั้นเคลือบผิวด้านบนสุดช่วยป้องกันรอยขีดข่วนและลดแสงสะท้อนจากไฟสนามแข่ง ทำให้ผู้เล่นมองเห็นตารางและตัวหมากได้ชัดเจน');
  addPart(c, group, new THREE.BoxGeometry(boardSpan, 0.02, boardSpan),
    new THREE.MeshPhysicalMaterial({ color: 0xe6f2ff, transparent: true, opacity: 0.25, roughness: 0.15, transmission: 0.4 }),
    V3(0, 0.26, 0), V3(0, 3.2, 0));
  finalizeComponent(c, components, order);

  c = newComponent('board-light-sq', 'ช่องตารางสีอ่อน (32 ช่อง)', 'ไม้เมเปิล (Maple Veneer)',
    'ช่องตารางสีสว่างจำนวน 32 ช่อง ผลิตจากไม้เมเปิลคัดลาย ช่องมุมขวาล่างของผู้เล่นต้องเป็นช่องสีอ่อนเสมอ (h1 และ a8)');
  const lightMat = stdMat(0xe8d5b5, { roughness: 0.42, metalness: 0.05 });
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 8; col++) {
      if ((r + col) % 2 === 0) {
        const x = (col - 3.5) * sqSize;
        const z = (r - 3.5) * sqSize;
        addPart(c, group, new THREE.BoxGeometry(sqSize * 0.99, 0.06, sqSize * 0.99),
          lightMat, V3(x, 0.16, z), V3(x * 0.18, 2.2, z * 0.18));
      }
    }
  }
  finalizeComponent(c, components, order);

  c = newComponent('board-dark-sq', 'ช่องตารางสีเข้ม (32 ช่อง)', 'ไม้วอลนัท (Walnut Veneer)',
    'ช่องตารางสีเข้มจำนวน 32 ช่อง ผลิตจากไม้วอลนัทธรรมชาติ ให้ความต่างของสีที่ตัดกับตัวหมากทั้งสองฝ่ายอย่างชัดเจนตามมาตรฐาน FIDE');
  const darkMat = stdMat(0x5c3a21, { roughness: 0.45, metalness: 0.05 });
  for (let r = 0; r < 8; r++) {
    for (let col = 0; col < 8; col++) {
      if ((r + col) % 2 !== 0) {
        const x = (col - 3.5) * sqSize;
        const z = (r - 3.5) * sqSize;
        addPart(c, group, new THREE.BoxGeometry(sqSize * 0.99, 0.06, sqSize * 0.99),
          darkMat, V3(x, 0.16, z), V3(x * 0.18, 1.35, z * 0.18));
      }
    }
  }
  finalizeComponent(c, components, order);

  c = newComponent('board-border', 'ขอบกระดานและพิกัด (a–h / 1–8)', 'ไม้เมเปิลแข็ง + ตัวอักษรฝังทองเหลือง',
    'กรอบไม้รอบตารางทั้ง 4 ด้าน ช่วยยึดแผ่นตารางไม่ให้บิดงอ พร้อมพิกัดแนวตั้ง (Files a–h) และแนวนอน (Ranks 1–8) สำหรับจดบันทึกแต้มเดิน');
  const borderMat = stdMat(0x3b2313, { roughness: 0.45 });
  const coordMat  = stdMat(0xd4af37, { metalness: 0.75, roughness: 0.3 });
  const halfSpan = boardSpan / 2 + frameThickness / 2;

  addPart(c, group, new THREE.BoxGeometry(totalSize, 0.22, frameThickness), borderMat, V3(0, 0.11, halfSpan), V3(0, 0.4, 1.1));
  addPart(c, group, new THREE.BoxGeometry(totalSize, 0.22, frameThickness), borderMat, V3(0, 0.11, -halfSpan), V3(0, 0.4, -1.1));
  addPart(c, group, new THREE.BoxGeometry(frameThickness, 0.22, boardSpan), borderMat, V3(halfSpan, 0.11, 0), V3(1.1, 0.4, 0));
  addPart(c, group, new THREE.BoxGeometry(frameThickness, 0.22, boardSpan), borderMat, V3(-halfSpan, 0.11, 0), V3(-1.1, 0.4, 0));

  for (let i = 0; i < 8; i++) {
    const offset = (i - 3.5) * sqSize;
    addPart(c, group, new THREE.BoxGeometry(0.08, 0.02, 0.08), coordMat, V3(offset, 0.225, halfSpan), V3(0, 0.4, 1.1));
    addPart(c, group, new THREE.BoxGeometry(0.08, 0.02, 0.08), coordMat, V3(-halfSpan, 0.225, offset), V3(-1.1, 0.4, 0));
  }
  finalizeComponent(c, components, order);

  c = newComponent('board-core', 'แกนโครงสร้างกระดาน (Core Substrate)', 'ไม้ MDF ความหนาแน่นสูง',
    'แผ่นฐานโครงสร้างหลักที่รองรับแผ่นวีเนียร์ตารางทั้งหมด ออกแบบให้ทนต่อความชื้นและอุณหภูมิเพื่อรักษาระนาบกระดานให้เรียบสนิท');
  addPart(c, group, new THREE.BoxGeometry(boardSpan, 0.12, boardSpan), stdMat(0x8c6d53, { roughness: 0.7 }),
    V3(0, 0.07, 0), V3(0, -0.7, 0));
  finalizeComponent(c, components, order);

  c = newComponent('board-felt', 'แผ่นรองกันรอยใต้กระดาน', 'ผ้าสักหลาดกันลื่น (Baize Felt)',
    'แผ่นสักหลาดที่ติดอยู่ใต้กระดานเพื่อป้องกันรอยขีดข่วนบนโต๊ะแข่งขัน และช่วยดูดซับแรงกระแทกเวลาวางตัวหมาก');
  const padOffset = totalSize / 2 - 0.35;
  const feltMat = stdMat(0x16422b, { roughness: 0.9 });
  [
    [padOffset, padOffset], [-padOffset, padOffset],
    [padOffset, -padOffset], [-padOffset, -padOffset]
  ].forEach(([px, pz]) => {
    addPart(c, group, new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20), feltMat,
      V3(px, -0.015, pz), V3(px * 0.15, -1.6, pz * 0.15));
  });
  finalizeComponent(c, components, order);

  const onSimulate = createHorizontalSpinHandler(group, 0.9);

  return {
    group, components, order, onSimulate,
    label: 'กระดาน (Board)',
    tagline: 'โครงสร้างกระดานหมากรุกไม้มาตรฐานแข่งขัน 64 ช่อง แยกชั้นวัสดุตั้งแต่ผิวเคลือบจนถึงฐานรอง',
    spec: [
      ['จำนวนช่อง', '64 ช่อง (8 × 8)'],
      ['ขนาดช่องมาตรฐาน', '55 × 55 มม. (FIDE)'],
      ['วัสดุหลัก', 'เมเปิล · วอลนัท · MDF'],
      ['ระบบพิกัด', 'Algebraic (a1 – h8)']
    ],
    floorY: -1.8,
    home: { pos: [5.8, 4.4, 6.2], target: [0, 0.1, 0] },
    views: {
      iso: { pos: [5.8, 4.4, 6.2], target: [0, 0.1, 0] },
      top: { pos: [0.01, 8.8, 0.01], target: [0, 0.1, 0] },
      front: { pos: [0, 1.4, 8.2], target: [0, 0.1, 0] }
    }
  };
}

/* ============================================================
   2. ตัวหมากคิง (KING)
   ============================================================ */
function buildKingPiece() {
  const group = new THREE.Group();
  const components = {}; const order = [];

  const woodLight = stdMat(0xdcb98a, { roughness: 0.35, metalness: 0.08 });
  const woodAccent = stdMat(0xc49c68, { roughness: 0.38, metalness: 0.08 });

  let c = newComponent('king-cross', 'ยอดกางเขน (Cross Finial)', 'ไม้บ็อกซ์วูดกลึงขึ้นรูป',
    'สัญลักษณ์ประจำตัวหมาก King ในดีไซน์มาตรฐาน Staunton ปี 1849 ช่วยให้แยกแยะออกจาก Queen ได้ทันทีจากทุกมุมมอง');
  addPart(c, group, new THREE.BoxGeometry(0.11, 0.42, 0.11), woodLight, V3(0, 2.78, 0), V3(0, 3.2, 0));
  addPart(c, group, new THREE.BoxGeometry(0.32, 0.11, 0.11), woodLight, V3(0, 2.82, 0), V3(0, 3.2, 0));
  finalizeComponent(c, components, order);

  c = newComponent('king-crown', 'ส่วนยอดมงกุฎ (Coronet)', 'ไม้บ็อกซ์วูด (Boxwood)',
    'ส่วนครอบด้านบนของตัวหมากคิง มีขอบบานออกเล็กน้อยเพื่อรองรับยอดกางเขนและเป็นจุดจับที่ถนัดมือเวลาหยิบเดินหมาก');
  addPart(c, group, new THREE.CylinderGeometry(0.38, 0.24, 0.34, 32), woodAccent, V3(0, 2.38, 0), V3(0, 2.3, 0));
  addPart(c, group, new THREE.SphereGeometry(0.24, 24, 16), woodLight, V3(0, 2.52, 0), V3(0, 2.3, 0));
  finalizeComponent(c, components, order);

  c = newComponent('king-collar', 'วงแหวนปลอกคอ (Collar)', 'ไม้กลึงเซาะร่อง',
    'วงแหวนคั่นระหว่างลำตัวและส่วนหัวของตัวหมาก ช่วยเสริมความแข็งแรงบริเวณจุดคอดและเป็นจุดพักนิ้วขณะจับตัวหมาก');
  addPart(c, group, new THREE.TorusGeometry(0.27, 0.055, 14, 32), woodLight, V3(0, 2.15, 0), V3(0, 1.5, 0), { x: Math.PI / 2 });
  finalizeComponent(c, components, order);

  c = newComponent('king-shaft', 'ลำตัวหลัก (Turned Shaft)', 'ไม้บ็อกซ์วูด (Boxwood)',
    'แกนลำตัวทรงเรียวที่กลึงด้วยเครื่องกลึงไม้ ให้สัดส่วนสมดุลตามหลักสถาปัตยกรรมนีโอคลาสสิก สูง 95 มม. ตามมาตรฐาน FIDE');
  addPart(c, group, new THREE.CylinderGeometry(0.23, 0.44, 1.35, 32), woodLight, V3(0, 1.42, 0), V3(0, 0.6, 0));
  finalizeComponent(c, components, order);

  addStandardPieceBase(group, components, order, 'king', 1.0, 0.22, 0x15803d, woodLight, woodAccent);

  const onSimulate = createHorizontalSpinHandler(group, 1.2);

  return {
    group, components, order, onSimulate,
    label: 'คิง (King)',
    tagline: 'หมากราชา (King) ตัวหมากที่สำคัญที่สุดในเกม ผ่าให้เห็นก้อนถ่วงน้ำหนักและโครงสร้างภายใน',
    spec: [
      ['บทบาท', 'เป้าหมายหลัก (ห้ามถูก Checkmated)'],
      ['ความสูงมาตรฐาน', '95 มม. (3.75 นิ้ว)'],
      ['น้ำหนักตัวหมาก', '~65 กรัม (Triple Weighted)'],
      ['วัสดุ', 'ไม้ Boxwood · เหล็กถ่วง · สักหลาด']
    ],
    floorY: -2.4,
    home: { pos: [4.6, 3.0, 5.4], target: [0, 1.3, 0] },
    views: {
      iso: { pos: [4.6, 3.0, 5.4], target: [0, 1.3, 0] },
      top: { pos: [0.01, 7.8, 0.01], target: [0, 1.3, 0] },
      front: { pos: [0, 1.5, 6.8], target: [0, 1.3, 0] }
    }
  };
}

/* ============================================================
   3. ตัวหมากควีน (QUEEN)
   ============================================================ */
function buildQueenPiece() {
  const group = new THREE.Group();
  const components = {}; const order = [];

  const woodDark = stdMat(0x3a2618, { roughness: 0.35, metalness: 0.1 });
  const woodAccent = stdMat(0x4e3524, { roughness: 0.4, metalness: 0.1 });

  let c = newComponent('queen-orb', 'ยอดลูกกลม (Coroneted Orb)', 'ไม้อีโบนีกลึงกลม',
    'ลูกกลมขนาดเล็กบนยอดมงกุฎของ Queen เป็นเอกลักษณ์ที่ทำให้แยกความแตกต่างจากยอดกางเขนของ King ได้อย่างชัดเจน');
  addPart(c, group, new THREE.SphereGeometry(0.11, 20, 16), woodDark,
    V3(0, 2.58, 0), V3(0, 3.1, 0));
  finalizeComponent(c, components, order);

  c = newComponent('queen-coronet', 'มงกุฎแฉก (Serrated Coronet)', 'ไม้อีโบนีแกะร่อง',
    'มงกุฎทรงถ้วยบานออกพร้อมรอยบากรอบขอบคล้ายกลีบมงกุฎ สื่อถึงอำนาจการเดินที่ทรงพลังที่สุดบนกระดาน (เดินได้ทั้งแนวตรงและแนวทแยง)');
  addPart(c, group, new THREE.CylinderGeometry(0.36, 0.22, 0.28, 24), woodAccent,
    V3(0, 2.34, 0), V3(0, 2.2, 0));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addPart(c, group, new THREE.ConeGeometry(0.05, 0.12, 8), woodDark,
      V3(Math.cos(a) * 0.31, 2.51, Math.sin(a) * 0.31), V3(Math.cos(a) * 0.25, 2.2, Math.sin(a) * 0.25));
  }
  finalizeComponent(c, components, order);

  c = newComponent('queen-collar', 'วงแหวนปลอกคอคู่ (Double Collar)', 'ไม้กลึงเซาะร่องคู่',
    'วงแหวนคู่บริเวณลำคอช่วยเพิ่มความสง่างามและเป็นจุดจับที่กระชับมือเวลาผู้เล่นหยิบควีนเดินข้ามกระดานระยะไกล');
  addPart(c, group, new THREE.TorusGeometry(0.25, 0.048, 14, 32), woodDark,
    V3(0, 2.12, 0), V3(0, 1.45, 0), { x: Math.PI / 2 });
  finalizeComponent(c, components, order);

  c = newComponent('queen-shaft', 'ลำตัวเพรียว (Slender Shaft)', 'ไม้อีโบนี (Ebonized Boxwood)',
    'ลำตัวกลึงโค้งเว้าเพรียวบางกว่า King เล็กน้อย มีความสูงมาตรฐานประมาณ 85 มม. (รองจาก King เพียงตัวเดียว)');
  addPart(c, group, new THREE.CylinderGeometry(0.21, 0.42, 1.25, 32), woodDark,
    V3(0, 1.38, 0), V3(0, 0.6, 0));
  finalizeComponent(c, components, order);

  addStandardPieceBase(group, components, order, 'queen', 0.95, 0.2, 0x15803d, woodDark, woodAccent);

  const onSimulate = createHorizontalSpinHandler(group, 1.2);

  return {
    group, components, order, onSimulate,
    label: 'ควีน (Queen)',
    tagline: 'หมากราชินี (Queen) ตัวหมากที่มีอานุภาพสูงสุด เดินได้ทั้งแนวตั้ง แนวนอน และแนวทแยงไม่จำกัดช่อง',
    spec: [
      ['มูลค่าเชิงกลยุทธ์', '9 แต้ม'],
      ['ความสูงมาตรฐาน', '85 มม. (3.35 นิ้ว)'],
      ['น้ำหนักตัวหมาก', '~55 กรัม (Triple Weighted)'],
      ['วัสดุ', 'ไม้ Ebonized Boxwood · เหล็กถ่วง']
    ],
    floorY: -2.4,
    home: { pos: [4.6, 2.9, 5.4], target: [0, 1.25, 0] },
    views: {
      iso: { pos: [4.6, 2.9, 5.4], target: [0, 1.25, 0] },
      top: { pos: [0.01, 7.6, 0.01], target: [0, 1.25, 0] },
      front: { pos: [0, 1.4, 6.6], target: [0, 1.25, 0] }
    }
  };
}

/* ============================================================
   4. ตัวหมากเรือ (ROOK)
   ============================================================ */
function buildRookPiece() {
  const group = new THREE.Group();
  const components = {}; const order = [];

  const woodLight = stdMat(0xdcb98a, { roughness: 0.35, metalness: 0.08 });
  const woodAccent = stdMat(0xc49c68, { roughness: 0.38, metalness: 0.08 });

  let c = newComponent('rook-battlements', 'ใบเสมาป้อมปราการ (Battlements)', 'ไม้กลึงเซาะร่อง 6 แฉก',
    'ส่วนยอดทรงหอคอยป้อมปราการมีช่องใบเสมา 6 ช่อง สื่อถึงการป้องกันที่แข็งแกร่งและการควบคุมเส้นตรง (Files และ Ranks)');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = Math.cos(a) * 0.28;
    const bz = Math.sin(a) * 0.28;
    addPart(c, group, new THREE.BoxGeometry(0.16, 0.2, 0.12), woodLight,
      V3(bx, 2.02, bz), V3(bx * 0.6, 2.7, bz * 0.6), { y: -a });
  }
  finalizeComponent(c, components, order);

  c = newComponent('rook-turret', 'เชิงเทินหอคอย (Turret Head)', 'ไม้บ็อกซ์วูด (Boxwood)',
    'ส่วนหัวทรงกระบอกหนาที่รองรับใบเสมา ช่วยให้ตัวหมากเรือมีรูปลักษณ์มั่นคงและหยิบทำท่าเข้าป้อม (Castling) ร่วมกับ King ได้ถนัดมือ');
  addPart(c, group, new THREE.CylinderGeometry(0.36, 0.32, 0.32, 32), woodAccent,
    V3(0, 1.76, 0), V3(0, 1.7, 0));
  finalizeComponent(c, components, order);

  c = newComponent('rook-column', 'เสาหอคอยหลัก (Tower Column)', 'ไม้บ็อกซ์วูด (Boxwood)',
    'ลำตัวทรงเสาตรงที่แข็งแกร่ง ไม่มีส่วนคอดกิ่วมากนัก ความสูงมาตรฐานประมาณ 55 มม. ออกแบบให้ทนทานต่อแรงกระแทก');
  addPart(c, group, new THREE.CylinderGeometry(0.28, 0.4, 0.92, 32), woodLight,
    V3(0, 1.15, 0), V3(0, 0.7, 0));
  finalizeComponent(c, components, order);

  addStandardPieceBase(group, components, order, 'rook', 0.92, 0.18, 0x15803d, woodLight, woodAccent);

  const onSimulate = createHorizontalSpinHandler(group, 1.2);

  return {
    group, components, order, onSimulate,
    label: 'เรือ (Rook)',
    tagline: 'หมากเรือ (Rook) ทรงหอคอยป้อมปราการ เดินเป็นเส้นตรงในแนวตั้งและแนวนอน พร้อมทำท่าเข้าป้อม (Castling)',
    spec: [
      ['มูลค่าเชิงกลยุทธ์', '5 แต้ม (หมากหนัก)'],
      ['ความสูงมาตรฐาน', '55 มม. (2.15 นิ้ว)'],
      ['น้ำหนักตัวหมาก', '~45 กรัม'],
      ['ท่าพิเศษ', 'เข้าป้อม (Castling) ร่วมกับ King']
    ],
    floorY: -2.4,
    home: { pos: [4.4, 2.8, 5.2], target: [0, 1.05, 0] },
    views: {
      iso: { pos: [4.4, 2.8, 5.2], target: [0, 1.05, 0] },
      top: { pos: [0.01, 7.2, 0.01], target: [0, 1.05, 0] },
      front: { pos: [0, 1.2, 6.2], target: [0, 1.05, 0] }
    }
  };
}

/* ============================================================
   5. ตัวหมากบิชอป (BISHOP)
   ============================================================ */
function buildBishopPiece() {
  const group = new THREE.Group();
  const components = {}; const order = [];

  const woodDark = stdMat(0x3a2618, { roughness: 0.35, metalness: 0.1 });
  const woodAccent = stdMat(0x4e3524, { roughness: 0.4, metalness: 0.1 });

  let c = newComponent('bishop-finial', 'ยอดตุ่มกลม (Mitre Finial)', 'ไม้อีโบนีกลึงกลม',
    'ตุ่มกลมขนาดเล็กบนยอดหมวกบิชอป ช่วยให้ตัวหมากดูสมส่วนและลดความแหลมคมของปลายหมวก');
  addPart(c, group, new THREE.SphereGeometry(0.085, 18, 14), woodDark,
    V3(0, 2.38, 0), V3(0, 2.9, 0));
  finalizeComponent(c, components, order);

  c = newComponent('bishop-mitre', 'หมวกทรงไมเตอร์ (Mitre Head)', 'ไม้อีโบนีบากร่องเฉียง',
    'รูปทรงหมวกบิชอป (Bishop Mitre) พร้อมรอยบากเฉียงด้านข้าง ซึ่งเป็นสัญลักษณ์สื่อถึงการเดินในแนวทแยง (Diagonal) ได้อย่างชัดเจน');
  const mitrePart = addPart(c, group, new THREE.SphereGeometry(0.28, 24, 20), woodAccent,
    V3(0, 2.08, 0), V3(0, 2.0, 0));
  mitrePart.mesh.scale.set(0.92, 1.32, 0.92);
  addPart(c, group, new THREE.BoxGeometry(0.06, 0.26, 0.34),
    stdMat(0xd4af37, { metalness: 0.6, roughness: 0.35 }),
    V3(0.14, 2.12, 0), V3(0.3, 2.0, 0), { z: -0.52 });
  finalizeComponent(c, components, order);

  c = newComponent('bishop-collar', 'วงแหวนปลอกคอ (Collar)', 'ไม้กลึงเซาะร่อง',
    'วงแหวนคั่นใต้หมวกไมเตอร์ ช่วยแยกส่วนหัวและลำตัวออกจากกันอย่างชัดเจนตามแบบฉบับ Staunton');
  addPart(c, group, new THREE.TorusGeometry(0.22, 0.045, 12, 28), woodDark,
    V3(0, 1.74, 0), V3(0, 1.3, 0), { x: Math.PI / 2 });
  finalizeComponent(c, components, order);

  c = newComponent('bishop-shaft', 'ลำตัวเรียว (Tapered Shaft)', 'ไม้อีโบนี (Ebonized Boxwood)',
    'ลำตัวทรงกรวยเพรียว สูงมาตรฐานประมาณ 70 มม. (สูงกว่า Knight และ Rook แต่เตี้ยกว่า Queen)');
  addPart(c, group, new THREE.CylinderGeometry(0.18, 0.38, 1.05, 32), woodDark,
    V3(0, 1.16, 0), V3(0, 0.55, 0));
  finalizeComponent(c, components, order);

  addStandardPieceBase(group, components, order, 'bishop', 0.88, 0.18, 0x15803d, woodDark, woodAccent);

  const onSimulate = createHorizontalSpinHandler(group, 1.2);

  return {
    group, components, order, onSimulate,
    label: 'บิชอป (Bishop)',
    tagline: 'หมากบิชอป (Bishop) หมากเบาที่ควบคุมเส้นทแยงมุม (Light-squared & Dark-squared Bishop)',
    spec: [
      ['มูลค่าเชิงกลยุทธ์', '3 แต้ม (หมากเบา)'],
      ['ความสูงมาตรฐาน', '70 มม. (2.75 นิ้ว)'],
      ['ลักษณะการเดิน', 'แนวทแยงสีเดิมตลอดทั้งเกม'],
      ['สัญลักษณ์เด่น', 'หมวก Mitre บากร่องเฉียง']
    ],
    floorY: -2.4,
    home: { pos: [4.5, 2.8, 5.2], target: [0, 1.15, 0] },
    views: {
      iso: { pos: [4.5, 2.8, 5.2], target: [0, 1.15, 0] },
      top: { pos: [0.01, 7.4, 0.01], target: [0, 1.15, 0] },
      front: { pos: [0, 1.3, 6.4], target: [0, 1.15, 0] }
    }
  };
}

/* ============================================================
   6. ตัวหมากม้า (KNIGHT)
   ============================================================ */
function buildKnightPiece() {
  const group = new THREE.Group();
  const components = {}; const order = [];

  const woodLight = stdMat(0xdcb98a, { roughness: 0.35, metalness: 0.08 });
  const woodAccent = stdMat(0xc49c68, { roughness: 0.38, metalness: 0.08 });

  let c = newComponent('knight-mane', 'แผงคอและใบหูแกะสลัก (Mane & Ears)', 'ไม้บ็อกซ์วูดแกะสลักด้วยมือ',
    'ส่วนที่มีรายละเอียดประณีตที่สุดในชุดหมากรุก Staunton ช่างฝีมือต้องแกะสลักด้วยมือทีละตัว (Hand-carved) ตามต้นแบบประติมากรรมกรีกโบราณ Elgin Marbles');
  addPart(c, group, new THREE.BoxGeometry(0.14, 0.72, 0.24), woodAccent,
    V3(0, 1.72, -0.22), V3(0, 2.6, -0.8), { x: -0.22 });
  addPart(c, group, new THREE.ConeGeometry(0.06, 0.18, 8), woodLight,
    V3(0.09, 2.15, -0.1), V3(0.2, 2.6, -0.6));
  addPart(c, group, new THREE.ConeGeometry(0.06, 0.18, 8), woodLight,
    V3(-0.09, 2.15, -0.1), V3(-0.2, 2.6, -0.6));
  finalizeComponent(c, components, order);

  c = newComponent('knight-head', 'ส่วนหัวและใบหน้าม้า (Sculpted Head)', 'ไม้บ็อกซ์วูด (Boxwood)',
    'ส่วนหัวที่ยื่นไปด้านหน้าในท่วงท่าสง่างาม ช่วยให้ผู้เล่นจับหยิบข้ามตัวหมากอื่นได้ง่าย (Knight เป็นตัวเดียวที่กระโดดข้ามหมากตัวอื่นได้)');
  addPart(c, group, new THREE.BoxGeometry(0.32, 0.36, 0.64), woodLight,
    V3(0, 1.88, 0.14), V3(0, 1.8, 0.6), { x: 0.28 });
  addPart(c, group, new THREE.BoxGeometry(0.26, 0.26, 0.34), woodAccent,
    V3(0, 1.74, 0.42), V3(0, 1.8, 0.8), { x: 0.45 });
  finalizeComponent(c, components, order);

  c = newComponent('knight-neck', 'ลำคอโค้งรับน้ำหนัก (Arched Neck)', 'ไม้บ็อกซ์วูดกลึงและแกะขึ้นรูป',
    'เชื่อมต่อส่วนหัวเข้ากับฐานอย่างแข็งแรง ความสูงมาตรฐานประมาณ 60 มม. ออกแบบให้สมดุลแม้ส่วนหัวจะยื่นออกไปด้านหน้า');
  addPart(c, group, new THREE.CylinderGeometry(0.22, 0.38, 0.88, 24), woodLight,
    V3(0, 1.25, -0.02), V3(0, 0.7, 0), { x: 0.12 });
  finalizeComponent(c, components, order);

  addStandardPieceBase(group, components, order, 'knight', 0.88, 0.2, 0x15803d, woodLight, woodAccent);

  const onSimulate = createHorizontalSpinHandler(group, 1.2);

  return {
    group, components, order, onSimulate,
    label: 'ม้า (Knight)',
    tagline: 'หมากม้า (Knight) เดินเป็นรูปตัว L และเป็นตัวหมากเพียงชนิดเดียวที่กระโดดข้ามตัวหมากอื่นได้',
    spec: [
      ['มูลค่าเชิงกลยุทธ์', '3 แต้ม (หมากเบา)'],
      ['ความสูงมาตรฐาน', '60 มม. (2.35 นิ้ว)'],
      ['ลักษณะการเดิน', 'รูปตัว L (2+1 ช่อง) ข้ามตัวหมากได้'],
      ['งานฝีมือ', 'แกะสลักด้วยมือ (Hand-Carved)']
    ],
    floorY: -2.4,
    home: { pos: [4.5, 2.7, 5.0], target: [0, 1.05, 0] },
    views: {
      iso: { pos: [4.5, 2.7, 5.0], target: [0, 1.05, 0] },
      top: { pos: [0.01, 7.2, 0.01], target: [0, 1.05, 0] },
      front: { pos: [0, 1.2, 6.2], target: [0, 1.05, 0] }
    }
  };
}

/* ============================================================
   7. ตัวหมากเบี้ย (PAWN)
   ============================================================ */
function buildPawnPiece() {
  const group = new THREE.Group();
  const components = {}; const order = [];

  const woodDark = stdMat(0x3a2618, { roughness: 0.35, metalness: 0.1 });
  const woodAccent = stdMat(0x4e3524, { roughness: 0.4, metalness: 0.1 });

  let c = newComponent('pawn-head', 'ยอดทรงกลม (Spherical Head)', 'ไม้อีโบนีกลึงกลม',
    'ส่วนหัวทรงกลมเรียบง่ายเป็นเอกลักษณ์ของเบี้ย (Pawn) ช่วยให้หยิบเดินทีละช่องได้รวดเร็วและไม่บดบังสายตาเวลาวางเรียงกัน 8 ตัวหน้ากระดาน');
  addPart(c, group, new THREE.SphereGeometry(0.24, 24, 20), woodDark,
    V3(0, 1.66, 0), V3(0, 2.4, 0));
  finalizeComponent(c, components, order);

  c = newComponent('pawn-collar', 'วงแหวนปลอกคอ (Collar)', 'ไม้กลึงเซาะร่อง',
    'วงแหวนขนาดเล็กใต้ส่วนหัว ทำหน้าที่เป็นจุดพักนิ้วเวลาหยิบเบี้ยเดินหน้าหรือกินเฉียง');
  addPart(c, group, new THREE.TorusGeometry(0.2, 0.04, 12, 24), woodAccent,
    V3(0, 1.42, 0), V3(0, 1.4, 0), { x: Math.PI / 2 });
  finalizeComponent(c, components, order);

  c = newComponent('pawn-body', 'ลำตัวกรวย (Conical Body)', 'ไม้อีโบนี (Ebonized Boxwood)',
    'ลำตัวขนาดกะทัดรัด สูงมาตรฐานประมาณ 50 มม. แม้มีมูลค่าน้อยที่สุด (1 แต้ม) แต่หากเดินไปสุดกระดานสามารถเลื่อนขั้น (Promotion) เป็น Queen ได้');
  addPart(c, group, new THREE.CylinderGeometry(0.16, 0.34, 0.72, 28), woodDark,
    V3(0, 1.0, 0), V3(0, 0.55, 0));
  finalizeComponent(c, components, order);

  addStandardPieceBase(group, components, order, 'pawn', 0.78, 0.15, 0x15803d, woodDark, woodAccent);

  const onSimulate = createHorizontalSpinHandler(group, 1.2);

  return {
    group, components, order, onSimulate,
    label: 'เบี้ย (Pawn)',
    tagline: 'หมากเบี้ย (Pawn) แนวหน้าของกองทัพ เดินตรงกินเฉียง และสามารถเลื่อนขั้น (Promotion) เมื่อถึงฝั่งตรงข้าม',
    spec: [
      ['มูลค่าเชิงกลยุทธ์', '1 แต้ม (จำนวน 8 ตัว/ฝ่าย)'],
      ['ความสูงมาตรฐาน', '50 มม. (1.95 นิ้ว)'],
      ['กติกาพิเศษ', 'En Passant & Promotion'],
      ['วัสดุ', 'ไม้ Ebonized Boxwood · เหล็กถ่วง']
    ],
    floorY: -2.4,
    home: { pos: [4.2, 2.6, 4.8], target: [0, 0.9, 0] },
    views: {
      iso: { pos: [4.2, 2.6, 4.8], target: [0, 0.9, 0] },
      top: { pos: [0.01, 6.8, 0.01], target: [0, 0.9, 0] },
      front: { pos: [0, 1.1, 5.8], target: [0, 0.9, 0] }
    }
  };
}

/* ============================================================
   8. นาฬิกาจับเวลาหมากรุก (TOURNAMENT CHESS CLOCK)
   ============================================================ */
function buildChessClock() {
  const group = new THREE.Group();
  const components = {}; const order = [];

  let c = newComponent('clock-lever', 'คานกระดกและปุ่มกดสลับเวลา', 'สเตนเลสสตีล + หัวกดพลาสติก POM',
    'กลไกคานกระดก (Seesaw Rocker) เมื่อผู้เล่นเดินหมากเสร็จและกดปุ่มฝั่งตนเอง คานจะเอียงไปหยุดเวลาฝั่งตัวเองและเริ่มเดินเวลาของฝ่ายตรงข้ามทันที');
  const leverBar = addPart(c, group, new THREE.BoxGeometry(2.3, 0.08, 0.24),
    stdMat(0x94a3b8, { metalness: 0.85, roughness: 0.25 }),
    V3(0, 1.42, 0), V3(0, 2.8, 0));
  const plungerLeft = addPart(c, group, new THREE.CylinderGeometry(0.18, 0.18, 0.22, 20),
    stdMat(0xf8fafc, { roughness: 0.35 }),
    V3(-0.95, 1.55, 0), V3(-0.3, 2.8, 0));
  const plungerRight = addPart(c, group, new THREE.CylinderGeometry(0.18, 0.18, 0.22, 20),
    stdMat(0x1e293b, { roughness: 0.35 }),
    V3(0.95, 1.55, 0), V3(0.3, 2.8, 0));
  finalizeComponent(c, components, order);

  c = newComponent('clock-dials', 'หน้าปัดแสดงเวลาฝั่งขาว / ดำ', 'หน้าปัดอะคริลิก + เข็มบอกเวลา',
    'แสดงเวลาคงเหลือของทั้งสองฝ่ายแยกอิสระ พร้อมธงบอกเวลาหมด (Flag) หรือตัวเลขดิจิทัลสำหรับโหมดบวกเวลาเพิ่มต่อตา (Fischer Increment)');
  const dialMat = stdMat(0xf1f5f9, { roughness: 0.3 });
  const bezelMat = stdMat(0xd4af37, { metalness: 0.8, roughness: 0.25 });

  addPart(c, group, new THREE.CylinderGeometry(0.56, 0.56, 0.05, 32), dialMat,
    V3(-0.85, 0.72, 0.68), V3(-0.5, 0.5, 2.2), { x: Math.PI / 2 });
  addPart(c, group, new THREE.TorusGeometry(0.56, 0.035, 10, 32), bezelMat,
    V3(-0.85, 0.72, 0.71), V3(-0.5, 0.5, 2.2));
  const handLeft = addPart(c, group, new THREE.BoxGeometry(0.035, 0.38, 0.03), stdMat(0x0f172a),
    V3(-0.85, 0.84, 0.72), V3(-0.5, 0.5, 2.2));

  addPart(c, group, new THREE.CylinderGeometry(0.56, 0.56, 0.05, 32), dialMat,
    V3(0.85, 0.72, 0.68), V3(0.5, 0.5, 2.2), { x: Math.PI / 2 });
  addPart(c, group, new THREE.TorusGeometry(0.56, 0.035, 10, 32), bezelMat,
    V3(0.85, 0.72, 0.71), V3(0.5, 0.5, 2.2));
  const handRight = addPart(c, group, new THREE.BoxGeometry(0.035, 0.38, 0.03), stdMat(0xdc2626),
    V3(0.85, 0.84, 0.72), V3(0.5, 0.5, 2.2));
  finalizeComponent(c, components, order);

  c = newComponent('clock-switches', 'สวิตช์ไมโครตรวจจับการกด', 'สวิตช์หน้าสัมผัสทองแดง',
    'รับแรงกดจากคานกระดกด้านบนเพื่อส่งสัญญาณตัดต่อวงจรจับเวลาของแต่ละฝั่งอย่างแม่นยำในระดับเสี้ยววินาที');
  addPart(c, group, new THREE.BoxGeometry(0.24, 0.16, 0.24), stdMat(0x2563eb, { roughness: 0.4 }),
    V3(-0.95, 1.18, 0), V3(-0.4, 1.4, 0));
  addPart(c, group, new THREE.BoxGeometry(0.24, 0.16, 0.24), stdMat(0x2563eb, { roughness: 0.4 }),
    V3(0.95, 1.18, 0), V3(0.4, 1.4, 0));
  finalizeComponent(c, components, order);

  c = newComponent('clock-pcb', 'แผงวงจรควบคุมเวลา (Timing PCB)', 'แผงวงจร FR4 + ผลึกควอตซ์ 32.768 kHz',
    'ประมวลผลรูปแบบการจับเวลาสากล เช่น Classical (90 นาที + 30 วินาที/ตา), Rapid และ Blitz พร้อมบันทึกจำนวนตาเดิน');
  addPart(c, group, new THREE.BoxGeometry(2.5, 0.08, 0.85), stdMat(0x15803d, { roughness: 0.55 }),
    V3(0, 0.65, 0.15), V3(0, 0.2, 0.8));
  addPart(c, group, new THREE.BoxGeometry(0.36, 0.1, 0.36), stdMat(0x111827, { metalness: 0.4 }),
    V3(0, 0.72, 0.15), V3(0, 0.2, 0.8));
  finalizeComponent(c, components, order);

  c = newComponent('clock-body', 'ตัวเรือนนาฬิกา (Outer Housing)', 'พลาสติก ABS ทนแรงกระแทกสูง',
    'โครงสร้างตัวเรือนทรงลาดเอียงเพื่อให้อ่านค่าเวลาได้ชัดเจนจากมุมมองของผู้เล่น ออกแบบให้แข็งแรงทนทานต่อการตบนาฬิกาในเกมเร็ว');
  const bodyMat = stdMat(0x1e2430, { roughness: 0.45, metalness: 0.15 });
  addPart(c, group, new THREE.BoxGeometry(3.2, 1.25, 0.22), bodyMat, V3(0, 0.7, -0.55), V3(0, 0, -1.6));
  addPart(c, group, new THREE.BoxGeometry(0.22, 1.25, 1.3), bodyMat, V3(-1.5, 0.7, 0.05), V3(-1.4, 0, 0));
  addPart(c, group, new THREE.BoxGeometry(0.22, 1.25, 1.3), bodyMat, V3(1.5, 0.7, 0.05), V3(1.4, 0, 0));
  addPart(c, group, new THREE.BoxGeometry(3.2, 0.14, 1.3), bodyMat, V3(0, 1.28, 0.05), V3(0, 0.9, 0));
  finalizeComponent(c, components, order);

  c = newComponent('clock-base', 'ฐานรองและช่องแบตเตอรี่ AA', 'พลาสติก ABS + ยางกันลื่น',
    'ฝาปิดด้านล่างพร้อมแผ่นยางกันลื่น 4 มุม ยึดนาฬิกาให้อยู่กับที่บนโต๊ะแข่งขันและบรรจุแบตเตอรี่ AA 2 ก้อน');
  addPart(c, group, new THREE.BoxGeometry(3.2, 0.12, 1.3), stdMat(0x0f172a, { roughness: 0.7 }),
    V3(0, 0.06, 0.05), V3(0, -1.5, 0));
  addPart(c, group, new THREE.CylinderGeometry(0.12, 0.12, 0.85, 16), stdMat(0xd97706, { metalness: 0.6 }),
    V3(-0.3, 0.2, -0.2), V3(0, -0.8, -0.5), { z: Math.PI / 2 });
  addPart(c, group, new THREE.CylinderGeometry(0.12, 0.12, 0.85, 16), stdMat(0xd97706, { metalness: 0.6 }),
    V3(-0.3, 0.2, 0.1), V3(0, -0.8, -0.5), { z: Math.PI / 2 });
  finalizeComponent(c, components, order);

  function onSimulate(t, active) {
    group.rotation.y = 0;
    if (!active) {
      leverBar.simRot.set(0, 0, 0);
      plungerLeft.simOffset.set(0, 0, 0);
      plungerRight.simOffset.set(0, 0, 0);
      handLeft.simRot.set(0, 0, 0);
      handRight.simRot.set(0, 0, 0);
      return;
    }
    const side = Math.sin(t * 2.2) >= 0 ? 1 : -1;
    leverBar.simRot.set(0, 0, side * 0.14);
    plungerLeft.simOffset.set(0, side > 0 ? 0.08 : -0.08, 0);
    plungerRight.simOffset.set(0, side > 0 ? -0.08 : 0.08, 0);

    if (side > 0) handRight.simRot.set(0, 0, -t * 2.5);
    else handLeft.simRot.set(0, 0, -t * 2.5);
  }

  return {
    group, components, order, onSimulate,
    label: 'นาฬิกา (Clock)',
    tagline: 'นาฬิกาจับเวลาแข่งขันมาตรฐาน แสดงกลไกคานกระดก สวิตช์ และวงจรจับเวลาแยกสองฝั่ง',
    spec: [
      ['ระบบจับเวลา', 'Fischer Increment / Delay'],
      ['กลไกสลับเทิร์น', 'Seesaw Rocker Lever'],
      ['แหล่งพลังงาน', 'แบตเตอรี่ AA × 2 ก้อน'],
      ['ความแม่นยำ', '±0.5 วินาที / วัน']
    ],
    floorY: -1.8,
    home: { pos: [4.8, 3.2, 5.8], target: [0, 0.6, 0] },
    views: {
      iso: { pos: [4.8, 3.2, 5.8], target: [0, 0.6, 0] },
      top: { pos: [0.01, 8.2, 0.01], target: [0, 0.6, 0] },
      front: { pos: [0, 1.0, 7.2], target: [0, 0.6, 0] }
    }
  };
}

/* ============================================================
   DEVICE REGISTRY + STATE
   ============================================================ */
const DEVICES = {
  board:  { key: 'board',  label: 'กระดาน',   build: buildChessBoard },
  king:   { key: 'king',   label: 'King',     build: buildKingPiece },
  queen:  { key: 'queen',  label: 'Queen',    build: buildQueenPiece },
  rook:   { key: 'rook',   label: 'Rook',     build: buildRookPiece },
  bishop: { key: 'bishop', label: 'Bishop',   build: buildBishopPiece },
  knight: { key: 'knight', label: 'Knight',   build: buildKnightPiece },
  pawn:   { key: 'pawn',   label: 'Pawn',     build: buildPawnPiece },
  clock:  { key: 'clock',  label: 'นาฬิกา',   build: buildChessClock }
};
const DEVICE_ORDER = ['board', 'king', 'queen', 'rook', 'bishop', 'knight', 'pawn', 'clock'];

let currentGroup = null;
let currentData  = null;
let selectedId   = null;
let hoveredId    = null;

DEVICE_ORDER.forEach(key => {
  const btn = document.createElement('button');
  btn.dataset.device = key;
  btn.innerHTML = `<span class="dot"></span><span class="label">${DEVICES[key].label}</span>`;
  btn.addEventListener('click', () => loadDevice(key));
  deviceTabsEl.appendChild(btn);
});

function updateActiveTab(key) {
  deviceTabsEl.querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', b.dataset.device === key);
  });
}

/* ============================================================
   VISUAL MODES (X-Ray, Isolate, Simulation)
   ============================================================ */
function setIsolate(state) {
  if (!currentData) return;
  if (state && !selectedId) {
    isIsolated = false;
  } else {
    isIsolated = Boolean(state && selectedId);
  }
  applyVisualModes();
}

function applyVisualModes() {
  if (!currentData) return;

  if (!selectedId) {
    isIsolated = false;
  }

  const activeIsolate = Boolean(isIsolated && selectedId);

  btnXray.classList.toggle('active', isXray);
  btnIsolate.classList.toggle('active', activeIsolate);
  btnIsolate.disabled = !selectedId;

  currentData.order.forEach(id => {
    const comp = currentData.components[id];
    const shouldShow = !activeIsolate || id === selectedId;

    comp.parts.forEach(p => {
      const mat = p.mesh.material;
      p.mesh.visible = shouldShow;
      p.edgeLine.visible = isXray && shouldShow;

      if (shouldShow) {
        if (isXray) {
          mat.transparent = true;
          mat.opacity = Math.min(p.baseOpacity, 0.28);
          mat.depthWrite = false;
        } else {
          mat.transparent = p.baseTransparent;
          mat.opacity = p.baseOpacity;
          mat.depthWrite = !p.baseTransparent;
        }
        mat.needsUpdate = true;
      }
    });
  });
}

btnSim.addEventListener('click', () => {
  isSimulating = !isSimulating;
  btnSim.classList.toggle('active', isSimulating);
  if (!isSimulating && currentData && currentData.onSimulate) {
    currentData.onSimulate(0, false);
  }
});

btnXray.addEventListener('click', () => {
  isXray = !isXray;
  applyVisualModes();
});

btnIsolate.addEventListener('click', () => {
  if (!selectedId) return;
  setIsolate(!isIsolated);
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'i' || e.key === 'I') {
    if (selectedId) setIsolate(!isIsolated);
  } else if (e.key === 'Escape') {
    clearSelection();
  }
});

/* ============================================================
   LOAD / SWITCH DEVICE
   ============================================================ */
function loadDevice(key) {
  const def = DEVICES[key];
  if (!def) return;
  const data = def.build();

  if (currentGroup) {
    scene.remove(currentGroup);
    disposeGroup(currentGroup);
  }

  currentGroup = data.group;
  currentData = data;
  currentGroup.rotation.y = 0;
  scene.add(currentGroup);

  selectedId = null;
  hoveredId = null;
  isIsolated = false;
  deconFactor = 0;

  if (grid) grid.position.y = data.floorY;
  pad.position.y = data.floorY + 0.01;

  buildLayerList(data);
  buildSpecSheet(data);

  vpDeviceName.textContent = data.label;
  vpDeviceSub.textContent = 'มุมมองแยกชิ้นส่วน 3 มิติ';

  deconSlider.value = 0;
  deconValue.textContent = '0%';

  camera.position.set(...data.home.pos);
  focusTarget.set(...data.home.target);
  controls.target.copy(focusTarget);

  applyVisualModes();
  showOverview(data);
  updateActiveTab(key);
}

/* ============================================================
   LEFT PANEL: LAYER LIST + SPEC SHEET
   ============================================================ */
function buildLayerList(data) {
  layerListEl.innerHTML = '';
  data.order.forEach((id, idx) => {
    const comp = data.components[id];
    const li = document.createElement('li');
    li.dataset.id = id;
    const idxStr = String(idx + 1).padStart(2, '0');
    li.innerHTML = `
      <span class="idx">${idxStr}</span>
      <span class="meta">
        <div class="name">${comp.name}</div>
        <div class="material">${comp.material}</div>
      </span>
    `;
    li.addEventListener('click', () => toggleSelect(id));
    layerListEl.appendChild(li);
  });
}

function buildSpecSheet(data) {
  specSheetEl.innerHTML = data.spec.map(([label, val]) => `
    <div class="spec-row"><span>${label}</span><span>${val}</span></div>
  `).join('');
}

function highlightListRow() {
  layerListEl.querySelectorAll('li').forEach(li => {
    li.classList.toggle('selected', selectedId === li.dataset.id);
    li.classList.toggle('hovered', !selectedId && hoveredId === li.dataset.id);
  });
}

/* ============================================================
   INSPECTOR PANEL
   ============================================================ */
function showOverview(data) {
  inspEyebrow.textContent = 'ทั้งหมด ' + data.order.length + ' ชั้นส่วนประกอบ';
  inspName.textContent = data.label;
  inspMaterial.style.display = 'none';
  inspDesc.textContent = data.tagline;
  inspHint.textContent = 'คลิกเลือกชิ้นส่วนที่ต้องการดูรายละเอียด จากนั้นกด Isolate (หรือกดปุ่ม I) เพื่อซ่อนชิ้นส่วนอื่น';
}

function showComponent(id) {
  const data = currentData;
  const idx = data.order.indexOf(id);
  const comp = data.components[id];
  if (!comp) return;
  inspEyebrow.textContent = `ส่วนประกอบที่ ${String(idx + 1).padStart(2, '0')} / ${data.order.length}`;
  inspName.textContent = comp.name;
  inspMaterial.style.display = 'inline-block';
  inspMaterial.textContent = comp.material;
  inspDesc.textContent = comp.description;
  inspHint.textContent = selectedId === id
    ? (isIsolated
        ? 'กำลังแสดงเฉพาะชิ้นส่วนนี้ กด [I] หรือคลิก Isolate อีกครั้งเพื่อแสดงทั้งหมด'
        : 'กด [I] หรือคลิก Isolate ด้านบนเพื่อซ่อนชิ้นส่วนอื่น หรือกด [Esc] เพื่อยกเลิกการเลือก')
    : '';
}

function refreshInspector() {
  if (selectedId) showComponent(selectedId);
  else if (hoveredId) showComponent(hoveredId);
  else showOverview(currentData);
}

/* ============================================================
   HIGHLIGHTING
   ============================================================ */
function setComponentHighlight(id, hex, intensity) {
  const comp = currentData.components[id];
  if (!comp) return;
  comp.parts.forEach(p => {
    if (p.mesh.material.emissive) {
      p.mesh.material.emissive.setHex(hex);
      p.mesh.material.emissiveIntensity = intensity;
    }
  });
}

function clearComponentHighlight(id) {
  const comp = currentData.components[id];
  if (!comp) return;
  comp.parts.forEach(p => {
    if (p.mesh.material.emissive) {
      p.mesh.material.emissive.setHex(p.baseEmissiveHex);
      p.mesh.material.emissiveIntensity = p.baseEmissiveIntensity;
    }
  });
}

function refreshHighlights() {
  if (!currentData) return;
  const t = SCENE_THEME[themeKey];
  if (hoveredId && hoveredId !== selectedId) {
    setComponentHighlight(hoveredId, t.hoverHex, t.hoverIntensity);
  }
  if (selectedId) {
    setComponentHighlight(selectedId, t.selectHex, t.selectIntensity);
  }
}

function setHovered(id) {
  if (id === hoveredId) return;
  if (hoveredId && hoveredId !== selectedId) clearComponentHighlight(hoveredId);
  hoveredId = id;
  const t = SCENE_THEME[themeKey];
  if (hoveredId && hoveredId !== selectedId) setComponentHighlight(hoveredId, t.hoverHex, t.hoverIntensity);
  highlightListRow();
  refreshInspector();
}

function toggleSelect(id) {
  const t = SCENE_THEME[themeKey];
  if (selectedId === id) {
    clearComponentHighlight(id);
    selectedId = null;
    isIsolated = false;
    if (hoveredId === id) setComponentHighlight(id, t.hoverHex, t.hoverIntensity);
    focusTarget.copy(new THREE.Vector3(...currentData.home.target));
  } else {
    if (selectedId) clearComponentHighlight(selectedId);
    if (hoveredId && hoveredId !== id) clearComponentHighlight(hoveredId);
    selectedId = id;
    setComponentHighlight(id, t.selectHex, t.selectIntensity);
    const comp = currentData.components[id];
    const explodedCenter = comp.center.clone().add(comp.parts[0].explodeDir.clone().multiplyScalar(deconFactor));
    focusTarget.copy(explodedCenter);
  }
  applyVisualModes();
  highlightListRow();
  refreshInspector();
}

function clearSelection() {
  if (selectedId) {
    clearComponentHighlight(selectedId);
    selectedId = null;
    isIsolated = false;
    focusTarget.copy(new THREE.Vector3(...currentData.home.target));
    applyVisualModes();
    highlightListRow();
    refreshInspector();
  }
}

/* ============================================================
   3D CALLOUT LEADER LINE PROJECTION
   ============================================================ */
const projVec = new THREE.Vector3();

function updateCallout() {
  if (!selectedId || !currentData) {
    calloutLayer.style.display = 'none';
    calloutTag.style.display = 'none';
    return;
  }

  const comp = currentData.components[selectedId];
  const idx = currentData.order.indexOf(selectedId);

  projVec.set(0, 0, 0);
  comp.parts.forEach(p => projVec.add(p.mesh.position));
  projVec.divideScalar(comp.parts.length);
  projVec.project(camera);

  if (projVec.z > 1) {
    calloutLayer.style.display = 'none';
    calloutTag.style.display = 'none';
    return;
  }

  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  const x1 = (projVec.x * 0.5 + 0.5) * w;
  const y1 = (-projVec.y * 0.5 + 0.5) * h;

  const goRight = x1 < w * 0.58;
  const elbowX = goRight ? Math.min(w - 150, x1 + 42) : Math.max(150, x1 - 42);
  const elbowY = Math.max(70, Math.min(h - 90, y1 - 28));
  const endX = goRight ? elbowX + 24 : elbowX - 24;

  calloutLayer.style.display = 'block';
  calloutTag.style.display = 'inline-flex';

  calloutDot.setAttribute('cx', x1);
  calloutDot.setAttribute('cy', y1);
  calloutLine.setAttribute('points', `${x1},${y1} ${elbowX},${elbowY} ${endX},${elbowY}`);

  calloutIdx.textContent = String(idx + 1).padStart(2, '0');
  calloutTitle.textContent = comp.name;

  calloutTag.style.top = elbowY + 'px';
  if (goRight) {
    calloutTag.style.left = (endX + 6) + 'px';
    calloutTag.style.right = 'auto';
  } else {
    calloutTag.style.right = (w - endX + 6) + 'px';
    calloutTag.style.left = 'auto';
  }
}

/* ============================================================
   RAYCASTING (hover + click)
   ============================================================ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function getPickableMeshes() {
  const arr = [];
  if (!currentData) return arr;
  currentData.order.forEach(id => {
    if (isIsolated && selectedId && id !== selectedId) return;
    currentData.components[id].parts.forEach(p => {
      if (p.mesh.visible) arr.push(p.mesh);
    });
  });
  return arr;
}

renderer.domElement.addEventListener('pointermove', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(getPickableMeshes(), false);
  const found = hits.length ? hits[0].object.userData.componentId : null;
  setHovered(found || null);

  if (found) {
    hoverTip.style.display = 'block';
    hoverTip.style.left = (event.clientX + 14) + 'px';
    hoverTip.style.top = (event.clientY + 14) + 'px';
    hoverTip.textContent = currentData.components[found].name;
  } else {
    hoverTip.style.display = 'none';
  }
});

renderer.domElement.addEventListener('pointerleave', () => {
  setHovered(null);
  hoverTip.style.display = 'none';
});

renderer.domElement.addEventListener('click', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(getPickableMeshes(), false);
  if (hits.length) toggleSelect(hits[0].object.userData.componentId);
  else clearSelection();
});

/* ============================================================
   DECONSTRUCTION SLIDER
   ============================================================ */
deconSlider.addEventListener('input', () => {
  const val = parseFloat(deconSlider.value);
  deconValue.textContent = Math.round(val) + '%';
  deconFactor = val / 100;
});

document.querySelectorAll('.decon-chips button').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = parseFloat(btn.dataset.val);
    deconSlider.value = val;
    deconValue.textContent = val + '%';
    deconFactor = val / 100;
  });
});

/* ============================================================
   CAMERA VIEW PRESETS + RESET
   ============================================================ */
function setView(viewKey) {
  const v = currentData.views[viewKey];
  if (!v) return;
  camera.position.set(...v.pos);
  focusTarget.set(...v.target);
}

document.querySelectorAll('#view-presets button').forEach(btn => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

document.getElementById('btn-reset').addEventListener('click', () => {
  setView('iso');
  clearSelection();
});

/* ============================================================
   THEME SWITCHING
   ============================================================ */
function setTheme(key, persist = true) {
  themeKey = key === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', themeKey);

  if (persist) {
    try { localStorage.setItem(THEME_KEY, themeKey); } catch (e) {}
  }

  btnTheme.title = themeKey === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด';
  btnTheme.setAttribute('aria-pressed', themeKey === 'light' ? 'true' : 'false');

  applySceneTheme(themeKey);
  refreshHighlights();
}

btnTheme.addEventListener('click', () => {
  setTheme(themeKey === 'dark' ? 'light' : 'dark');
});

if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const onChange = (e) => {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (err) {}
    if (saved) return;
    setTheme(e.matches ? 'light' : 'dark', false);
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}

/* ============================================================
   RESIZE & ANIMATION LOOP
   ============================================================ */
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  if (currentData) {
    if (currentData.onSimulate) {
      currentData.onSimulate(elapsed, isSimulating);
    }
    currentData.order.forEach(id => {
      currentData.components[id].parts.forEach(p => {
        p.mesh.position.copy(p.basePos)
          .addScaledVector(p.explodeDir, deconFactor)
          .add(p.simOffset);
        p.mesh.rotation.set(
          p.baseRot.x + p.simRot.x,
          p.baseRot.y + p.simRot.y,
          p.baseRot.z + p.simRot.z
        );
      });
    });
  }

  controls.target.lerp(focusTarget, 0.09);
  controls.update();
  updateCallout();
  renderer.render(scene, camera);
}

/* ============================================================
   INIT
   ============================================================ */
applySceneTheme(themeKey);
btnTheme.title = themeKey === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด';
btnTheme.setAttribute('aria-pressed', themeKey === 'light' ? 'true' : 'false');

loadDevice('board');
animate();
setTimeout(resize, 60);