import * as THREE from 'three';

export type AircraftType =
  | 'airbus_a350'
  | 'boeing_787'
  | 'boeing_747'
  | 'airbus_a380'
  | 'fighter_jet'
  | 'stunt_plane';

export interface AircraftMetadata {
  id: AircraftType;
  name: string;
  manufacturer: 'Airbus' | 'Boeing' | 'AeroTest';
  code: string;
  wingspan: string;
  engines: string;
  description: string;
}

export const AIRCRAFT_CATALOG: AircraftMetadata[] = [
  {
    id: 'airbus_a350',
    name: 'Airbus A350-900 XWB',
    manufacturer: 'Airbus',
    code: 'A359',
    wingspan: '64.75 m',
    engines: '2× RR Trent XWB',
    description: 'Carbon-composite widebody with curved Sharklets & mask cockpit',
  },
  {
    id: 'boeing_787',
    name: 'Boeing 787-9 Dreamliner',
    manufacturer: 'Boeing',
    code: 'B789',
    wingspan: '60.12 m',
    engines: '2× GEnx-1B Chevron',
    description: 'Swept raked-wingtip airliner with serrated chevron engine nacelles',
  },
  {
    id: 'boeing_747',
    name: 'Boeing 747-8 Intercontinental',
    manufacturer: 'Boeing',
    code: 'B748',
    wingspan: '68.40 m',
    engines: '4× GEnx-2B67',
    description: 'Iconic upper-deck hump quad-jet heavy commercial transport',
  },
  {
    id: 'airbus_a380',
    name: 'Airbus A380-800 Superjumbo',
    manufacturer: 'Airbus',
    code: 'A388',
    wingspan: '79.75 m',
    engines: '4× Trent 900',
    description: 'Full-length double-deck quad-engine flagship airliner',
  },
  {
    id: 'fighter_jet',
    name: 'F-22X Supersonic Testbed',
    manufacturer: 'AeroTest',
    code: 'F22X',
    wingspan: '13.56 m',
    engines: '2× F119 Turbofan',
    description: 'High-agility twin-tail supersonic flight test aircraft',
  },
  {
    id: 'stunt_plane',
    name: 'Extra 330SC Aerobatic',
    manufacturer: 'AeroTest',
    code: 'E330',
    wingspan: '8.00 m',
    engines: '1× Lycoming IO-580',
    description: 'Unlimited-category single-propeller aerobatic demonstrator',
  },
];

export interface AircraftInstance {
  group: THREE.Group;
  name: string;
  type: AircraftType;
  animate?: (delta: number, pitchDeg?: number, rollDeg?: number, yawDeg?: number) => void;
}

/**
 * Generates a high-resolution procedural fuselage livery & window strip texture.
 * In Three.js CylinderGeometry:
 * - U (canvas X: 0..512) wraps around the circumference of the fuselage
 *   (U=0.25 is Starboard/+X side, U=0.5 is Top/+Y crown, U=0.75 is Port/-X side, U=0/1 is Bottom/-Y belly)
 * - V (canvas Y: 0..1024) runs along the length of the fuselage from Nose to Tail!
 */
function createFuselageLiveryTexture(options: {
  stripeColor1: string;
  stripeColor2: string;
  doubleDeck?: boolean;
  forwardHump?: boolean;
}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base porcelain white fuselage paint
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 1024);

  // Subtle gray belly fairing along U=0..45 and U=467..512
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 48, 1024);
  ctx.fillRect(464, 0, 48, 1024);

  // Draw longitudinal cheatlines & cabin windows along V (Y: 80..940)
  // Starboard side is around X = 128; Port side is around X = 384 (Crown is X = 256)
  const drawSide = (sideX: number, dirTowardCrown: number) => {
    // Primary cheatline below windows
    ctx.fillStyle = options.stripeColor1;
    ctx.fillRect(sideX - dirTowardCrown * 18, 60, 8, 900);

    // Secondary accent line
    ctx.fillStyle = options.stripeColor2;
    ctx.fillRect(sideX - dirTowardCrown * 28, 60, 4, 900);

    // Main deck cabin windows running nose-to-tail (Y)
    ctx.fillStyle = '#0f172a';
    for (let y = 110; y < 910; y += 20) {
      if (y > 460 && y < 510) continue; // Over-wing exit gap
      ctx.beginPath();
      ctx.roundRect(sideX, y, 10, 7, 2);
      ctx.fill();
    }

    // Upper deck windows for A380 (full length) or 747-8 (forward section)
    if (options.doubleDeck) {
      ctx.fillStyle = '#0f172a';
      for (let y = 140; y < 880; y += 20) {
        ctx.beginPath();
        ctx.roundRect(sideX + dirTowardCrown * 22, y, 9, 6, 2);
        ctx.fill();
      }
    }
  };

  drawSide(122, 1);  // Starboard side (+X)
  drawSide(380, -1); // Port side (-X)

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Helper to build a realistic high-bypass turbofan engine nacelle with spinning fan blades
 * and optional Boeing 787/747-8 serrated chevron nozzle.
 */
function createTurbofanEngine(options: {
  radius: number;
  length: number;
  cowlColor: number;
  chevron?: boolean;
}): { nacelleGroup: THREE.Group; fanSpinner: THREE.Group } {
  const nacelleGroup = new THREE.Group();

  const cowlMat = new THREE.MeshStandardMaterial({
    color: options.cowlColor,
    roughness: 0.22,
    metalness: 0.25,
  });

  const chromeLipMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.15,
    metalness: 0.88,
  });

  const exhaustCoreMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.75,
  });

  const darkBladeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.7,
  });

  const r = options.radius;
  const len = options.length;
  const points = [
    new THREE.Vector2(r * 0.78, -len * 0.5),
    new THREE.Vector2(r * 0.96, -len * 0.45),
    new THREE.Vector2(r * 1.02, -len * 0.15),
    new THREE.Vector2(r * 0.98, len * 0.25),
    new THREE.Vector2(r * 0.82, len * 0.5),
    new THREE.Vector2(r * 0.72, len * 0.5),
    new THREE.Vector2(r * 0.72, -len * 0.45),
  ];
  const cowlGeo = new THREE.LatheGeometry(points, 24);
  cowlGeo.rotateX(Math.PI / 2);
  const cowlMesh = new THREE.Mesh(cowlGeo, cowlMat);
  nacelleGroup.add(cowlMesh);

  // Polished metallic intake lip ring at front (-Z)
  const lipGeo = new THREE.TorusGeometry(r * 0.86, r * 0.085, 12, 24);
  const lipMesh = new THREE.Mesh(lipGeo, chromeLipMat);
  lipMesh.position.z = -len * 0.48;
  nacelleGroup.add(lipMesh);

  // Rear primary exhaust nozzle cone (+Z)
  const coreGeo = new THREE.ConeGeometry(r * 0.48, len * 0.5, 20);
  coreGeo.rotateX(Math.PI / 2);
  const coreMesh = new THREE.Mesh(coreGeo, exhaustCoreMat);
  coreMesh.position.z = len * 0.52;
  nacelleGroup.add(coreMesh);

  // Optional Boeing serrated chevrons on trailing edge of nacelle
  if (options.chevron) {
    const chevCount = 10;
    for (let i = 0; i < chevCount; i++) {
      const ang = (i / chevCount) * Math.PI * 2;
      const chevGeo = new THREE.ConeGeometry(r * 0.08, len * 0.15, 3);
      chevGeo.rotateX(Math.PI / 2);
      const chev = new THREE.Mesh(chevGeo, cowlMat);
      chev.position.set(
        Math.cos(ang) * r * 0.76,
        Math.sin(ang) * r * 0.76,
        len * 0.54
      );
      chev.rotation.z = ang;
      nacelleGroup.add(chev);
    }
  }

  // Spinning Fan Assembly inside intake (-Z)
  const fanSpinner = new THREE.Group();
  fanSpinner.position.z = -len * 0.34;

  const coneGeo = new THREE.ConeGeometry(r * 0.24, r * 0.48, 16);
  coneGeo.rotateX(-Math.PI / 2);
  const coneMesh = new THREE.Mesh(coneGeo, chromeLipMat);
  coneMesh.position.z = -r * 0.14;
  fanSpinner.add(coneMesh);

  const numBlades = 14;
  const bladeGeo = new THREE.BoxGeometry(r * 0.06, r * 0.72, 0.02);
  for (let i = 0; i < numBlades; i++) {
    const angle = (i / numBlades) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeo, darkBladeMat);
    blade.position.set(Math.cos(angle) * r * 0.42, Math.sin(angle) * r * 0.42, 0);
    blade.rotation.z = angle;
    blade.rotation.x = 0.38;
    fanSpinner.add(blade);
  }
  nacelleGroup.add(fanSpinner);

  return { nacelleGroup, fanSpinner };
}

/**
 * 1. AIRBUS A350-900 XWB
 * Features signature black wraparound cockpit mask, curved Sharklet winglets,
 * twin Rolls-Royce Trent XWB turbofans, and Airbus tail livery.
 */
export function createAirbusA350(): AircraftInstance {
  const group = new THREE.Group();
  group.name = 'AirbusA350';

  const liveryTex = createFuselageLiveryTexture({
    stripeColor1: '#0284c7',
    stripeColor2: '#0f172a',
  });

  const fuselageMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    roughness: 0.22,
    metalness: 0.15,
  });

  const whiteWingMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.26,
    metalness: 0.2,
  });

  const airbusBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.26,
    metalness: 0.25,
  });

  const cockpitMaskMat = new THREE.MeshStandardMaterial({
    color: 0x090d16, // Iconic A350 black wraparound mask
    roughness: 0.08,
    metalness: 0.5,
  });

  const flapAccentMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.4,
    metalness: 0.35,
  });

  // 1. Widebody Fuselage Cylinder
  const fuselageGeo = new THREE.CylinderGeometry(0.46, 0.46, 4.4, 32);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
  group.add(fuselage);

  // 2. Sculpted A350 Nose Cone (-Z) — y increasing 0 -> 1.35 for outward normals
  const nosePts = [
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.43, 0.3),
    new THREE.Vector2(0.34, 0.68),
    new THREE.Vector2(0.18, 1.1),
    new THREE.Vector2(0.0, 1.35),
  ];
  const noseGeo = new THREE.LatheGeometry(nosePts, 32);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, whiteWingMat);
  nose.position.z = -2.2;
  group.add(nose);

  // Signature A350 Black Bandit Mask Cockpit Visor flush on Nose
  const maskGeo = new THREE.CapsuleGeometry(0.19, 0.28, 12, 20);
  maskGeo.rotateZ(Math.PI / 2);
  const mask = new THREE.Mesh(maskGeo, cockpitMaskMat);
  mask.position.set(0, 0.24, -2.65);
  mask.scale.set(0.92, 0.42, 0.95);
  mask.rotation.x = -0.32;
  group.add(mask);

  // 3. Tapered Tail Cone (+Z)
  const tailPts = [
    new THREE.Vector2(0.46, 0.0),
    new THREE.Vector2(0.37, 0.65),
    new THREE.Vector2(0.2, 1.35),
    new THREE.Vector2(0.04, 1.85),
    new THREE.Vector2(0.0, 1.9),
  ];
  const tailGeo = new THREE.LatheGeometry(tailPts, 28);
  tailGeo.rotateX(Math.PI / 2);
  const tailCone = new THREE.Mesh(tailGeo, whiteWingMat);
  tailCone.position.set(0, 0.0, 2.2);
  group.add(tailCone);

  // 4. Swept Supercritical Wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.75);
  wingShape.lineTo(3.45, 0.95);
  wingShape.lineTo(3.45, 1.25);
  wingShape.lineTo(1.2, 0.65);
  wingShape.lineTo(0, 0.65);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.015,
    bevelThickness: 0.015,
  });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, whiteWingMat);
  rightWing.position.set(0.36, -0.14, -0.15);
  rightWing.rotation.z = 0.05;
  group.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.set(-1, 1, 1);
  leftWing.position.set(-0.36, -0.14, -0.15);
  leftWing.rotation.z = -0.05;
  group.add(leftWing);

  // A350 Signature Curved Raked Sharklets (swept aft +Z)
  const sharkletShape = new THREE.Shape();
  sharkletShape.moveTo(0, 0);
  sharkletShape.quadraticCurveTo(0.12, 0.26, 0.32, 0.52);
  sharkletShape.lineTo(0.48, 0.52);
  sharkletShape.lineTo(0.3, 0);
  sharkletShape.closePath();

  const sharkletGeo = new THREE.ExtrudeGeometry(sharkletShape, {
    depth: 0.025,
    bevelEnabled: false,
  });
  sharkletGeo.rotateY(-Math.PI / 2);

  const rightSharklet = new THREE.Mesh(sharkletGeo, airbusBlueMat);
  rightSharklet.position.set(3.8, 0.03, 0.8);
  rightSharklet.rotation.z = -0.12;
  group.add(rightSharklet);

  const leftSharklet = rightSharklet.clone();
  leftSharklet.position.set(-3.8, 0.03, 0.8);
  leftSharklet.rotation.z = 0.12;
  group.add(leftSharklet);

  // Dynamic Ailerons
  const aileronGeo = new THREE.BoxGeometry(0.95, 0.025, 0.14);
  const rightAileron = new THREE.Mesh(aileronGeo, flapAccentMat);
  rightAileron.position.set(2.6, -0.04, 0.68);
  rightAileron.rotation.y = -0.42;
  group.add(rightAileron);

  const leftAileron = rightAileron.clone();
  leftAileron.position.set(-2.6, -0.04, 0.68);
  leftAileron.rotation.y = 0.42;
  group.add(leftAileron);

  // 5. Twin Rolls-Royce Trent XWB Turbofans
  const spinners: THREE.Group[] = [];
  const engR = createTurbofanEngine({
    radius: 0.27,
    length: 1.05,
    cowlColor: 0xf8fafc,
    chevron: false,
  });
  engR.nacelleGroup.position.set(1.38, -0.36, -0.35);
  group.add(engR.nacelleGroup);
  spinners.push(engR.fanSpinner);

  const engL = createTurbofanEngine({
    radius: 0.27,
    length: 1.05,
    cowlColor: 0xf8fafc,
    chevron: false,
  });
  engL.nacelleGroup.position.set(-1.38, -0.36, -0.35);
  group.add(engL.nacelleGroup);
  spinners.push(engL.fanSpinner);

  const pylonGeo = new THREE.BoxGeometry(0.06, 0.24, 0.65);
  const pylonR = new THREE.Mesh(pylonGeo, whiteWingMat);
  pylonR.position.set(1.38, -0.18, -0.25);
  group.add(pylonR);

  const pylonL = pylonR.clone();
  pylonL.position.set(-1.38, -0.18, -0.25);
  group.add(pylonL);

  // 6. Airbus Vertical Stabilizer (Swept aft +Z)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.95, 1.48);
  finShape.lineTo(1.48, 1.48);
  finShape.lineTo(1.22, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  finGeo.rotateY(-Math.PI / 2);
  const vFin = new THREE.Mesh(finGeo, airbusBlueMat);
  vFin.position.set(0.027, 0.32, 2.25);
  group.add(vFin);

  // 7. Swept Horizontal Tailplane
  const hStabShape = new THREE.Shape();
  hStabShape.moveTo(0, -0.25);
  hStabShape.lineTo(1.25, 0.35);
  hStabShape.lineTo(1.25, 0.55);
  hStabShape.lineTo(0, 0.25);
  hStabShape.closePath();

  const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.035, bevelEnabled: false });
  hStabGeo.rotateX(Math.PI / 2);

  const rightHStab = new THREE.Mesh(hStabGeo, whiteWingMat);
  rightHStab.position.set(0.15, 0.08, 3.15);
  group.add(rightHStab);

  const leftHStab = rightHStab.clone();
  leftHStab.scale.set(-1, 1, 1);
  leftHStab.position.set(-0.15, 0.08, 3.15);
  group.add(leftHStab);

  const animate = (delta: number, pitchDeg = 0, rollDeg = 0) => {
    spinners.forEach((s) => {
      s.rotation.z += delta * 22.0;
    });
    const rollDeflect = THREE.MathUtils.clamp(rollDeg * 0.008, -0.35, 0.35);
    rightAileron.rotation.x = rollDeflect;
    leftAileron.rotation.x = -rollDeflect;

    const pitchDeflect = THREE.MathUtils.clamp(pitchDeg * 0.008, -0.3, 0.3);
    rightHStab.rotation.x = pitchDeflect;
    leftHStab.rotation.x = pitchDeflect;
  };

  return { group, name: 'Airbus A350-900 XWB', type: 'airbus_a350', animate };
}

/**
 * 2. BOEING 787-9 DREAMLINER
 */
export function createBoeing787(): AircraftInstance {
  const group = new THREE.Group();
  group.name = 'Boeing787';

  const liveryTex = createFuselageLiveryTexture({
    stripeColor1: '#1d4ed8',
    stripeColor2: '#38bdf8',
  });

  const fuselageMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    roughness: 0.2,
    metalness: 0.18,
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.24,
    metalness: 0.2,
  });

  const boeingBlueMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.26,
    metalness: 0.28,
  });

  const cockpitGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.08,
    metalness: 0.55,
  });

  const fuselageGeo = new THREE.CylinderGeometry(0.45, 0.45, 4.3, 32);
  fuselageGeo.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(fuselageGeo, fuselageMat));

  // Smooth Continuous 787 Nose Profile (-Z) — y increasing 0 -> 1.45
  const nosePts = [
    new THREE.Vector2(0.45, 0.0),
    new THREE.Vector2(0.43, 0.3),
    new THREE.Vector2(0.34, 0.72),
    new THREE.Vector2(0.18, 1.18),
    new THREE.Vector2(0.0, 1.45),
  ];
  const noseGeo = new THREE.LatheGeometry(nosePts, 32);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, whiteMat);
  nose.position.z = -2.15;
  group.add(nose);

  const visorGeo = new THREE.CapsuleGeometry(0.18, 0.26, 12, 20);
  visorGeo.rotateZ(Math.PI / 2);
  const visor = new THREE.Mesh(visorGeo, cockpitGlassMat);
  visor.position.set(0, 0.23, -2.6);
  visor.scale.set(0.9, 0.4, 0.95);
  visor.rotation.x = -0.3;
  group.add(visor);

  const tailPts = [
    new THREE.Vector2(0.45, 0.0),
    new THREE.Vector2(0.36, 0.7),
    new THREE.Vector2(0.18, 1.4),
    new THREE.Vector2(0.0, 1.85),
  ];
  const tailGeo = new THREE.LatheGeometry(tailPts, 28);
  tailGeo.rotateX(Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, boeingBlueMat);
  tail.position.set(0, 0.0, 2.15);
  group.add(tail);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.7);
  wingShape.lineTo(3.1, 0.85);
  wingShape.lineTo(3.75, 1.45);
  wingShape.lineTo(3.65, 1.58);
  wingShape.lineTo(2.9, 1.15);
  wingShape.lineTo(0, 0.6);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.014,
    bevelThickness: 0.014,
  });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, whiteMat);
  rightWing.position.set(0.35, -0.12, -0.15);
  rightWing.rotation.z = 0.085;
  group.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.set(-1, 1, 1);
  leftWing.position.set(-0.35, -0.12, -0.15);
  leftWing.rotation.z = -0.085;
  group.add(leftWing);

  const spinners: THREE.Group[] = [];
  const engR = createTurbofanEngine({
    radius: 0.26,
    length: 1.05,
    cowlColor: 0xf8fafc,
    chevron: true,
  });
  engR.nacelleGroup.position.set(1.32, -0.32, -0.32);
  group.add(engR.nacelleGroup);
  spinners.push(engR.fanSpinner);

  const engL = createTurbofanEngine({
    radius: 0.26,
    length: 1.05,
    cowlColor: 0xf8fafc,
    chevron: true,
  });
  engL.nacelleGroup.position.set(-1.32, -0.32, -0.32);
  group.add(engL.nacelleGroup);
  spinners.push(engL.fanSpinner);

  const pylonGeo = new THREE.BoxGeometry(0.055, 0.22, 0.6);
  const pylonR = new THREE.Mesh(pylonGeo, whiteMat);
  pylonR.position.set(1.32, -0.16, -0.22);
  group.add(pylonR);

  const pylonL = pylonR.clone();
  pylonL.position.set(-1.32, -0.16, -0.22);
  group.add(pylonL);

  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.05, 1.45);
  finShape.lineTo(1.5, 1.45);
  finShape.lineTo(1.18, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: false });
  finGeo.rotateY(-Math.PI / 2);
  const fin = new THREE.Mesh(finGeo, boeingBlueMat);
  fin.position.set(0.025, 0.32, 2.15);
  group.add(fin);

  const hStabShape = new THREE.Shape();
  hStabShape.moveTo(0, -0.22);
  hStabShape.lineTo(1.2, 0.38);
  hStabShape.lineTo(1.2, 0.56);
  hStabShape.lineTo(0, 0.22);
  hStabShape.closePath();

  const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.035, bevelEnabled: false });
  hStabGeo.rotateX(Math.PI / 2);

  const rightHStab = new THREE.Mesh(hStabGeo, whiteMat);
  rightHStab.position.set(0.14, 0.08, 3.05);
  group.add(rightHStab);

  const leftHStab = rightHStab.clone();
  leftHStab.scale.set(-1, 1, 1);
  leftHStab.position.set(-0.14, 0.08, 3.05);
  group.add(leftHStab);

  const animate = (delta: number, pitchDeg = 0) => {
    spinners.forEach((s) => {
      s.rotation.z += delta * 24.0;
    });
    const pitchDeflect = THREE.MathUtils.clamp(pitchDeg * 0.008, -0.28, 0.28);
    rightHStab.rotation.x = pitchDeflect;
    leftHStab.rotation.x = pitchDeflect;
  };

  return { group, name: 'Boeing 787-9 Dreamliner', type: 'boeing_787', animate };
}

/**
 * 3. BOEING 747-8 INTERCONTINENTAL ("Queen of the Skies")
 */
export function createBoeing747(): AircraftInstance {
  const group = new THREE.Group();
  group.name = 'Boeing747';

  const liveryTex = createFuselageLiveryTexture({
    stripeColor1: '#dc2626',
    stripeColor2: '#f59e0b',
    forwardHump: true,
  });

  const fuselageMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    roughness: 0.22,
    metalness: 0.16,
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.2,
  });

  const tailRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.28,
    metalness: 0.25,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.5,
  });

  const fuselageGeo = new THREE.CylinderGeometry(0.48, 0.48, 4.8, 32);
  fuselageGeo.rotateX(Math.PI / 2);
  group.add(new THREE.Mesh(fuselageGeo, fuselageMat));

  // Iconic 747 Forward Upper-Deck Hump
  const humpGeo = new THREE.CapsuleGeometry(0.32, 1.65, 16, 24);
  humpGeo.rotateX(Math.PI / 2);
  const hump = new THREE.Mesh(humpGeo, whiteMat);
  hump.position.set(0, 0.24, -1.15);
  hump.scale.set(0.95, 0.85, 1.0);
  group.add(hump);

  // Upper Deck Cockpit Windshield
  const cockpitGeo = new THREE.CapsuleGeometry(0.16, 0.24, 12, 20);
  cockpitGeo.rotateZ(Math.PI / 2);
  const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
  cockpit.position.set(0, 0.38, -1.94);
  cockpit.scale.set(0.88, 0.42, 0.9);
  cockpit.rotation.x = -0.32;
  group.add(cockpit);

  const nosePts = [
    new THREE.Vector2(0.48, 0.0),
    new THREE.Vector2(0.39, 0.45),
    new THREE.Vector2(0.22, 0.95),
    new THREE.Vector2(0.0, 1.25),
  ];
  const noseGeo = new THREE.LatheGeometry(nosePts, 32);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, whiteMat);
  nose.position.z = -2.4;
  group.add(nose);

  const tailPts = [
    new THREE.Vector2(0.48, 0.0),
    new THREE.Vector2(0.36, 0.8),
    new THREE.Vector2(0.16, 1.5),
    new THREE.Vector2(0.0, 1.9),
  ];
  const tailGeo = new THREE.LatheGeometry(tailPts, 28);
  tailGeo.rotateX(Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, whiteMat);
  tail.position.set(0, 0.0, 2.4);
  group.add(tail);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.85);
  wingShape.lineTo(3.75, 1.15);
  wingShape.lineTo(3.95, 1.45);
  wingShape.lineTo(3.75, 1.55);
  wingShape.lineTo(0, 0.75);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.015,
    bevelThickness: 0.015,
  });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, whiteMat);
  rightWing.position.set(0.38, -0.16, -0.1);
  rightWing.rotation.z = 0.055;
  group.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.set(-1, 1, 1);
  leftWing.position.set(-0.38, -0.16, -0.1);
  leftWing.rotation.z = -0.055;
  group.add(leftWing);

  // Four GEnx-2B Under-Wing Engines
  const spinners: THREE.Group[] = [];
  const enginePositions = [
    { x: 1.25, y: -0.36, z: -0.35 },
    { x: -1.25, y: -0.36, z: -0.35 },
    { x: 2.35, y: -0.26, z: 0.25 },
    { x: -2.35, y: -0.26, z: 0.25 },
  ];

  enginePositions.forEach((pos) => {
    const eng = createTurbofanEngine({
      radius: 0.21,
      length: 0.88,
      cowlColor: 0xf8fafc,
      chevron: true,
    });
    eng.nacelleGroup.position.set(pos.x, pos.y, pos.z);
    group.add(eng.nacelleGroup);
    spinners.push(eng.fanSpinner);

    const pylonGeo = new THREE.BoxGeometry(0.05, 0.2, 0.5);
    const pylon = new THREE.Mesh(pylonGeo, whiteMat);
    pylon.position.set(pos.x, pos.y + 0.15, pos.z + 0.08);
    group.add(pylon);
  });

  // Tall 747 Vertical Stabilizer Fin (Swept aft +Z)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.0, 1.55);
  finShape.lineTo(1.58, 1.55);
  finShape.lineTo(1.3, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: false });
  finGeo.rotateY(-Math.PI / 2);
  const fin = new THREE.Mesh(finGeo, tailRedMat);
  fin.position.set(0.03, 0.34, 2.35);
  group.add(fin);

  const hStabShape = new THREE.Shape();
  hStabShape.moveTo(0, -0.25);
  hStabShape.lineTo(1.35, 0.4);
  hStabShape.lineTo(1.35, 0.62);
  hStabShape.lineTo(0, 0.28);
  hStabShape.closePath();

  const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.04, bevelEnabled: false });
  hStabGeo.rotateX(Math.PI / 2);

  const rightHStab = new THREE.Mesh(hStabGeo, whiteMat);
  rightHStab.position.set(0.15, 0.08, 3.25);
  group.add(rightHStab);

  const leftHStab = rightHStab.clone();
  leftHStab.scale.set(-1, 1, 1);
  leftHStab.position.set(-0.15, 0.08, 3.25);
  group.add(leftHStab);

  const animate = (delta: number, pitchDeg = 0) => {
    spinners.forEach((s) => {
      s.rotation.z += delta * 24.0;
    });
    const pitchDeflect = THREE.MathUtils.clamp(pitchDeg * 0.008, -0.28, 0.28);
    rightHStab.rotation.x = pitchDeflect;
    leftHStab.rotation.x = pitchDeflect;
  };

  return { group, name: 'Boeing 747-8 Intercontinental', type: 'boeing_747', animate };
}

/**
 * 4. AIRBUS A380-800 SUPERJUMBO
 */
export function createAirbusA380(): AircraftInstance {
  const group = new THREE.Group();
  group.name = 'AirbusA380';

  const liveryTex = createFuselageLiveryTexture({
    stripeColor1: '#0284c7',
    stripeColor2: '#38bdf8',
    doubleDeck: true,
  });

  const fuselageMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    roughness: 0.22,
    metalness: 0.16,
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.2,
  });

  const airbusTealMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.26,
    metalness: 0.25,
  });

  const cockpitMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.5,
  });

  const fuselageGeo = new THREE.CylinderGeometry(0.52, 0.52, 4.5, 32);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
  fuselage.scale.set(0.96, 1.18, 1.0);
  group.add(fuselage);

  const nosePts = [
    new THREE.Vector2(0.52, 0.0),
    new THREE.Vector2(0.44, 0.48),
    new THREE.Vector2(0.26, 0.92),
    new THREE.Vector2(0.0, 1.15),
  ];
  const noseGeo = new THREE.LatheGeometry(nosePts, 32);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, whiteMat);
  nose.position.z = -2.25;
  nose.scale.set(0.96, 1.18, 1.0);
  group.add(nose);

  const cockpitGeo = new THREE.CapsuleGeometry(0.19, 0.28, 12, 20);
  cockpitGeo.rotateZ(Math.PI / 2);
  const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
  cockpit.position.set(0, 0.18, -2.82);
  cockpit.scale.set(0.9, 0.42, 0.95);
  cockpit.rotation.x = -0.35;
  group.add(cockpit);

  const tailPts = [
    new THREE.Vector2(0.52, 0.0),
    new THREE.Vector2(0.38, 0.8),
    new THREE.Vector2(0.18, 1.45),
    new THREE.Vector2(0.0, 1.85),
  ];
  const tailGeo = new THREE.LatheGeometry(tailPts, 28);
  tailGeo.rotateX(Math.PI / 2);
  const tail = new THREE.Mesh(tailGeo, whiteMat);
  tail.position.set(0, 0.0, 2.25);
  tail.scale.set(0.96, 1.18, 1.0);
  group.add(tail);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.95);
  wingShape.lineTo(4.0, 1.05);
  wingShape.lineTo(4.0, 1.45);
  wingShape.lineTo(0, 0.85);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.065,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.016,
    bevelThickness: 0.016,
  });
  wingGeo.rotateX(Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, whiteMat);
  rightWing.position.set(0.4, -0.22, -0.1);
  rightWing.rotation.z = 0.06;
  group.add(rightWing);

  const leftWing = rightWing.clone();
  leftWing.scale.set(-1, 1, 1);
  leftWing.position.set(-0.4, -0.22, -0.1);
  leftWing.rotation.z = -0.06;
  group.add(leftWing);

  const fenceGeo = new THREE.BoxGeometry(0.03, 0.36, 0.42);
  const rightFence = new THREE.Mesh(fenceGeo, airbusTealMat);
  rightFence.position.set(4.38, 0.04, 1.15);
  group.add(rightFence);

  const leftFence = rightFence.clone();
  leftFence.position.set(-4.38, 0.04, 1.15);
  group.add(leftFence);

  const spinners: THREE.Group[] = [];
  const enginePositions = [
    { x: 1.35, y: -0.42, z: -0.35 },
    { x: -1.35, y: -0.42, z: -0.35 },
    { x: 2.55, y: -0.32, z: 0.25 },
    { x: -2.55, y: -0.32, z: 0.25 },
  ];

  enginePositions.forEach((pos) => {
    const eng = createTurbofanEngine({
      radius: 0.24,
      length: 0.95,
      cowlColor: 0xf8fafc,
      chevron: false,
    });
    eng.nacelleGroup.position.set(pos.x, pos.y, pos.z);
    group.add(eng.nacelleGroup);
    spinners.push(eng.fanSpinner);

    const pylonGeo = new THREE.BoxGeometry(0.055, 0.22, 0.55);
    const pylon = new THREE.Mesh(pylonGeo, whiteMat);
    pylon.position.set(pos.x, pos.y + 0.16, pos.z + 0.08);
    group.add(pylon);
  });

  // Monumental A380 Vertical Stabilizer (Swept aft +Z)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.1, 1.72);
  finShape.lineTo(1.72, 1.72);
  finShape.lineTo(1.4, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.065, bevelEnabled: false });
  finGeo.rotateY(-Math.PI / 2);
  const fin = new THREE.Mesh(finGeo, airbusTealMat);
  fin.position.set(0.032, 0.45, 2.2);
  group.add(fin);

  const hStabShape = new THREE.Shape();
  hStabShape.moveTo(0, -0.3);
  hStabShape.lineTo(1.5, 0.42);
  hStabShape.lineTo(1.5, 0.68);
  hStabShape.lineTo(0, 0.32);
  hStabShape.closePath();

  const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.04, bevelEnabled: false });
  hStabGeo.rotateX(Math.PI / 2);

  const rightHStab = new THREE.Mesh(hStabGeo, whiteMat);
  rightHStab.position.set(0.18, 0.16, 3.15);
  group.add(rightHStab);

  const leftHStab = rightHStab.clone();
  leftHStab.scale.set(-1, 1, 1);
  leftHStab.position.set(-0.18, 0.16, 3.15);
  group.add(leftHStab);

  const animate = (delta: number, pitchDeg = 0) => {
    spinners.forEach((s) => {
      s.rotation.z += delta * 21.0;
    });
    const pitchDeflect = THREE.MathUtils.clamp(pitchDeg * 0.008, -0.28, 0.28);
    rightHStab.rotation.x = pitchDeflect;
    leftHStab.rotation.x = pitchDeflect;
  };

  return { group, name: 'Airbus A380-800 Superjumbo', type: 'airbus_a380', animate };
}

/**
 * 5. Supersonic Tactical Fighter Jet (F-22X)
 */
export function createFighterJet(): AircraftInstance {
  const group = new THREE.Group();
  group.name = 'FighterJet';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.35,
    metalness: 0.35,
  });

  const darkPanelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.5,
    metalness: 0.45,
  });

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.75,
  });

  const engineMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.2,
    metalness: 0.85,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.3,
    metalness: 0.2,
  });

  const fuselageGeo = new THREE.ConeGeometry(0.5, 4.2, 16);
  fuselageGeo.rotateX(-Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
  fuselage.position.z = -0.2;
  fuselage.scale.set(1.1, 0.55, 1);
  group.add(fuselage);

  const noseGeo = new THREE.ConeGeometry(0.2, 1.2, 12);
  noseGeo.rotateX(-Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.position.z = -2.7;
  nose.scale.set(1, 0.5, 1);
  group.add(nose);

  const pitotGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8);
  pitotGeo.rotateX(Math.PI / 2);
  const pitot = new THREE.Mesh(pitotGeo, engineMat);
  pitot.position.z = -3.4;
  group.add(pitot);

  const canopyGeo = new THREE.SphereGeometry(0.3, 16, 16);
  canopyGeo.scale(0.8, 0.9, 2.2);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.25, -0.8);
  group.add(canopy);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -1.0);
  wingShape.lineTo(2.4, 0.6);
  wingShape.lineTo(2.4, 1.0);
  wingShape.lineTo(0.5, 1.2);
  wingShape.lineTo(0, 1.0);
  wingShape.closePath();

  const wingGeoRight = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  });
  wingGeoRight.rotateX(Math.PI / 2);
  const wingRight = new THREE.Mesh(wingGeoRight, bodyMat);
  wingRight.position.set(0.3, -0.05, -0.2);
  group.add(wingRight);

  const wingLeft = wingRight.clone();
  wingLeft.scale.set(-1, 1, 1);
  wingLeft.position.set(-0.3, -0.05, -0.2);
  group.add(wingLeft);

  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.7, 1.1);
  finShape.lineTo(1.1, 1.1);
  finShape.lineTo(0.9, 0);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false });
  finGeo.rotateY(-Math.PI / 2);

  const rightFin = new THREE.Mesh(finGeo, darkPanelMat);
  rightFin.position.set(0.42, 0.1, 0.8);
  rightFin.rotation.z = -0.22;
  group.add(rightFin);

  const leftFin = rightFin.clone();
  leftFin.scale.set(-1, 1, 1);
  leftFin.position.set(-0.42, 0.1, 0.8);
  leftFin.rotation.z = 0.22;
  group.add(leftFin);

  const elevGeo = new THREE.BoxGeometry(0.85, 0.04, 0.55);
  const rightElev = new THREE.Mesh(elevGeo, bodyMat);
  rightElev.position.set(0.9, -0.02, 1.6);
  rightElev.rotation.y = 0.3;
  group.add(rightElev);

  const leftElev = rightElev.clone();
  leftElev.position.set(-0.9, -0.02, 1.6);
  leftElev.rotation.y = -0.3;
  group.add(leftElev);

  const nozzleGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.6, 16);
  nozzleGeo.rotateX(Math.PI / 2);

  const rightNozzle = new THREE.Mesh(nozzleGeo, engineMat);
  rightNozzle.position.set(0.28, -0.02, 1.8);
  group.add(rightNozzle);

  const leftNozzle = rightNozzle.clone();
  leftNozzle.position.set(-0.28, -0.02, 1.8);
  group.add(leftNozzle);

  const glowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const innerRingGeo = new THREE.RingGeometry(0.05, 0.16, 16);
  const glowRight = new THREE.Mesh(innerRingGeo, glowMat);
  glowRight.position.set(0.28, -0.02, 2.11);
  group.add(glowRight);

  const glowLeft = glowRight.clone();
  glowLeft.position.set(-0.28, -0.02, 2.11);
  group.add(glowLeft);

  const tipGeo = new THREE.BoxGeometry(0.08, 0.08, 0.8);
  const rightTip = new THREE.Mesh(tipGeo, accentMat);
  rightTip.position.set(2.7, -0.05, 0.6);
  group.add(rightTip);

  const leftTip = rightTip.clone();
  leftTip.position.set(-2.7, -0.05, 0.6);
  group.add(leftTip);

  return { group, name: 'F-22X Supersonic Testbed', type: 'fighter_jet' };
}

/**
 * 6. Aerobatic Stunt Plane (Extra 330SC)
 */
export function createStuntPlane(): AircraftInstance {
  const group = new THREE.Group();
  group.name = 'StuntPlane';

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.25,
    metalness: 0.2,
  });

  const blackTrimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.4,
    metalness: 0.3,
  });

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.1,
    metalness: 0.15,
    transparent: true,
    opacity: 0.8,
  });

  const propMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.3,
    metalness: 0.5,
  });

  const spinnerMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.2,
    metalness: 0.8,
  });

  const fuselageGeo = new THREE.CylinderGeometry(0.15, 0.38, 3.4, 16);
  fuselageGeo.rotateX(Math.PI / 2);
  const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
  fuselage.position.z = 0.1;
  group.add(fuselage);

  const cowlGeo = new THREE.CylinderGeometry(0.37, 0.39, 0.6, 16);
  cowlGeo.rotateX(Math.PI / 2);
  const cowl = new THREE.Mesh(cowlGeo, blackTrimMat);
  cowl.position.z = -1.7;
  group.add(cowl);

  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0, -2.05);

  const spinnerGeo = new THREE.ConeGeometry(0.18, 0.4, 16);
  spinnerGeo.rotateX(-Math.PI / 2);
  const spinner = new THREE.Mesh(spinnerGeo, spinnerMat);
  spinner.position.z = -0.15;
  propGroup.add(spinner);

  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI) / 3;
    const bladeGeo = new THREE.BoxGeometry(0.08, 0.85, 0.02);
    const blade = new THREE.Mesh(bladeGeo, propMat);
    blade.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0);
    blade.rotation.z = angle;
    blade.rotation.x = -0.15;
    propGroup.add(blade);
  }
  group.add(propGroup);

  const canopyGeo = new THREE.SphereGeometry(0.3, 16, 12);
  canopyGeo.scale(0.9, 0.9, 2.0);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.25, -0.3);
  group.add(canopy);

  const wingGeo = new THREE.BoxGeometry(4.0, 0.06, 0.85);
  const wing = new THREE.Mesh(wingGeo, bodyMat);
  wing.position.set(0, 0.0, -0.5);
  group.add(wing);

  const stripeGeo = new THREE.BoxGeometry(0.2, 0.065, 0.86);
  const stripeR = new THREE.Mesh(stripeGeo, blackTrimMat);
  stripeR.position.set(1.4, 0, -0.5);
  group.add(stripeR);

  const stripeL = stripeR.clone();
  stripeL.position.set(-1.4, 0, -0.5);
  group.add(stripeL);

  const vFinGeo = new THREE.BoxGeometry(0.05, 0.8, 0.6);
  const vFin = new THREE.Mesh(vFinGeo, blackTrimMat);
  vFin.position.set(0, 0.42, 1.7);
  group.add(vFin);

  const hFinGeo = new THREE.BoxGeometry(1.4, 0.04, 0.45);
  const hFin = new THREE.Mesh(hFinGeo, bodyMat);
  hFin.position.set(0, 0.1, 1.75);
  group.add(hFin);

  const strutMat = new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.8 });
  const strutGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6);

  const rightStrut = new THREE.Mesh(strutGeo, strutMat);
  rightStrut.position.set(0.35, -0.35, -0.8);
  rightStrut.rotation.z = -0.25;
  group.add(rightStrut);

  const spatGeo = new THREE.SphereGeometry(0.12, 12, 10);
  spatGeo.scale(0.6, 1.0, 1.6);
  const rightSpat = new THREE.Mesh(spatGeo, blackTrimMat);
  rightSpat.position.set(0.48, -0.62, -0.8);
  group.add(rightSpat);

  const leftStrut = rightStrut.clone();
  leftStrut.position.set(-0.35, -0.35, -0.8);
  leftStrut.rotation.z = 0.25;
  group.add(leftStrut);

  const leftSpat = rightSpat.clone();
  leftSpat.position.set(-0.48, -0.62, -0.8);
  group.add(leftSpat);

  const animate = (delta: number) => {
    propGroup.rotation.z += delta * 25.0;
  };

  return { group, name: 'Extra 330SC Aerobatic', type: 'stunt_plane', animate };
}
