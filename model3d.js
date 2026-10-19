import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const mount = document.getElementById('model');
const stage = document.getElementById('stage');
const feminine = document.body.dataset.model === 'woman';
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f2f0e9');
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 2.25, 7.5);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
mount.replaceChildren(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.65, 0);
controls.enableDamping = true;
controls.dampingFactor = .08;
// Move the view: right-drag, or Shift/Ctrl + drag, or two fingers on a touch screen.
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.minDistance = 4.4;
controls.maxDistance = 10;
controls.maxPolarAngle = Math.PI * .87;
const rotationControls = new TransformControls(camera, renderer.domElement);
rotationControls.setMode('rotate');
rotationControls.setSpace('local');
rotationControls.size = .72;
const rotationGizmo = rotationControls.getHelper();
rotationGizmo.visible = false;
scene.add(rotationGizmo);
rotationControls.addEventListener('dragging-changed', event => { controls.enabled = !event.value; });
scene.add(new THREE.HemisphereLight('#fffaf0', '#807566', 2.0));
const key = new THREE.DirectionalLight('#fff5e6', 2.2);
key.position.set(-3, 6, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
const fill = new THREE.DirectionalLight('#d8e0ed', 1.0); fill.position.set(4, 3, -4); scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: '#e8e5dc', roughness: .95 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.025; floor.receiveShadow = true; scene.add(floor);

const skin = new THREE.MeshStandardMaterial({ color: '#c7a88b', roughness: .82 });
const anatomicalSkin = skin.clone(); anatomicalSkin.side = THREE.DoubleSide;
const cloth = new THREE.MeshStandardMaterial({ color: '#ded9cf', roughness: .88, side: THREE.DoubleSide });
const bodySuitMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .84, side: THREE.DoubleSide });
const fabricMats = new Map();
const surfaces = new Map();
function ellipsoid(name, pos, size, mat = skin) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat);
  m.name = name; m.position.set(...pos); m.scale.set(...size); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
function capsuleBetween(name, a, b, radius, mat = skin) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), d = new THREE.Vector3().subVectors(vb, va);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(.01, d.length() - 2 * radius), 6, 16), mat);
  mesh.name = name; mesh.position.copy(va).add(vb).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); mesh.castShadow = true; scene.add(mesh); return mesh;
}
function makeSurface(panel, rows, a0, a1, segments = 26, material = cloth, register = true) {
  const positions = [], uvs = [], indices = [];
  const minY = rows[0].y, height = Math.max(.001, rows.at(-1).y - minY);
  rows.forEach((r, j) => {
    const rowPoints = [], distances = [0]; let length = 0;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, a = a0 + (a1 - a0) * t;
      const rz = Math.cos(a) >= 0 ? (r.rzFront ?? r.rz) : (r.rzBack ?? r.rz);
      const x = r.cx + r.rx * Math.sin(a);
      const bust = (r.bust || 0) * Math.max(0, Math.cos(a)) *
        (Math.exp(-(((x - .15) / .18) ** 2)) + Math.exp(-(((x + .15) / .18) ** 2)));
      const z = rz * Math.cos(a) + bust;
      rowPoints.push([x, z]);
      if (i) { length += Math.hypot(x - rowPoints[i - 1][0], z - rowPoints[i - 1][1]); distances.push(length); }
    }
    for (let i = 0; i <= segments; i++) {
      const [x, z] = rowPoints[i];
      positions.push(x, r.y, z); uvs.push(length ? distances[i] / length : i / segments, 1 - (r.y - minY) / height);
      if (j < rows.length - 1 && i < segments) {
        const n = j * (segments + 1) + i, next = n + segments + 1;
        indices.push(n, next, n + 1, n + 1, next, next + 1);
      }
    }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material.clone()); mesh.name = panel; mesh.userData.panel = panel; mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); if (register) surfaces.set(panel, mesh); return mesh;
}
function taperedTube(curve, lengthSegments, radialSegments, startRadius, endRadius) {
  const g = new THREE.TubeGeometry(curve, lengthSegments, 1, radialSegments, false);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const t = uv.getX(i), center = curve.getPointAt(t);
    let radius;
    if (Array.isArray(startRadius)) {
      const scaled = t * (startRadius.length - 1), index = Math.min(startRadius.length - 2, Math.floor(scaled));
      radius = THREE.MathUtils.lerp(startRadius[index], startRadius[index + 1], scaled - index);
    } else radius = startRadius + (endRadius - startRadius) * t;
    pos.setXYZ(i, center.x + (pos.getX(i) - center.x) * radius, center.y + (pos.getY(i) - center.y) * radius, center.z + (pos.getZ(i) - center.z) * radius);
  }
  pos.needsUpdate = true; g.computeVertexNormals(); return g;
}
// The woman's underlying body uses a continuous ring profile, with a separate
// pelvis, waist, rib cage and shoulder slope rather than a single oval torso.
let feminineTorsoRows = [];
if (feminine) {
  const bodyRows = [
    { y: 1.23, cx: 0, rx: .31, rz: .20 }, { y: 1.29, cx: 0, rx: .38, rz: .22 },
    { y: 1.35, cx: 0, rx: .45, rz: .24 }, { y: 1.41, cx: 0, rx: .485, rz: .25 },
    { y: 1.47, cx: 0, rx: .45, rz: .25 }, { y: 1.54, cx: 0, rx: .38, rz: .24 },
    { y: 1.62, cx: 0, rx: .33, rz: .24 }, { y: 1.70, cx: 0, rx: .30, rz: .225 },
    { y: 1.88, cx: 0, rx: .32, rz: .23 }, { y: 2.02, cx: 0, rx: .35, rz: .24 },
    { y: 2.12, cx: 0, rx: .39, rz: .255 },
    { y: 2.32, cx: 0, rx: .41, rz: .25 }, { y: 2.49, cx: 0, rx: .45, rz: .23 },
    { y: 2.57, cx: 0, rx: .39, rz: .205 }, { y: 2.65, cx: 0, rx: .30, rz: .17 },
    // Trapezius: the shoulders slope up into the neck and end inside the neck column.
    { y: 2.72, cx: 0, rx: .20, rz: .135 }, { y: 2.79, cx: 0, rx: .125, rz: .105 }, { y: 2.86, cx: 0, rx: .088, rz: .088 }
  ];
  feminineTorsoRows = bodyRows;
} else ellipsoid('body', [0, 2.03, 0], [.48, .75, .25]);
ellipsoid('head', [0, 3.23, 0], [.25, .32, .24]);
capsuleBetween('neck', [0, 2.61, 0], [0, 2.99, 0], feminine ? .085 : .105);
// Shirt front and back are separate textile panels around the torso.
const shirtRows = feminine ? [
  { y: .68, cx: 0, rx: .52, rz: .31 }, { y: .82, cx: 0, rx: .53, rz: .315 },
  { y: 1.00, cx: 0, rx: .52, rz: .31 }, { y: 1.24, cx: 0, rx: .46, rz: .29 },
  { y: 1.40, cx: 0, rx: .37, rz: .265 }, { y: 1.82, cx: 0, rx: .42, rz: .275 },
  { y: 2.08, cx: 0, rx: .47, rz: .30 }, { y: 2.27, cx: 0, rx: .49, rz: .305 }, { y: 2.50, cx: 0, rx: .47, rz: .27 },
  { y: 2.59, cx: 0, rx: .47, rz: .25 }, { y: 2.65, cx: 0, rx: .44, rz: .24 },
  { y: 2.70, cx: 0, rx: .40, rz: .225 }, { y: 2.75, cx: 0, rx: .32, rz: .20 },
  { y: 2.79, cx: 0, rx: .23, rz: .17 }, { y: 2.82, cx: 0, rx: .16, rz: .145 }
] : [
  { y: 1.36, cx: 0, rx: .43, rz: .265 }, { y: 1.48, cx: 0, rx: .48, rz: .285 },
  { y: 1.82, cx: 0, rx: .46, rz: .28 }, { y: 2.27, cx: 0, rx: .53, rz: .285 },
  { y: 2.50, cx: 0, rx: .51, rz: .27 }, { y: 2.59, cx: 0, rx: .48, rz: .255 },
  // Broad, evenly curved yoke prevents the neck-to-shoulder cloth from pinching.
  { y: 2.65, cx: 0, rx: .46, rz: .25 }, { y: 2.70, cx: 0, rx: .42, rz: .235 },
  { y: 2.75, cx: 0, rx: .34, rz: .205 }, { y: 2.79, cx: 0, rx: .24, rz: .175 },
  { y: 2.82, cx: 0, rx: .17, rz: .15 }
];
if (!feminine) {
  makeSurface('shirtFront', shirtRows, -Math.PI / 2, Math.PI / 2);
  makeSurface('shirtBack', shirtRows, Math.PI / 2, Math.PI * 1.5);
}
// Sleeves have their own wrapped textile surfaces and remain independently selectable.
function makeSleeve(id, sign) {
  // The relaxed arm curves down beside the torso; its sleeve follows the same path.
  // Begin well inside the shirt shoulder so the open tube end is hidden by the garment.
  const points = [
    [sign * .28, 2.57, 0], [sign * .47, 2.53, 0],
    [sign * .60, 2.31, 0], [sign * .69, 2.02, 0],
    [sign * .80, 1.66, 0], [sign * .84, 1.38, 0]
  ].map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(points);
  if (!feminine) {
    const sleeve = new THREE.Mesh(taperedTube(curve, 48, 24, .17, .135), cloth.clone());
    sleeve.name = id; sleeve.userData.panel = id; sleeve.castShadow = true; sleeve.receiveShadow = true;
    scene.add(sleeve); surfaces.set(id, sleeve);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .105, 16, false), skin);
    arm.name = `${id}Arm`; arm.castShadow = true; scene.add(arm);
  }
  if (feminine) {
    const shoulder = ellipsoid(`${id}ShoulderCap`, [sign * .40, 2.48, 0], [.18, .20, .17]);
    shoulder.material = skin;
  }
  ellipsoid(`${id}Hand`, [sign * .88, 1.25, 0], [.13, .16, .12]);
}
makeSleeve('leftSleeve', -1); makeSleeve('rightSleeve', 1);
// Two tapered legs, with separate front and back cloth panels on each leg.
for (const [id, cx] of [['left', -.235], ['right', .235]]) {
  const rows = feminine ? [
    { y: .12, cx: cx * .90, rx: .12, rz: .135 }, { y: .28, cx: cx * .94, rx: .135, rz: .145 },
    { y: .48, cx: cx * .98, rx: .175, rz: .175 }, { y: .68, cx: cx * 1.02, rx: .155, rz: .16 },
    { y: .88, cx: cx * 1.02, rx: .19, rz: .19 }, { y: 1.08, cx: cx * .86, rx: .23, rz: .215 },
    { y: 1.25, cx: cx * .72, rx: .275, rz: .235 }, { y: 1.43, cx: cx * .80, rx: .31, rz: .26 },
    { y: 1.53, cx: cx * .90, rx: .30, rz: .25 }
  ] : [
    { y: .12, cx, rx: .17, rz: .18 }, { y: .48, cx, rx: .175, rz: .185 },
    { y: .86, cx, rx: .205, rz: .205 }, { y: 1.25, cx, rx: .24, rz: .22 },
    { y: 1.48, cx, rx: .245, rz: .22 }
  ];
  // Extra cloth rows around the knee let the trouser bend smoothly with its leg.
  const denseRows = [];
  for (let r = 0; r < rows.length - 1; r++) for (let step = 0; step < 6; step++) {
    const t = step / 6, a = rows[r], b = rows[r + 1], y = a.y + (b.y - a.y) * t;
    const kneeEase = .026 * Math.exp(-(((y - .69) / .16) ** 2));
    denseRows.push({ y, cx: a.cx + (b.cx - a.cx) * t, rx: a.rx + (b.rx - a.rx) * t + .012 + kneeEase, rz: a.rz + (b.rz - a.rz) * t + .012 + kneeEase });
  }
  denseRows.push({ ...rows.at(-1), rx: rows.at(-1).rx + .012, rz: rows.at(-1).rz + .012 });
  if (!feminine) {
    makeSurface(`${id}LegFront`, denseRows, -Math.PI / 2, Math.PI / 2);
    makeSurface(`${id}LegBack`, denseRows, Math.PI / 2, Math.PI * 1.5);
  }
  if (!feminine) capsuleBetween(`${id}leg`, [cx, .08, 0], [cx, .58, 0], .12);
  ellipsoid(`${id}foot`, [cx, .09, .14], feminine ? [.16, .095, .29] : [.14, .085, .27]);
}
// Shirt collar and a quiet center seam give the plain mannequin a readable outfit shape.
const collar = feminine ? null : new THREE.Mesh(new THREE.TorusGeometry(.15, .022, 10, 48), new THREE.MeshStandardMaterial({ color: '#c7c1b6', roughness: .9 }));
if (collar) { collar.position.set(0, 2.82, 0); collar.rotation.x = Math.PI / 2; scene.add(collar); }
const seam = feminine ? null : new THREE.Mesh(new THREE.BoxGeometry(.012, 1.18, .012), new THREE.MeshStandardMaterial({ color: '#bdb6aa' }));
if (seam) { seam.position.set(0, 2.0, .252); scene.add(seam); }
// Add invisible pivots around the existing geometry so the mannequin keeps its
// current shape and neutral pose while allowing simple joint rotations.
function makeJoint(name, position, objectNames) {
  const joint = new THREE.Group(); joint.name = name; joint.position.set(...position); scene.add(joint);
  scene.updateMatrixWorld(true); joint.updateMatrixWorld(true);
  objectNames.map(n => scene.getObjectByName(n)).filter(Boolean).forEach(object => joint.attach(object));
  return joint;
}
const joints = {
  torso: makeJoint('torsoPivot', [0, 1.36, 0], []),
  head: makeJoint('headJoint', [0, 2.99, 0], ['head']),
  leftArm: makeJoint('leftShoulder', [-.36, 2.57, 0], ['leftSleeve', 'leftSleeveArm', 'leftSleeveHand', 'leftSleeveShoulderCap']),
  rightArm: makeJoint('rightShoulder', [.36, 2.57, 0], ['rightSleeve', 'rightSleeveArm', 'rightSleeveHand', 'rightSleeveShoulderCap']),
  leftLeg: makeJoint('leftHip', [feminine ? -.27 : -.235, feminine ? 1.60 : 1.45, 0], [feminine ? 'leftlegSkin' : 'leftLegFront', ...(feminine ? [] : ['leftLegBack']), 'leftleg', 'leftfoot']),
  rightLeg: makeJoint('rightHip', [feminine ? .27 : .235, feminine ? 1.60 : 1.45, 0], [feminine ? 'rightlegSkin' : 'rightLegFront', ...(feminine ? [] : ['rightLegBack']), 'rightleg', 'rightfoot']),
  neck: makeJoint('neckJoint', [0, 2.61, 0], ['neck'])
};
joints.neck.attach(joints.head);function bone(parent, name, position) { const b = new THREE.Bone(); b.name = name; b.position.set(...position); parent.add(b); return b; }
function skinnedCopy(source, parent, skeleton, hingeIndex, hingeY, blend = .10) {
  const geometry = source.geometry.clone(); source.updateMatrix(); geometry.applyMatrix4(source.matrix);
  const positions = geometry.attributes.position, indices = new Uint16Array(positions.count * 4), weights = new Float32Array(positions.count * 4);
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i), lower = 1 - THREE.MathUtils.smoothstep(y, hingeY - blend, hingeY + blend), k = i * 4;
    indices[k] = 0; indices[k + 1] = hingeIndex; weights[k] = 1 - lower; weights[k + 1] = lower;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const mesh = new THREE.SkinnedMesh(geometry, source.material); mesh.name = source.name; mesh.castShadow = true; mesh.receiveShadow = true; source.parent.remove(source); parent.add(mesh); parent.updateMatrixWorld(true); mesh.bind(skeleton); source.geometry.dispose(); return mesh;
}
const spineRig = (() => {
  const root = bone(joints.torso, 'pelvisSpine', [0, 0, 0]);
  const mid = bone(root, 'midSpine', [0, .48, 0]);
  const chest = bone(mid, 'upperSpine', [0, .55, 0]);
  joints.torso.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([root, mid, chest]); skeleton.calculateInverses();
  function skinTorso(name) {
    const source = scene.getObjectByName(name); if (!source) return null;
    scene.updateMatrixWorld(true); joints.torso.updateMatrixWorld(true);
    const geometry = source.geometry.clone();
    geometry.applyMatrix4(source.matrixWorld);
    geometry.applyMatrix4(joints.torso.matrixWorld.clone().invert());
    const pos = geometry.attributes.position, indices = new Uint16Array(pos.count * 4), weights = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), k = i * 4;
      if (y < .48) {
        const t = THREE.MathUtils.clamp(y / .48, 0, 1); indices[k] = 0; indices[k + 1] = 1; weights[k] = 1 - t; weights[k + 1] = t;
      } else if (y < 1.03) {
        const t = THREE.MathUtils.clamp((y - .48) / .55, 0, 1); indices[k] = 1; indices[k + 1] = 2; weights[k] = 1 - t; weights[k + 1] = t;
      } else { indices[k] = 2; weights[k] = 1; }
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(geometry, source.material); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    source.parent.remove(source); joints.torso.add(mesh); joints.torso.updateMatrixWorld(true); mesh.bind(skeleton); source.geometry.dispose(); return mesh;
  }
  for (const name of feminine ? [] : ['body', 'shirtFront', 'shirtBack', 'seam']) {
    const mesh = skinTorso(name);
    if (mesh && (name === 'shirtFront' || name === 'shirtBack')) surfaces.set(name, mesh);
  }
  return { root, mid, chest, skeleton };
})();
if (collar) spineRig.chest.attach(collar);
if (feminine) {
}
const armRigs = {};
for (const [side, sign, group] of [['left', -1, joints.leftArm], ['right', 1, joints.rightArm]]) {
  const root = bone(group, `${side}ArmRoot`, [0, 0, 0]);
  const elbow = bone(root, `${side}Elbow`, [sign * .30, -.55, 0]);
  const wrist = bone(elbow, `${side}Wrist`, [sign * .18, -.64, 0]);
  group.updateMatrixWorld(true);
  if (feminine) elbow.attach(ellipsoid(`${side}ElbowCap`, [sign * .66, 2.02, 0], [.105, .12, .115]));
  const skeleton = new THREE.Skeleton([root, elbow, wrist]); skeleton.calculateInverses();
  if (feminine) {
    const upper = capsuleBetween(`${side}UpperArmSkin`, [sign * .36, 2.57, 0], [sign * .66, 2.02, 0], .125);
    root.attach(upper);
    const lower = capsuleBetween(`${side}LowerArmSkin`, [sign * .66, 2.02, 0], [sign * .84, 1.38, 0], .095);
    elbow.attach(lower);
  } else {
    const sleeve = skinnedCopy(scene.getObjectByName(`${side}Sleeve`), group, skeleton, 1, -.55);
    surfaces.set(`${side}Sleeve`, sleeve);
    skinnedCopy(scene.getObjectByName(`${side}SleeveArm`), group, skeleton, 1, -.55);
  }
  const hand = scene.getObjectByName(`${side}SleeveHand`); if (hand) wrist.attach(hand);
  armRigs[side] = { root, elbow, wrist, upperLength: Math.hypot(.30, .55), lowerLength: Math.hypot(.18, .64), upperBase: Math.atan2(-.55, sign * .30), lowerBase: Math.atan2(-.64, sign * .18) };
}
const legRigs = {};
for (const [side, group] of [['left', joints.leftLeg], ['right', joints.rightLeg]]) {
  const root = bone(group, `${side}LegRoot`, [0, 0, 0]);
  const thighLength = feminine ? .84 : .76, calfLength = feminine ? .67 : .60;
  const knee = bone(root, `${side}Knee`, [0, -thighLength, 0]);
  const ankle = bone(knee, `${side}Ankle`, [0, -calfLength, 0]);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([root, knee, ankle]); skeleton.calculateInverses();
  if (feminine) {
    const cx = side === 'left' ? -.27 : .27;
    const calf = capsuleBetween(`${side}CalfSkin`, [cx, .76, 0], [cx, .09, 0], .14);
    knee.attach(calf);
    const kneecap = ellipsoid(`${side}Kneecap`, [cx, .76, .12], [.145, .145, .12]);
    knee.attach(kneecap);
  } else {
    for (const panel of ['LegFront', 'LegBack']) surfaces.set(`${side}${panel}`, skinnedCopy(scene.getObjectByName(`${side}${panel}`), group, skeleton, 1, -.86));
    skinnedCopy(scene.getObjectByName(`${side}leg`), group, skeleton, 1, -.76);
  }
  const foot = scene.getObjectByName(`${side}foot`); if (foot) ankle.attach(foot);
  legRigs[side] = { root, knee, ankle, upperLength: thighLength, lowerLength: calfLength, upperBase: -Math.PI / 2, lowerBase: -Math.PI / 2 };
}
spineRig.root.attach(joints.leftLeg); spineRig.root.attach(joints.rightLeg);
spineRig.chest.attach(joints.leftArm); spineRig.chest.attach(joints.rightArm); spineRig.chest.attach(joints.neck);
function createUnifiedBodysuit() {
  const rows = feminineTorsoRows.filter(row => row.y <= 2.90);
  if (!rows.length) return;
  const smoothUnion = (a, b, k) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * .25;
  };
  const smoothMax = (a, b, k) => -smoothUnion(-a, -b, k);
  const ellipsoidDistance = (x, y, z, cx, cy, cz, rx, ry, rz) => {
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const k0 = Math.hypot(dx / rx, dy / ry, dz / rz);
    const k1 = Math.hypot(dx / (rx * rx), dy / (ry * ry), dz / (rz * rz));
    return k1 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
  };
  const capsuleDistance = (x, y, z, ax, ay, az, bx, by, bz, ra, rb) => {
    const vx = bx - ax, vy = by - ay, vz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * vx + (y - ay) * vy + (z - az) * vz) / (vx * vx + vy * vy + vz * vz), 0, 1);
    return Math.hypot(x - ax - vx * t, y - ay - vy * t, z - az - vz * t) - THREE.MathUtils.lerp(ra, rb, t);
  };
  const torsoDistance = (x, y, z) => {
    let a = rows[0], b = rows.at(-1);
    if (y <= a.y) b = a;
    else if (y >= b.y) a = b;
    else for (let i = 0; i < rows.length - 1; i++) if (y >= rows[i].y && y <= rows[i + 1].y) { a = rows[i]; b = rows[i + 1]; break; }
    const t = a === b ? 0 : (y - a.y) / (b.y - a.y);
    const rx = THREE.MathUtils.lerp(a.rx, b.rx, t), rz = THREE.MathUtils.lerp(a.rz, b.rz, t);
    const radial = (Math.hypot(x / rx, z / rz) - 1) * Math.min(rx, rz);
    const vertical = Math.max(rows[0].y - y, y - rows.at(-1).y);
    return Math.hypot(Math.max(radial, 0), Math.max(vertical, 0)) + Math.min(Math.max(radial, vertical), 0);
  };
  const field = (x, y, z) => {
    let d = torsoDistance(x, y, z);
    // Sculpt the bust and seat into the garment surface itself so no body
    // spheres poke through a second, mismatched shell.
    for (const sign of [-1, 1]) {
      d = smoothUnion(d, ellipsoidDistance(x, y, z, sign * .15, 2.18, .19, .215, .195, .155), .055);
      d = smoothUnion(d, ellipsoidDistance(x, y, z, sign * .20, 1.36, -.17, .30, .27, .23), .04);
      // The lower capsule endpoint is raised by one radius so its rounded hem
      // lands at the requested mid-thigh height instead of extending to the knee.
      d = smoothUnion(d, capsuleDistance(x, y, z, sign * .27, 1.46, 0, sign * .27, 1.08, 0, .245, .24), .14);
    }
    // A thin open slit separates the thighs below the crotch, so no cloth bridges the two legs
    // and each thigh can swing on its own without stretching a web between them. The slit is cut in
    // the x/y plane only (z is ignored), so it goes all the way from the front to the back of the body.
    const thighCrease = capsuleDistance(x, y, 0, 0, 1.27, 0, 0, .70, 0, .03, .03);
    d = smoothMax(d, -thighCrease, .012);
    // Soft V-shaped crease where the belly meets each thigh.
    for (const sign of [-1, 1]) d = smoothMax(d, -capsuleDistance(x, y, z, sign * .42, 1.62, .30, sign * .03, 1.30, .29, .05, .05), .035);
    return d - .012;
  };

  const min = [-.88, .68, -.78], max = [.88, 2.92, .78], step = .03;
  const nx = Math.ceil((max[0] - min[0]) / step), ny = Math.ceil((max[1] - min[1]) / step), nz = Math.ceil((max[2] - min[2]) / step);
  const dx = (max[0] - min[0]) / nx, dy = (max[1] - min[1]) / ny, dz = (max[2] - min[2]) / nz;
  const sx = nx + 1, sy = ny + 1, count = sx * sy * (nz + 1), samples = new Float32Array(count), coords = new Float32Array(count * 3);
  const gridId = (i, j, k) => i + sx * (j + sy * k);
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const id = gridId(i, j, k), x = min[0] + i * dx, y = min[1] + j * dy, z = min[2] + k * dz;
    coords[id * 3] = x; coords[id * 3 + 1] = y; coords[id * 3 + 2] = z; samples[id] = field(x, y, z);
  }
  const positions = [], indices = [], edgeVertices = new Map();
  const edgeVertex = (idA, idB) => {
    const lo = Math.min(idA, idB), hi = Math.max(idA, idB), key = lo * count + hi;
    if (edgeVertices.has(key)) return edgeVertices.get(key);
    const va = samples[idA], vb = samples[idB], t = va / (va - vb), n = positions.length / 3;
    positions.push(
      THREE.MathUtils.lerp(coords[idA * 3], coords[idB * 3], t),
      THREE.MathUtils.lerp(coords[idA * 3 + 1], coords[idB * 3 + 1], t),
      THREE.MathUtils.lerp(coords[idA * 3 + 2], coords[idB * 3 + 2], t)
    );
    edgeVertices.set(key, n); return n;
  };
  const tets = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
  const emitTriangle = (a, b, c, inside, outside) => {
    const centroid = ids => {
      const v = new THREE.Vector3();
      ids.forEach(id => v.add(new THREE.Vector3(coords[id*3], coords[id*3+1], coords[id*3+2])));
      return v.multiplyScalar(1 / ids.length);
    };
    const outward = centroid(outside).sub(centroid(inside));
    const pa = new THREE.Vector3(positions[a*3], positions[a*3+1], positions[a*3+2]);
    const pb = new THREE.Vector3(positions[b*3], positions[b*3+1], positions[b*3+2]);
    const pc = new THREE.Vector3(positions[c*3], positions[c*3+1], positions[c*3+2]);
    if (pb.sub(pa).cross(pc.sub(pa)).dot(outward) < 0) [b, c] = [c, b];
    indices.push(a, b, c);
  };
  const emitTet = tet => {
    const inside = tet.filter(id => samples[id] < 0), outside = tet.filter(id => samples[id] >= 0);
    if (!inside.length || !outside.length) return;
    if (inside.length === 1) {
      emitTriangle(edgeVertex(inside[0], outside[0]), edgeVertex(inside[0], outside[1]), edgeVertex(inside[0], outside[2]), inside, outside);
    } else if (inside.length === 3) {
      emitTriangle(edgeVertex(outside[0], inside[0]), edgeVertex(outside[0], inside[1]), edgeVertex(outside[0], inside[2]), inside, outside);
    } else {
      const ac = edgeVertex(inside[0], outside[0]), ad = edgeVertex(inside[0], outside[1]);
      const bc = edgeVertex(inside[1], outside[0]), bd = edgeVertex(inside[1], outside[1]);
      emitTriangle(ac, ad, bc, inside, outside); emitTriangle(ad, bd, bc, inside, outside);
    }
  };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = [gridId(i,j,k), gridId(i+1,j,k), gridId(i+1,j+1,k), gridId(i,j+1,k), gridId(i,j,k+1), gridId(i+1,j,k+1), gridId(i+1,j+1,k+1), gridId(i,j+1,k+1)];
    if (Math.min(...c.map(id => samples[id])) > 0 || Math.max(...c.map(id => samples[id])) < 0) continue;
    for (const tet of tets) emitTet(tet.map(i => c[i]));
  }
  const vertexCount = positions.length / 3, skinIndices = new Uint16Array(vertexCount * 4), skinWeights = new Float32Array(vertexCount * 4);
  const smoothstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const bones = [spineRig.root, spineRig.mid, spineRig.chest, legRigs.left.root, legRigs.left.knee, legRigs.left.ankle, legRigs.right.root, legRigs.right.knee, legRigs.right.ankle];
  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1];
    let influences = [];
    if (y >= 1.68) {
      const localY = y - 1.36;
      if (localY < .48) influences = [[0, 1 - localY / .48], [1, localY / .48]];
      else if (localY < 1.03) influences = [[1, 1 - (localY - .48) / .55], [2, (localY - .48) / .55]];
      else influences = [[2, 1]];
    } else {
      // Everything below the crotch belongs to exactly one leg, so the whole thigh follows it.
      // The fade into the pelvis depends on height only; a sideways cut-off would stretch a web of
      // cloth between the legs whenever they swing differently.
      const legBlend = 1 - smoothstep(1.38, 1.80, y);
      // Left/right split: a hard split per leg low down, easing to an even share toward the crotch.
      // The crotch is the one place the legs stay joined, so a gradual change spreads the stretch into a
      // soft fold instead of a thin fan when one leg swings further than the other.
      const crotchEase = smoothstep(1.08, 1.34, y) * (1 - smoothstep(0, .16, Math.abs(x)));
      const hipBlend = legBlend, leftShare = THREE.MathUtils.lerp(THREE.MathUtils.clamp(.5 - x / .04, 0, 1), .5, crotchEase), rightShare = 1 - leftShare;
      const torsoShare = 1 - hipBlend;
      const localY = THREE.MathUtils.clamp(y - 1.36, 0, .48), rootShare = 1 - localY / .48, midShare = localY / .48;
      influences = [[0, torsoShare * rootShare], [1, torsoShare * midShare], [3, hipBlend * leftShare], [6, hipBlend * rightShare]];
    }
    influences = influences.filter(([,w]) => w > .001).sort((a,b) => b[1]-a[1]).slice(0,4);
    const total = influences.reduce((sum, [,w]) => sum + w, 0) || 1;
    influences.forEach(([boneIndex, weight], n) => { skinIndices[i * 4 + n] = boneIndex; skinWeights[i * 4 + n] = weight / total; });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  // The body stays gold, except the shoulders and upper chest that show above the dress neckline: they take the skin tone.
  const gold = new THREE.Color('#c99549'), skinTone = new THREE.Color('#c7a88b'), colors = new Float32Array(vertexCount * 3), tint = new THREE.Color();
  for (let i = 0; i < vertexCount; i++) {
    tint.copy(gold).lerp(skinTone, smoothstep(2.48, 2.60, positions[i * 3 + 1]));
    colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const suitSkeleton = new THREE.Skeleton(bones); scene.updateMatrixWorld(true); suitSkeleton.calculateInverses();
  const suit = new THREE.SkinnedMesh(geometry, bodySuitMaterial); suit.name = 'womanBodysuit'; suit.castShadow = true; suit.receiveShadow = true; suit.frustumCulled = false; scene.add(suit); scene.updateMatrixWorld(true); suit.bind(suitSkeleton);
}
if (feminine) createUnifiedBodysuit();

// A plain, empty dress shape for the woman: fitted off-shoulder column dress to mid-calf with balloon
// sleeves. It has no pattern or colour of its own and is not a selectable textile panel.
let womanDress = null;
function createFemaleDress() {
  const dressMaterial = new THREE.MeshStandardMaterial({ color: '#e7e4de', roughness: .92, side: THREE.DoubleSide });
  const smoothstep = (a, b, x) => { const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // Outline knots, top to bottom: y, half-width, front depth, back depth.
  const knots = [
    [2.72, .27, .185, .185], [2.63, .42, .235, .235], [2.55, .47, .26, .26],
    [2.46, .485, .285, .285], [2.32, .46, .38, .295], [2.20, .445, .40, .30], [2.10, .43, .39, .30],
    [2.00, .395, .33, .29], [1.90, .37, .28, .28], [1.80, .365, .275, .275], [1.70, .45, .28, .28],
    [1.60, .535, .29, .365], [1.50, .575, .305, .42], [1.40, .59, .315, .44], [1.30, .575, .305, .44],
    [1.20, .56, .295, .415], [1.10, .55, .285, .35], [1.00, .545, .28, .29], [.90, .525, .285, .26],
    [.76, .50, .29, .25], [.60, .47, .275, .23], [.45, .445, .255, .21]
  ];
  const cr = (k, t, c) => { // Catmull-Rom through knot column c at fractional index t
    const i = Math.min(k.length - 2, Math.floor(t)), f = t - i;
    const p0 = k[Math.max(0, i - 1)][c], p1 = k[i][c], p2 = k[i + 1][c], p3 = k[Math.min(k.length - 1, i + 2)][c];
    return .5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  };
  const rows = [], rowCount = 90, segments = 24;
  for (let r = 0; r < rowCount; r++) {
    const t = r / (rowCount - 1) * (knots.length - 1), i = Math.min(knots.length - 2, Math.floor(t)), f = t - i;
    rows.push({ y: THREE.MathUtils.lerp(knots[i][0], knots[i + 1][0], f), rx: cr(knots, t, 1), rzF: cr(knots, t, 2), rzB: cr(knots, t, 3) });
  }
  const bones = [spineRig.root, spineRig.mid, spineRig.chest, legRigs.left.root, legRigs.left.knee, legRigs.left.ankle, legRigs.right.root, legRigs.right.knee, legRigs.right.ankle];
  const skeleton = new THREE.Skeleton(bones); scene.updateMatrixWorld(true); skeleton.calculateInverses();
  const minY = rows.at(-1).y, height = rows[0].y - minY;
  // The body of the dress is two fabric panels, front and back, joined at the side seams. Each panel gets
  // its own fabric, mapped once across it like the man's shirt panels.
  const bodyPanel = (panel, a0, a1) => {
    const positions = [], uvs = [], indices = [], skinIndices = [], skinWeights = [];
    rows.forEach((row, j) => {
      const ring = [];
      for (let s = 0; s <= segments; s++) {
        const a = a0 + (a1 - a0) * s / segments, c = Math.cos(a);
        let y = row.y;
        // Slightly squared ring (superellipse) so the flat fronts of the thighs and the bust stay inside the cloth.
        const sn = Math.sin(a), squarish = (Math.abs(sn) ** 2.5 + Math.abs(c) ** 2.5) ** (-1 / 2.5);
        const x = row.rx * sn * squarish, z = (c >= 0 ? row.rzF : row.rzB) * c * squarish;
        // Wide round neckline: the front edge dips below the collarbone, the back stays higher.
        y -= smoothstep(2.60, 2.72, row.y) * .07 * Math.max(c, 0) ** 3;
        positions.push(x, y, z); ring.push([x, z]);
        let inf;
        if (y >= 1.68) {
          const localY = y - 1.36;
          inf = localY < .48 ? [[0, 1 - localY / .48], [1, localY / .48]] : localY < 1.03 ? [[1, 1 - (localY - .48) / .55], [2, (localY - .48) / .55]] : [[2, 1]];
        } else {
          // Below the waist the skirt is one column that follows both legs equally, with a gentle bias
          // toward the nearer leg at the hip. Separate leg weights would tear a tight skirt apart.
          const torsoShare = smoothstep(1.38, 1.80, y), legShare = 1 - torsoShare;
          const bias = smoothstep(.95, 1.4, y), left = .5 + (THREE.MathUtils.clamp(.5 - x / .5, 0, 1) - .5) * .75 * bias, right = 1 - left;
          const hipW = smoothstep(.62, .90, y), kneeW = 1 - hipW;
          const localY = THREE.MathUtils.clamp(y - 1.36, 0, .48), rootShare = 1 - localY / .48;
          inf = [[0, torsoShare * rootShare], [1, torsoShare * (1 - rootShare)],
            [3, legShare * hipW * left], [6, legShare * hipW * right], [4, legShare * kneeW * left], [7, legShare * kneeW * right]];
        }
        inf = inf.filter(([, w]) => w > .001).sort((p, q) => q[1] - p[1]).slice(0, 4);
        const total = inf.reduce((sum, [, w]) => sum + w, 0) || 1;
        for (let n = 0; n < 4; n++) { skinIndices.push(inf[n] ? inf[n][0] : 0); skinWeights.push(inf[n] ? inf[n][1] / total : 0); }
        if (j < rows.length - 1 && s < segments) {
          const n = j * (segments + 1) + s, below = n + segments + 1;
          indices.push(n, below, n + 1, n + 1, below, below + 1);
        }
      }
      // Fabric runs evenly along the cloth of each row, from one side seam to the other.
      const lengths = [0]; for (let s = 1; s <= segments; s++) lengths.push(lengths[s - 1] + Math.hypot(ring[s][0] - ring[s - 1][0], ring[s][1] - ring[s - 1][1]));
      for (let s = 0; s <= segments; s++) uvs.push(lengths[s] / (lengths[segments] || 1), 1 - (row.y - minY) / height);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.SkinnedMesh(geometry, dressMaterial.clone()); mesh.name = panel; mesh.userData.panel = panel; mesh.userData.baseMaterial = dressMaterial;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    scene.add(mesh); scene.updateMatrixWorld(true); mesh.bind(skeleton); surfaces.set(panel, mesh);
    return mesh;
  };
  const parts = [bodyPanel('dressFront', -Math.PI / 2, Math.PI / 2), bodyPanel('dressBack', Math.PI / 2, Math.PI * 1.5)];
  // Balloon sleeves: full and soft over the upper arm and forearm, gathered at the wrist.
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const curve = new THREE.CatmullRomCurve3([[.22, 2.60, 0], [.40, 2.55, 0], [.54, 2.28, 0], [.66, 2.02, 0], [.76, 1.70, 0], [.83, 1.47, 0], [.845, 1.36, 0]].map(([x, y, z]) => new THREE.Vector3(sign * x, y, z)));
    const geo = taperedTube(curve, 28, 24, [.12, .175, .19, .21, .20, .14, .11], 0);
    const pos = geo.attributes.position, idx = new Uint16Array(pos.count * 4), wts = new Float32Array(pos.count * 4);
    const rig = armRigs[side];
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v), k = v * 4;
      // bones: 0 chest, 1 shoulder, 2 elbow
      const top = 1 - smoothstep(2.30, 2.52, y), toElbow = smoothstep(2.20, 1.86, y);
      const chest = (1 - top) * .6, shoulder = top * (1 - toElbow) + (1 - top) * .4 * (1 - toElbow), elbow = toElbow;
      const parts3 = [[0, chest], [1, Math.max(0, shoulder)], [2, elbow]];
      const total = parts3.reduce((sum, [, w]) => sum + w, 0) || 1;
      parts3.forEach(([b, w], n) => { idx[k + n] = b; wts[k + n] = w / total; });
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
    const panel = side === 'left' ? 'dressLeftSleeve' : 'dressRightSleeve';
    const sleeve = new THREE.SkinnedMesh(geo, dressMaterial.clone()); sleeve.name = panel; sleeve.userData.panel = panel; sleeve.userData.baseMaterial = dressMaterial; sleeve.castShadow = true; sleeve.receiveShadow = true; sleeve.frustumCulled = false;
    scene.add(sleeve); scene.updateMatrixWorld(true);
    const sk = new THREE.Skeleton([spineRig.chest, rig.root, rig.elbow]); sk.calculateInverses(); sleeve.bind(sk);
    surfaces.set(panel, sleeve); parts.push(sleeve);
  }
  womanDress = parts;
}
if (feminine) createFemaleDress();

// Nigerian gele (headtie), built from one long strip of cloth folded in accordion pleats:
//  - the first pleats lie flat on the head, from the hairline back over the skull,
//  - the next pleats rise one by one and spread outward into a fan around the head,
//  - behind the fan a small bunched cloth cap covers the back of the head.
// Every pleat is its own band with its own slice of the strip (folds alternate direction), so a fabric
// pattern breaks from pleat to pleat like a real gele instead of running over it as one picture.
function createHeadtie() {
  const geleMaterial = new THREE.MeshStandardMaterial({ color: '#e3b021', roughness: .86, side: THREE.DoubleSide });
  const positions = [], uvs = [], indices = [], tile = .45, lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
  const grid = (rows, cols, at) => { // at(r, c) -> [x, y, z, u, v]
    const base = positions.length / 3;
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
      const [x, y, z, u, v] = at(r / rows, c / cols); positions.push(x, y, z); uvs.push(u / tile, v / tile);
      if (r < rows && c < cols) { const n = base + r * (cols + 1) + c, m = n + cols + 1; indices.push(n, m, n + 1, n + 1, m, m + 1); }
    }
  };
  // Pleat rings around the face axis: radius, depth (z), how far the ring is lifted, how far down the sides it
  // reaches (degrees from the top), and how much each fold stands out.
  const rings = [
    [.24, .14, .08, 150, .007], [.27, .10, .08, 150, .007], [.29, .05, .08, 150, .007], [.30, 0, .08, 150, .007], [.30, -.05, .08, 150, .008],
    [.35, -.08, .10, 150, .016], [.40, -.10, .12, 150, .018], [.45, -.115, .14, 150, .018], [.49, -.13, .16, 150, .018],
    [.53, -.14, .18, 150, .018], [.56, -.15, .20, 150, .018], [.585, -.16, .215, 150, .018], [.60, -.17, .23, 150, .018], [.61, -.18, .24, 150, .016]
  ];
  const cy = 3.17, tall = 1.10, ringAt = t => { // t runs over the rings; fractional values blend neighbours
    const i = clamp(Math.floor(t), 0, rings.length - 2), f = t - i, a = rings[i], b = rings[i + 1];
    return [0, 1, 2, 3, 4].map(k => lerp(a[k], b[k], f));
  };
  // Where a pleat ring passes at a point along it (c from one end, 0, to the other, 1). Both ends of every pleat
  // run back down behind the ears and meet at the back of the head, by the nape.
  const ringPoint = (R, z, lift, sweep, c) => {
    const psi = -sweep + 2 * sweep * c, e = THREE.MathUtils.smoothstep(Math.abs(psi) / sweep, .4, 1), tuck = e * e;
    let x = lerp(R * Math.sin(psi), Math.sign(psi) * .03, tuck), y = lerp(cy + lift + R * tall * Math.cos(psi), 2.99, tuck), zz = lerp(z, -.22, e);
    // Keep the cloth just outside the head while it travels round to the back.
    const k = Math.hypot(x / .275, (y - 3.23) / .345, zz / .265);
    if (k < 1) { x /= k; y = 3.23 + (y - 3.23) / k; zz /= k; }
    return [x, y, zz];
  };
  let stripV = 0;
  for (let p = 0; p < rings.length - 1; p++) {
    const width = Math.hypot(rings[p + 1][0] - rings[p][0], rings[p + 1][1] - rings[p][1]);
    grid(7, 84, (t, c) => {
      // Each pleat reaches a little under its neighbours so no gaps open between the folds.
      const s = -.12 + 1.24 * t, [R0, z0, lift, sweepDeg, ridge] = ringAt(p + s);
      const dR = rings[p + 1][0] - rings[p][0], dz = rings[p + 1][1] - rings[p][1], l = Math.hypot(dR, dz) || 1;
      const bulge = ridge * Math.sin(Math.PI * s), R = R0 + bulge * -dz / l, z = z0 + bulge * dR / l;
      const sweep = THREE.MathUtils.degToRad(sweepDeg), fold = p % 2 ? 1 - clamp(s, 0, 1) : clamp(s, 0, 1);
      return [...ringPoint(R, z, lift, sweep, c), R * 1.05 * 2 * sweep * c, stripV + fold * width];
    });
    stripV += width;
  }
  // Small puffed cloth cap at the back of the head. Its edge sits on the head, where the last flat pleat ends,
  // runs round behind the fan, and gathers to a point on top of the knot where the pleat ends meet.
  const [capR, capZ, capLift, capSweep] = ringAt(4.85), capPole = [0, 3.012, -.218];
  grid(14, 96, (t, c) => {
    const rim = ringPoint(capR, capZ, capLift, THREE.MathUtils.degToRad(capSweep), c);
    let [x, y, z] = [0, 1, 2].map(k => lerp(capPole[k], rim[k], t));
    const k = Math.hypot(x / .275, (y - 3.23) / .345, z / .265);
    if (k < 1) { x /= k; y = 3.23 + (y - 3.23) / k; z /= k; }
    // Puff it out from the head, fullest in the middle and toward the top, as if hair is gathered underneath.
    const crumple = 1 + .25 * Math.sin(11 * c * Math.PI + 3 * t) * Math.sin(Math.PI * t);
    const puff = .07 * Math.sin(Math.PI * t) ** .9 * (.35 + .65 * Math.sin(Math.PI * c)) * crumple;
    const dy = y - 3.23, dl = Math.hypot(x, dy, z) || 1;
    return [x + puff * x / dl, y + puff * dy / dl, z + puff * z / dl, c * 2.4 + 3, stripV + .2 + t * .5];
  });
  // The pleat ends are gathered into a small flat rectangular knot at the nape, below the cap. It sits right
  // where the pleats meet, so the pleat ends run into it.
  const knot = [0, 2.99, -.214], size = [.058, .017, .009], sq = v => Math.sign(v) * Math.abs(v) ** .3;
  grid(14, 40, (t, c) => {
    // Rounded box: a sphere pushed out toward its corners, with a soft fold across the middle.
    const ph = t * Math.PI, a = c * Math.PI * 2;
    const nx = sq(Math.sin(ph) * Math.cos(a)), ny = sq(Math.cos(ph)), nz = sq(Math.sin(ph) * Math.sin(a));
    const fold = 1 - .15 * Math.exp(-((nx / .2) ** 2));
    return [knot[0] + size[0] * nx, knot[1] + size[1] * ny * fold, knot[2] - size[2] * nz * fold, c * .3 + 5, stripV + .9 + t * .1];
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const gele = new THREE.Mesh(geometry, geleMaterial); gele.name = 'headtie'; gele.userData.panel = 'headtie';
  gele.userData.baseMaterial = geleMaterial; gele.userData.repeatTexture = true; gele.castShadow = true; gele.receiveShadow = true;
  scene.add(gele); scene.updateMatrixWorld(true); joints.head.attach(gele); surfaces.set('headtie', gele);
}
if (feminine) createHeadtie();

// Second outfit for the woman: a sleeveless top with a high round neck, tucked into high-waisted wide-leg
// trousers that fall to the floor. Plain and empty like the dress; every piece is its own fabric panel.
let womanShirtTrousers = [], womanOutfit = 'shirtTrousers';
const womanPieces = { jacket: 'wide', shirt: 'sleeveless', trousers: 'wide' };
function showWomanPieces() {
  const on = womanOutfit !== 'dress';
  for (const part of womanShirtTrousers) {
    const [kind, variant] = (part.userData.piece || '').split(':');
    const chosen = womanPieces[kind];
    part.visible = on && (variant ? chosen === variant : kind !== 'jacket' || chosen !== 'none');
  }
}
function createShirtTrousers() {
  const material = new THREE.MeshStandardMaterial({ color: '#e7e4de', roughness: .92, side: THREE.DoubleSide });
  const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const cr = (k, t, c) => { // Catmull-Rom through knot column c at fractional index t
    const i = Math.min(k.length - 2, Math.floor(t)), f = t - i;
    const p0 = k[Math.max(0, i - 1)][c], p1 = k[i][c], p2 = k[i + 1][c], p3 = k[Math.min(k.length - 1, i + 2)][c];
    return .5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
  };
  const sample = (knots, count) => Array.from({ length: count }, (_, r) => {
    const t = r / (count - 1) * (knots.length - 1), i = Math.min(knots.length - 2, Math.floor(t)), f = t - i;
    return [lerp(knots[i][0], knots[i + 1][0], f), ...knots[0].slice(1).map((_, c) => cr(knots, t, c + 1))];
  });
  const bones = [spineRig.root, spineRig.mid, spineRig.chest, legRigs.left.root, legRigs.left.knee, legRigs.left.ankle, legRigs.right.root, legRigs.right.knee, legRigs.right.ankle];
  const skeleton = new THREE.Skeleton(bones); scene.updateMatrixWorld(true); skeleton.calculateInverses();
  const spine = y => { const localY = y - 1.36; return localY < .48 ? [[0, 1 - localY / .48], [1, localY / .48]] : localY < 1.03 ? [[1, 1 - (localY - .48) / .55], [2, (localY - .48) / .55]] : [[2, 1]]; };
  const squarish = (sn, c) => (Math.abs(sn) ** 2.5 + Math.abs(c) ** 2.5) ** (-1 / 2.5);
  // Builds one skinned panel from rows of [x, y, z] points with matching weights.
  const panel = (name, rows, weightsAt, breakAfter = -1) => {
    const positions = [], uvs = [], indices = [], skinIndices = [], skinWeights = [], cols = rows[0].length;
    const ys = rows.map(r => r[0][1]), minY = Math.min(...ys), height = Math.max(...ys) - minY || 1;
    rows.forEach((row, j) => {
      const lengths = [0]; for (let s = 1; s < cols; s++) lengths.push(lengths[s - 1] + Math.hypot(row[s][0] - row[s - 1][0], row[s][2] - row[s - 1][2]));
      row.forEach(([x, y, z], s) => {
        positions.push(x, y, z); uvs.push(lengths[s] / (lengths[cols - 1] || 1), 1 - (ys[j] - minY) / height);
        let inf = weightsAt(x, y).filter(([, w]) => w > .001).sort((p, q) => q[1] - p[1]).slice(0, 4);
        const total = inf.reduce((sum, [, w]) => sum + w, 0) || 1;
        for (let n = 0; n < 4; n++) { skinIndices.push(inf[n] ? inf[n][0] : 0); skinWeights.push(inf[n] ? inf[n][1] / total : 0); }
        if (j < rows.length - 1 && s < cols - 1 && s !== breakAfter) { const n = j * cols + s, below = n + cols; indices.push(n, below, n + 1, n + 1, below, below + 1); }
      });
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.SkinnedMesh(geometry, material.clone()); mesh.name = name; mesh.userData.panel = name; mesh.userData.baseMaterial = material;
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh); scene.updateMatrixWorld(true); mesh.bind(skeleton); surfaces.set(name, mesh); womanShirtTrousers.push(mesh);
    return mesh;
  };
  // Sleeveless top: y, half-width, front depth, back depth. It ends tucked inside the trouser waistband.
  const topRows = sample([
    [2.80, .15, .135, .135], [2.74, .22, .165, .165], [2.66, .33, .20, .20], [2.56, .44, .25, .25],
    [2.46, .485, .285, .285], [2.32, .46, .38, .295], [2.20, .445, .40, .30], [2.10, .43, .39, .30],
    [2.00, .395, .33, .29], [1.90, .37, .28, .28], [1.80, .365, .275, .275], [1.74, .37, .275, .275]
  ], 70);
  const topPanel = (name, a0, a1) => panel(name, topRows.map(([y, rx, rzF, rzB]) => Array.from({ length: 25 }, (_, s) => {
    const a = a0 + (a1 - a0) * s / 24, sn = Math.sin(a), c = Math.cos(a), q = squarish(sn, c);
    return [rx * sn * q, y, (c >= 0 ? rzF : rzB) * c * q];
  })), (x, y) => spine(y));
  topPanel('womanTopFront', -Math.PI / 2, Math.PI / 2).userData.piece = 'shirt';
  topPanel('womanTopBack', Math.PI / 2, Math.PI * 1.5).userData.piece = 'shirt';
  // Sleeves for every piece: a soft tube along the arm, skinned to chest, shoulder and elbow. `elbowShare(y)` says
  // how much of the sleeve at each height follows the forearm.
  const sleevePanel = (name, side, points, radii, elbowShare, piece) => {
    const sign = side === 'left' ? -1 : 1, rig = armRigs[side];
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(sign * x, y, 0)));
    const geo = taperedTube(curve, 40, 28, radii, 0);
    const pos = geo.attributes.position, idx = new Uint16Array(pos.count * 4), wts = new Float32Array(pos.count * 4);
    for (let v = 0; v < pos.count; v++) {
      // bones: 0 chest, 1 shoulder, 2 elbow
      const y = pos.getY(v), k = v * 4, top = 1 - smoothstep(2.30, 2.55, y), toElbow = elbowShare(y);
      const w = [[0, (1 - top) * .6], [1, Math.max(0, (top + (1 - top) * .4) * (1 - toElbow))], [2, toElbow]];
      const total = w.reduce((sum, [, x]) => sum + x, 0) || 1;
      w.forEach(([b, x], n) => { idx[k + n] = b; wts[k + n] = x / total; });
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
    const sleeve = new THREE.SkinnedMesh(geo, material.clone()); sleeve.name = name; sleeve.userData.panel = name; sleeve.userData.baseMaterial = material; sleeve.userData.piece = piece;
    sleeve.castShadow = true; sleeve.receiveShadow = true; sleeve.frustumCulled = false; sleeve.visible = false;
    scene.add(sleeve); scene.updateMatrixWorld(true);
    const sk = new THREE.Skeleton([spineRig.chest, rig.root, rig.elbow]); sk.calculateInverses(); sleeve.bind(sk);
    surfaces.set(name, sleeve); womanShirtTrousers.push(sleeve);
    return sleeve;
  };
  const forearm = y => smoothstep(2.15, 1.90, y);
  for (const side of ['left', 'right']) {
    const Side = side[0].toUpperCase() + side.slice(1);
    // Short fitted sleeve to halfway down the upper arm.
    sleevePanel(`womanTop${Side}ShortSleeve`, side, [[.22, 2.62], [.40, 2.54], [.50, 2.36], [.555, 2.23]], [.10, .152, .148, .145], () => 0, 'shirt:short');
    // Long fitted sleeve to the wrist.
    sleevePanel(`womanTop${Side}LongSleeve`, side, [[.22, 2.62], [.40, 2.54], [.53, 2.30], [.66, 2.02], [.76, 1.70], [.83, 1.46], [.845, 1.37]],
      [.10, .152, .148, .135, .122, .112, .108], forearm, 'shirt:long');
  }
  // Open cropped jacket worn over the top, like a kimono jacket: no collar, fronts hanging straight down with
  // a gap in the middle, ending at the waist, with wide elbow-length sleeves. Left front, right front, back
  // and both sleeves are separate fabric panels.
  const jacketRows = sample([
    [2.71, .28, .192, .192], [2.63, .385, .228, .228], [2.55, .46, .268, .268], [2.46, .50, .30, .30],
    [2.32, .505, .425, .335], [2.20, .49, .445, .34], [2.10, .475, .435, .34], [2.00, .445, .385, .33],
    [1.90, .425, .345, .325], [1.80, .42, .335, .325], [1.72, .425, .335, .325]
  ], 64);
  const edge = .15; // half the gap between the two fronts
  const jacketPanel = (name, from, to) => panel(name, jacketRows.map(([y, rx, rzF, rzB]) => Array.from({ length: 25 }, (_, s) => {
    const a = from(rx) + (to(rx) - from(rx)) * s / 24, sn = Math.sin(a), c = Math.cos(a), q = squarish(sn, c);
    return [rx * sn * q, y, (c >= 0 ? rzF : rzB) * c * q];
  })), (x, y) => spine(y));
  const gap = rx => Math.asin(clamp(edge / rx, 0, 1));
  jacketPanel('womanJacketLeftFront', () => -Math.PI / 2, rx => -gap(rx)).userData.piece = 'jacket';
  jacketPanel('womanJacketRightFront', rx => gap(rx), () => Math.PI / 2).userData.piece = 'jacket';
  jacketPanel('womanJacketBack', () => Math.PI / 2, () => Math.PI * 1.5).userData.piece = 'jacket';
  for (const side of ['left', 'right']) {
    const Side = side[0].toUpperCase() + side.slice(1);
    // Wide jacket: flared elbow-length sleeves.
    sleevePanel(`womanJacket${Side}Sleeve`, side, [[.22, 2.60], [.40, 2.545], [.53, 2.325], [.63, 2.08], [.71, 1.82]],
      [.112, .166, .197, .26, .30], y => .35 * smoothstep(2.05, 1.82, y), 'jacket:wide');
    // Regular jacket: long narrow sleeves to the wrist, roomy enough to go over a long-sleeved shirt.
    sleevePanel(`womanJacket${Side}NarrowSleeve`, side, [[.22, 2.60], [.40, 2.545], [.53, 2.30], [.66, 2.02], [.76, 1.70], [.83, 1.46], [.85, 1.39]],
      [.112, .172, .172, .158, .145, .135, .132], forearm, 'jacket:normal');
  }
  // Trousers: y, leg centre, half-width, front depth, back depth. Above the crotch each leg panel is one half
  // of the hips; below it, it becomes its own wide leg that flares out to the floor.
  const hipKnots = [
    [1.900, .000, .390, .290, .290], [1.800, .000, .385, .285, .285], [1.700, .000, .460, .290, .290], [1.600, .000, .545, .300, .375],
    [1.500, .000, .585, .315, .430], [1.400, .020, .580, .325, .450], [1.300, .070, .530, .320, .445], [1.200, .130, .460, .315, .420],
  ];
  const trouserVariants = {
    // Wide legs that flare out to the floor.
    wide: { suffix: '', knots: [[1.100, .190, .390, .305, .380], [1.000, .230, .345, .295, .335], [.900, .260, .320, .285, .305], [.760, .280, .305, .276, .286],
      [.600, .290, .306, .273, .283], [.400, .300, .305, .279, .288], [.200, .310, .318, .285, .293], [.060, .320, .344, .304, .312]] },
    // Straight legs: the same width from the knee down to the shoe.
    straight: { suffix: 'Straight', knots: [[1.100, .190, .385, .305, .375], [1.000, .230, .335, .292, .325], [.900, .255, .300, .278, .290], [.760, .270, .280, .272, .268],
      [.600, .275, .275, .262, .262], [.400, .280, .275, .260, .260], [.200, .285, .275, .260, .260], [.060, .290, .275, .260, .260]] },
    // Slim legs that taper toward the ankle.
    slim: { suffix: 'Slim', knots: [[1.100, .195, .375, .300, .370], [1.000, .232, .320, .288, .318], [.900, .252, .282, .270, .280], [.760, .265, .250, .262, .245],
      [.600, .270, .215, .222, .212], [.400, .272, .192, .195, .192], [.200, .275, .178, .180, .178], [.060, .278, .172, .175, .172]] }
  };
  for (const [variant, { suffix, knots }] of Object.entries(trouserVariants)) {
  const trouserRows = sample([...hipKnots, ...knots], 110);
  for (const [name, sign, hip, knee, otherHip, otherKnee] of [[`womanLeftTrouser${suffix}`, -1, 3, 4, 6, 7], [`womanRightTrouser${suffix}`, 1, 6, 7, 3, 4]]) {
    const arc = 30, wall = 5;
    const rows = trouserRows.map(([y, cx, rx, rzF, rzB]) => {
      // The inner side of each leg is a flat seam just off the centre line, so the two legs never cross.
      const inner = y < 1.31 ? .0015 : 0, start = Math.asin(clamp((inner - cx) / rx, -1, 1)), end = Math.PI - start, ring = [];
      for (let s = 0; s <= arc; s++) {
        const a = lerp(start, end, s / arc), sn = Math.sin(a), c = Math.cos(a), q = squarish(sn, c);
        ring.push([sign * Math.max(inner, cx + rx * sn * q), y, (c >= 0 ? rzF : rzB) * c * q]);
      }
      const back = ring[arc], front = ring[0];
      // The hidden inner wall is a separate strip (not joined to the outer cloth), so it cannot darken the seam.
      for (let s = 0; s <= wall; s++) ring.push([lerp(back[0], front[0], s / wall), y, lerp(back[2], front[2], s / wall)]);
      return ring;
    });
    panel(name, rows, (x, y) => {
      const torsoShare = smoothstep(1.38, 1.80, y), legShare = 1 - torsoShare;
      // Around the hips the two halves share the pull evenly at the centre seam; below the crotch each
      // leg follows only its own hip and knee.
      const soft = lerp(.001, .2, smoothstep(1.12, 1.55, y)), own = lerp(.5, 1, clamp(Math.abs(x) / soft, 0, 1));
      const hipW = smoothstep(.62, .90, y), localY = clamp(y - 1.36, 0, .48), rootShare = 1 - localY / .48;
      return [[0, torsoShare * rootShare], [1, torsoShare * (1 - rootShare)],
        [hip, legShare * hipW * own], [knee, legShare * (1 - hipW) * own], [otherHip, legShare * hipW * (1 - own)], [otherKnee, legShare * (1 - hipW) * (1 - own)]];
    }, arc).userData.piece = `trousers:${variant}`;
  }
  }
}
if (feminine) createShirtTrousers();

// Make the whole woman 8% narrower (shoulders to feet, clothes included), keeping the head, neck and gele as
// they are. Done once at rest: joints and bones move inward, every body and garment surface is narrowed in
// width, and the skinned surfaces are bound again to the moved bones.
if (feminine) {
  const W = .92, narrow = new THREE.Matrix4().makeScale(W, 1, 1), keep = new Set();
  joints.neck.traverse(o => keep.add(o));
  scene.updateMatrixWorld(true);
  const skinned = [];
  scene.traverse(o => { if (o.isSkinnedMesh) skinned.push(o); });
  const rigid = [];
  joints.torso.traverse(o => { if (!keep.has(o) && o.isMesh && !o.isSkinnedMesh) rigid.push(o); });
  // Rigid limb shapes: narrow their geometry in world width (they may be rotated or stretched locally).
  for (const mesh of rigid) {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(), mesh.quaternion, mesh.scale);
    mesh.geometry = mesh.geometry.clone().applyMatrix4(local.clone().invert().multiply(narrow).multiply(local));
  }
  joints.torso.traverse(o => { if (o !== joints.torso && !keep.has(o)) o.position.x *= W; });
  joints.neck.position.x *= W;
  for (const mesh of skinned) { mesh.geometry.applyMatrix4(narrow); mesh.geometry.computeVertexNormals(); }
  scene.updateMatrixWorld(true);
  for (const mesh of skinned) mesh.bind(mesh.skeleton);
  for (const [side, rig] of Object.entries(armRigs)) {
    const e = rig.elbow.position, w = rig.wrist.position;
    Object.assign(rig, { upperLength: Math.hypot(e.x, e.y), lowerLength: Math.hypot(w.x, w.y), upperBase: Math.atan2(e.y, e.x), lowerBase: Math.atan2(w.y, w.x) });
  }
}
const poseObjects = {
  torso: joints.torso, head: joints.head, neck: joints.neck,
  waist: spineRig.root, midSpine: spineRig.mid, chest: spineRig.chest,
  leftShoulder: joints.leftArm, rightShoulder: joints.rightArm,
  leftArm: armRigs.left.root, leftElbow: armRigs.left.elbow, leftWrist: armRigs.left.wrist,
  rightArm: armRigs.right.root, rightElbow: armRigs.right.elbow, rightWrist: armRigs.right.wrist,
  leftHip: joints.leftLeg, leftLeg: legRigs.left.root, leftKnee: legRigs.left.knee, leftAnkle: legRigs.left.ankle,
  rightHip: joints.rightLeg, rightLeg: legRigs.right.root, rightKnee: legRigs.right.knee, rightAnkle: legRigs.right.ankle
};
const poseMarkers = [];
let poseMode = false, poseTool = 'rotate', activePoseDrag = null, selectedPoseMarker = null;
function poseMarker(parent, position, color, action, radius = .05) {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), new THREE.MeshBasicMaterial({ color, depthTest: false }));
  marker.position.set(...position); marker.renderOrder = 20; marker.visible = false; marker.userData.poseAction = action; parent.add(marker); poseMarkers.push(marker); return marker;
}
poseMarker(joints.head, [0, 0, .255], '#f5d900', { label: 'Head', joint: joints.head });
poseMarker(joints.neck, [0, .02, .20], '#ff9e25', { label: 'Neck', joint: joints.neck });
poseMarker(spineRig.root, [0, .08, .28], '#f5d900', { label: 'Waist / lower torso', joint: spineRig.root });
poseMarker(spineRig.mid, [0, .02, .25], '#ff9e25', { label: 'Mid-spine', joint: spineRig.mid });
poseMarker(spineRig.chest, [0, .04, .25], '#ff9e25', { label: 'Chest / upper torso', joint: spineRig.chest });
for (const [side, sign, group, color] of [['left', -1, joints.leftArm, '#0865f5'], ['right', 1, joints.rightArm, '#f21a1a']]) {
  const rig = armRigs[side];
  poseMarker(rig.root, [0, 0, .14], '#f5d900', { label: `${side} shoulder`, joint: rig.root });
  poseMarker(rig.elbow, [0, 0, .14], color, { label: `${side} elbow`, joint: rig.elbow });
  poseMarker(rig.wrist, [0, 0, .16], '#f000b8', { label: `${side} wrist / hand`, joint: rig.wrist, effector: 'arm', rig, group });
}
for (const [side, group, color] of [['left', joints.leftLeg, '#0865f5'], ['right', joints.rightLeg, '#f21a1a']]) {
  const rig = legRigs[side];
  poseMarker(rig.root, [0, 0, .16], '#f5d900', { label: `${side} hip`, joint: rig.root });
  poseMarker(rig.knee, [0, 0, .14], color, { label: `${side} knee`, joint: rig.knee });
  poseMarker(rig.ankle, [0, 0, .2], '#f000b8', { label: `${side} ankle / foot`, joint: rig.ankle, effector: 'leg', rig, group });
}
function posePointer(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}
function setPoseMode(enabled) {
  poseMode = enabled; poseMarkers.forEach(marker => marker.visible = enabled);
  if (enabled && selectedPoseMarker && poseTool === 'rotate') rotationControls.attach(selectedPoseMarker.userData.poseAction.joint);
  if (!enabled) rotationControls.detach();
  rotationGizmo.visible = enabled && poseTool === 'rotate' && !!selectedPoseMarker;
}
function setPoseTool(tool) {
  poseTool = tool;
  document.getElementById('rotatePoseTool').classList.toggle('active', tool === 'rotate');
  document.getElementById('movePoseTool').classList.toggle('active', tool === 'move');
  rotationGizmo.visible = poseMode && tool === 'rotate' && !!selectedPoseMarker;
  document.getElementById('poseSelected').textContent = selectedPoseMarker ? `${selectedPoseMarker.userData.poseAction.label} selected` : (tool === 'rotate' ? 'Select a joint, then drag its colored ring.' : 'Drag a pink hand or foot point to pose the limb.');
}
function normalizeAngle(value) { while (value > Math.PI) value -= Math.PI * 2; while (value < -Math.PI) value += Math.PI * 2; return value; }
function solveTwoBone(rig, target, pivot) {
  const dx = target.x - pivot.x, dy = target.y - pivot.y, raw = Math.hypot(dx, dy), min = Math.abs(rig.upperLength - rig.lowerLength) + .005, max = rig.upperLength + rig.lowerLength - .005;
  const distance = THREE.MathUtils.clamp(raw, min, max), direction = Math.atan2(dy, dx);
  const cosA = THREE.MathUtils.clamp((rig.upperLength ** 2 + distance ** 2 - rig.lowerLength ** 2) / (2 * rig.upperLength * distance), -1, 1), bend = Math.acos(cosA);
  const candidates = [direction + bend, direction - bend].map(a => normalizeAngle(a - rig.upperBase));
  rig.root.rotation.z = candidates.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
  const elbowX = pivot.x + rig.upperLength * Math.cos(rig.upperBase + rig.root.rotation.z), elbowY = pivot.y + rig.upperLength * Math.sin(rig.upperBase + rig.root.rotation.z);
  const foreAngle = Math.atan2(target.y - elbowY, target.x - elbowX);
  const lowerJoint = rig.elbow || rig.knee;
  lowerJoint.rotation.z = normalizeAngle(foreAngle - rig.root.rotation.z - rig.lowerBase);
}
function selectPoseMarker(marker) {
  if (selectedPoseMarker) selectedPoseMarker.scale.setScalar(1);
  selectedPoseMarker = marker; marker.scale.setScalar(1.45);
  rotationControls.attach(marker.userData.poseAction.joint);
  rotationGizmo.visible = poseMode && poseTool === 'rotate';
  document.getElementById('poseSelected').textContent = `${marker.userData.poseAction.label} selected${poseTool === 'rotate' ? ' · drag a colored ring to rotate' : ' · drag a pink endpoint to pose the limb'}`;
}
renderer.domElement.addEventListener('pointerdown', e => {
  if (!poseMode) return;
  posePointer(e);
  const hit = raycaster.intersectObjects(poseMarkers.filter(m => m.visible), false).find(h => h.object.userData.poseAction && (poseTool === 'rotate' || h.object.userData.poseAction.effector));
  if (!hit && rotationGizmo.visible && raycaster.intersectObject(rotationGizmo, true).length) return;
  if (!hit) return;
  e.preventDefault(); e.stopImmediatePropagation(); down = null;
  const marker = hit.object, action = marker.userData.poseAction;
  selectPoseMarker(marker);
  if (poseTool === 'move' && action.effector) {
    activePoseDrag = { action };
    controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId);
  }
}, true);
renderer.domElement.addEventListener('pointermove', e => {
  if (!activePoseDrag) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const { action } = activePoseDrag;
  if (poseTool === 'move' && action.effector) {
    posePointer(e);
    const pivot = action.group.getWorldPosition(new THREE.Vector3());
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -pivot.z), target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, target)) solveTwoBone(action.rig, target, pivot);
  }
}, true);
function finishPoseDrag(e) { if (!activePoseDrag) return; e.stopImmediatePropagation(); activePoseDrag = null; controls.enabled = true; }
renderer.domElement.addEventListener('pointerup', finishPoseDrag, true);
renderer.domElement.addEventListener('pointercancel', finishPoseDrag, true);const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) { down = null; return; }
  const rect = renderer.domElement.getBoundingClientRect(); pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects([...surfaces.values()])[0];
  if (hit?.object.userData.panel) window.selectClothingPanel?.(hit.object.userData.panel); down = null;
});
function resize() { const r = stage.getBoundingClientRect(); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); renderer.setSize(r.width, r.height, false); }
new ResizeObserver(resize).observe(stage); resize();
const panLimit = { min: new THREE.Vector3(-2.5, -.5, -2.5), max: new THREE.Vector3(2.5, 4.5, 2.5) };
function frame() {
  requestAnimationFrame(frame);
  // Keep the moved view near the figure so it cannot be panned away and lost.
  const before = controls.target.clone(); controls.target.clamp(panLimit.min, panLimit.max);
  camera.position.add(controls.target.clone().sub(before));
  controls.update(); renderer.render(scene, camera);
}
frame();
window.Cloth3D = {
  setDress(visible) { womanDress?.forEach(part => { part.visible = !!visible; }); },
  // Outfits on the woman: 'dress' shows the dress and gele; 'shirtTrousers' shows the sleeveless top and wide trousers.
  setOutfit(name) { womanOutfit = name; const dress = name === 'dress'; womanDress?.forEach(part => { part.visible = dress; }); const gele = surfaces.get('headtie'); if (gele) gele.visible = dress; showWomanPieces(); },
  // Pieces of the top + trousers outfit: { jacket: 'wide' | 'normal' | 'none', shirt: 'sleeveless' | 'short' | 'long', trousers: 'wide' | 'straight' | 'slim' }.
  setPieces(choice) { Object.assign(womanPieces, choice || {}); showWomanPieces(); },
  getVisiblePanels() { return [...surfaces.entries()].filter(([, mesh]) => mesh.visible).map(([id]) => id); },
  select(id) { surfaces.forEach((m, key) => { m.material.emissive.set(key === id ? '#514237' : '#000000'); m.material.emissiveIntensity = key === id ? .12 : 0; }); },
  setTexture(id, data) {
    const loader = new THREE.TextureLoader(); loader.load(data, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      // Map the chosen fabric region once across this garment panel.
      const target = surfaces.get(id);
      // A headtie is one long folded strip, so its fabric repeats along the strip instead of stretching once.
      texture.wrapS = texture.wrapT = target?.userData.repeatTexture ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      texture.repeat.set(1, 1);
      const mat = new THREE.MeshStandardMaterial({ map: texture, color: '#fff', roughness: .9, side: THREE.DoubleSide });
      fabricMats.get(id)?.dispose(); fabricMats.set(id, mat); const mesh = surfaces.get(id); if (mesh) mesh.material = mat;
    });
  },
  clear(id) { const mesh = surfaces.get(id); if (mesh) mesh.material = (mesh.userData.baseMaterial || cloth).clone(); fabricMats.get(id)?.dispose(); fabricMats.delete(id); },
  setPoseMode,
  setPoseTool,
  getPose() { return Object.fromEntries(Object.entries(poseObjects).map(([name, object]) => [name, object.rotation.toArray()])); },
  setPose(pose) { for (const [name, rotation] of Object.entries(pose || {})) if (poseObjects[name] && Array.isArray(rotation)) poseObjects[name].rotation.fromArray(rotation); },
  resetPose() {
    Object.values(joints).forEach(j => j.rotation.set(0, 0, 0));
    spineRig.root.rotation.set(0, 0, 0); spineRig.mid.rotation.set(0, 0, 0); spineRig.chest.rotation.set(0, 0, 0);
    Object.values(armRigs).forEach(r => { r.root.rotation.set(0, 0, 0); r.elbow.rotation.set(0, 0, 0); r.wrist.rotation.set(0, 0, 0); });
    Object.values(legRigs).forEach(r => { r.root.rotation.set(0, 0, 0); r.knee.rotation.set(0, 0, 0); r.ankle.rotation.set(0, 0, 0); });
    if (selectedPoseMarker) selectedPoseMarker.scale.setScalar(1); selectedPoseMarker = null;
    rotationControls.detach(); rotationGizmo.visible = false;
    document.getElementById('poseSelected').textContent = poseTool === 'rotate' ? 'Select a joint, then drag its colored ring.' : 'Drag a pink hand or foot point to pose the limb.';
  },
  view(angle) {
    const distance = 7.5, a = angle * Math.PI / 180;
    camera.position.set(Math.sin(a) * distance, 2.25, Math.cos(a) * distance); camera.lookAt(0, 1.65, 0); controls.target.set(0, 1.65, 0); controls.update();
    document.getElementById('angleLabel').textContent = angle === 0 ? 'Front view' : angle === 180 ? 'Back view' : 'Side view';
  }
};
window.dispatchEvent(new Event('cloth3dready'));
