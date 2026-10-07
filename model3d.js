import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const mount = document.getElementById('model');
const stage = document.getElementById('stage');
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
controls.enablePan = false;
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
const cloth = new THREE.MeshStandardMaterial({ color: '#ded9cf', roughness: .88, side: THREE.DoubleSide });
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
function makeSurface(panel, rows, a0, a1, segments = 26) {
  const positions = [], uvs = [], indices = [];
  const minY = rows[0].y, height = Math.max(.001, rows.at(-1).y - minY);
  rows.forEach((r, j) => {
    const rowPoints = [], distances = [0]; let length = 0;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, a = a0 + (a1 - a0) * t;
      const x = r.cx + r.rx * Math.sin(a), z = r.rz * Math.cos(a);
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
  const mesh = new THREE.Mesh(g, cloth.clone()); mesh.name = panel; mesh.userData.panel = panel; mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); surfaces.set(panel, mesh); return mesh;
}
function taperedTube(curve, lengthSegments, radialSegments, startRadius, endRadius) {
  const g = new THREE.TubeGeometry(curve, lengthSegments, 1, radialSegments, false);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const t = uv.getX(i), center = curve.getPointAt(t), radius = startRadius + (endRadius - startRadius) * t;
    pos.setXYZ(i, center.x + (pos.getX(i) - center.x) * radius, center.y + (pos.getY(i) - center.y) * radius, center.z + (pos.getZ(i) - center.z) * radius);
  }
  pos.needsUpdate = true; g.computeVertexNormals(); return g;
}
// A neutral, softly shaped mannequin beneath a shirt and trousers.
ellipsoid('body', [0, 2.03, 0], [.48, .75, .25]);
ellipsoid('head', [0, 3.23, 0], [.25, .32, .24]);
capsuleBetween('neck', [0, 2.61, 0], [0, 2.99, 0], .105);
// Shirt front and back are separate textile panels around the torso.
const shirtRows = [
  { y: 1.36, cx: 0, rx: .43, rz: .265 }, { y: 1.48, cx: 0, rx: .48, rz: .285 },
  { y: 1.82, cx: 0, rx: .46, rz: .28 }, { y: 2.27, cx: 0, rx: .53, rz: .285 },
  { y: 2.50, cx: 0, rx: .51, rz: .27 }, { y: 2.59, cx: 0, rx: .48, rz: .255 },
  // Broad, evenly curved yoke prevents the neck-to-shoulder cloth from pinching.
  { y: 2.65, cx: 0, rx: .46, rz: .25 }, { y: 2.70, cx: 0, rx: .42, rz: .235 },
  { y: 2.75, cx: 0, rx: .34, rz: .205 }, { y: 2.79, cx: 0, rx: .24, rz: .175 },
  { y: 2.82, cx: 0, rx: .17, rz: .15 }
];
makeSurface('shirtFront', shirtRows, -Math.PI / 2, Math.PI / 2);
makeSurface('shirtBack', shirtRows, Math.PI / 2, Math.PI * 1.5);
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
  const sleeve = new THREE.Mesh(taperedTube(curve, 48, 24, .17, .135), cloth.clone());
  sleeve.name = id; sleeve.userData.panel = id; sleeve.castShadow = true; sleeve.receiveShadow = true;
  scene.add(sleeve); surfaces.set(id, sleeve);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, .105, 16, false), skin);
  arm.name = `${id}Arm`; arm.castShadow = true; scene.add(arm);
  ellipsoid(`${id}Hand`, [sign * .88, 1.25, 0], [.13, .16, .12]);
}
makeSleeve('leftSleeve', -1); makeSleeve('rightSleeve', 1);
// Two tapered legs, with separate front and back cloth panels on each leg.
for (const [id, cx] of [['left', -.235], ['right', .235]]) {
  const rows = [
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
  makeSurface(`${id}LegFront`, denseRows, -Math.PI / 2, Math.PI / 2);
  makeSurface(`${id}LegBack`, denseRows, Math.PI / 2, Math.PI * 1.5);
  capsuleBetween(`${id}leg`, [cx, .08, 0], [cx, .58, 0], .12);
  ellipsoid(`${id}foot`, [cx, .09, .13], [.14, .085, .27]);
}
// Shirt collar and a quiet center seam give the plain mannequin a readable outfit shape.
const collar = new THREE.Mesh(new THREE.TorusGeometry(.15, .022, 10, 48), new THREE.MeshStandardMaterial({ color: '#c7c1b6', roughness: .9 }));
collar.position.set(0, 2.82, 0); collar.rotation.x = Math.PI / 2; scene.add(collar);
const seam = new THREE.Mesh(new THREE.BoxGeometry(.012, 1.18, .012), new THREE.MeshStandardMaterial({ color: '#bdb6aa' })); seam.position.set(0, 2.0, .252); scene.add(seam);
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
  leftArm: makeJoint('leftShoulder', [-.36, 2.57, 0], ['leftSleeve', 'leftSleeveArm', 'leftSleeveHand']),
  rightArm: makeJoint('rightShoulder', [.36, 2.57, 0], ['rightSleeve', 'rightSleeveArm', 'rightSleeveHand']),
  leftLeg: makeJoint('leftHip', [-.235, 1.45, 0], ['leftLegFront', 'leftLegBack', 'leftleg', 'leftfoot']),
  rightLeg: makeJoint('rightHip', [.235, 1.45, 0], ['rightLegFront', 'rightLegBack', 'rightleg', 'rightfoot']),
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
  for (const name of ['body', 'shirtFront', 'shirtBack', 'seam']) {
    const mesh = skinTorso(name);
    if (mesh && (name === 'shirtFront' || name === 'shirtBack')) surfaces.set(name, mesh);
  }
  return { root, mid, chest, skeleton };
})();
spineRig.chest.attach(collar);
const armRigs = {};
for (const [side, sign, group] of [['left', -1, joints.leftArm], ['right', 1, joints.rightArm]]) {
  const root = bone(group, `${side}ArmRoot`, [0, 0, 0]);
  const elbow = bone(root, `${side}Elbow`, [sign * .30, -.55, 0]);
  const wrist = bone(elbow, `${side}Wrist`, [sign * .18, -.64, 0]);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([root, elbow, wrist]); skeleton.calculateInverses();
  const sleeve = skinnedCopy(scene.getObjectByName(`${side}Sleeve`), group, skeleton, 1, -.55);
  surfaces.set(`${side}Sleeve`, sleeve);
  skinnedCopy(scene.getObjectByName(`${side}SleeveArm`), group, skeleton, 1, -.55);
  const hand = scene.getObjectByName(`${side}SleeveHand`); if (hand) wrist.attach(hand);
  armRigs[side] = { root, elbow, wrist, upperLength: Math.hypot(.30, .55), lowerLength: Math.hypot(.18, .64), upperBase: Math.atan2(-.55, sign * .30), lowerBase: Math.atan2(-.64, sign * .18) };
}
const legRigs = {};
for (const [side, group] of [['left', joints.leftLeg], ['right', joints.rightLeg]]) {
  const root = bone(group, `${side}LegRoot`, [0, 0, 0]);
  const knee = bone(root, `${side}Knee`, [0, -.76, 0]);
  const ankle = bone(knee, `${side}Ankle`, [0, -.60, 0]);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([root, knee, ankle]); skeleton.calculateInverses();
  for (const panel of ['LegFront', 'LegBack']) surfaces.set(`${side}${panel}`, skinnedCopy(scene.getObjectByName(`${side}${panel}`), group, skeleton, 1, -.86));
  skinnedCopy(scene.getObjectByName(`${side}leg`), group, skeleton, 1, -.76);
  const foot = scene.getObjectByName(`${side}foot`); if (foot) ankle.attach(foot);
  legRigs[side] = { root, knee, ankle, upperLength: .76, lowerLength: .60, upperBase: -Math.PI / 2, lowerBase: -Math.PI / 2 };
}
spineRig.root.attach(joints.leftLeg); spineRig.root.attach(joints.rightLeg);
spineRig.chest.attach(joints.leftArm); spineRig.chest.attach(joints.rightArm); spineRig.chest.attach(joints.neck);
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
function frame() { requestAnimationFrame(frame); controls.update(); renderer.render(scene, camera); }
frame();
window.Cloth3D = {
  select(id) { surfaces.forEach((m, key) => { m.material.emissive.set(key === id ? '#514237' : '#000000'); m.material.emissiveIntensity = key === id ? .12 : 0; }); },
  setTexture(id, data) {
    const loader = new THREE.TextureLoader(); loader.load(data, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      // Map the chosen fabric region once across this garment panel.
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(1, 1);
      const mat = new THREE.MeshStandardMaterial({ map: texture, color: '#fff', roughness: .9, side: THREE.DoubleSide });
      fabricMats.get(id)?.dispose(); fabricMats.set(id, mat); const mesh = surfaces.get(id); if (mesh) mesh.material = mat;
    });
  },
  clear(id) { const mesh = surfaces.get(id); if (mesh) mesh.material = cloth.clone(); fabricMats.get(id)?.dispose(); fabricMats.delete(id); },
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
