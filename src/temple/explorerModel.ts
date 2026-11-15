import * as THREE from 'three';

export type ExplorerAction = 'run' | 'jump' | 'slide' | 'crash';

export interface ExplorerRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  scarfTail: THREE.Mesh;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  shadowDisc: THREE.Mesh;
  updatePose: (params: {
    time: number;
    runPhase: number;
    action: ExplorerAction;
    jumpVelY: number;
    doubleJumpSpin?: number;
    slideProgress: number;
    slideElapsed?: number;
    slideRemaining?: number;
    slideHeld?: boolean;
    lateralVel: number;
    playerY: number;
    groundY: number;
    shieldActive: boolean;
    speedActive: boolean;
    magnetActive?: boolean;
    feverActive?: boolean;
    hurtFlash: boolean;
  }) => void;
  getFootWorldPositions: (leftOut: THREE.Vector3, rightOut: THREE.Vector3) => void;
  dispose: () => void;
}

export function createExplorerRig(castShadow: boolean): ExplorerRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const jacketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc28e54,
      roughness: 0.72,
      metalness: 0.04,
    })
  );
  const shirtMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6dcc8,
      roughness: 0.85,
      metalness: 0.0,
    })
  );
  const pantsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b483d,
      roughness: 0.82,
      metalness: 0.03,
    })
  );
  const leatherMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4b2f1d,
      roughness: 0.58,
      metalness: 0.1,
    })
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdba078,
      roughness: 0.65,
      metalness: 0.02,
    })
  );
  const scarfMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb93829,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2b144,
      roughness: 0.3,
      metalness: 0.85,
    })
  );
  const hatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6b492c,
      roughness: 0.74,
      metalness: 0.05,
    })
  );

  const makeMesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    return mesh;
  };

  // Pelvis / Belt base
  const pelvis = makeMesh(trackGeo(new THREE.BoxGeometry(0.42, 0.2, 0.26)), pantsMat);
  pelvis.position.set(0, 0.94, 0);
  bodyPivot.add(pelvis);

  const belt = makeMesh(trackGeo(new THREE.BoxGeometry(0.45, 0.08, 0.29)), leatherMat);
  belt.position.set(0, 0.06, 0);
  pelvis.add(belt);

  const buckle = makeMesh(trackGeo(new THREE.BoxGeometry(0.1, 0.07, 0.04)), brassMat);
  buckle.position.set(0, 0, -0.15);
  belt.add(buckle);

  // Torso Group
  const torso = new THREE.Group();
  torso.position.set(0, 1.04, 0);
  bodyPivot.add(torso);

  const chest = makeMesh(trackGeo(new THREE.BoxGeometry(0.46, 0.5, 0.27)), jacketMat);
  chest.position.set(0, 0.25, 0);
  torso.add(chest);

  const shirtTrim = makeMesh(trackGeo(new THREE.BoxGeometry(0.18, 0.36, 0.28)), shirtMat);
  shirtTrim.position.set(0, 0.26, -0.01);
  torso.add(shirtTrim);

  // Explorer Backpack + Rolled Bedroll
  const pack = makeMesh(trackGeo(new THREE.BoxGeometry(0.36, 0.42, 0.2)), leatherMat);
  pack.position.set(0, 0.26, 0.22);
  torso.add(pack);

  const bedroll = makeMesh(
    trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.4, 12)),
    pantsMat
  );
  bedroll.rotation.z = Math.PI * 0.5;
  bedroll.position.set(0, 0.5, 0.21);
  torso.add(bedroll);

  // Scarf Collar & Trailing Ribbon
  const collar = makeMesh(trackGeo(new THREE.TorusGeometry(0.14, 0.045, 8, 16)), scarfMat);
  collar.rotation.x = Math.PI * 0.5;
  collar.position.set(0, 0.52, 0);
  torso.add(collar);

  const scarfTail = makeMesh(trackGeo(new THREE.BoxGeometry(0.12, 0.03, 0.56)), scarfMat);
  scarfTail.geometry.translate(0, 0, 0.26);
  scarfTail.position.set(0.06, 0.51, 0.12);
  torso.add(scarfTail);

  // Head + Explorer Hat
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.58, 0);
  torso.add(headGroup);

  const head = makeMesh(trackGeo(new THREE.SphereGeometry(0.16, 16, 14)), skinMat);
  head.position.set(0, 0.14, 0);
  headGroup.add(head);

  const hatBrim = makeMesh(trackGeo(new THREE.CylinderGeometry(0.34, 0.36, 0.03, 18)), hatMat);
  hatBrim.position.set(0, 0.25, -0.01);
  hatBrim.rotation.x = -0.1;
  headGroup.add(hatBrim);

  const hatCrown = makeMesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 0.16, 14)), hatMat);
  hatCrown.position.set(0, 0.33, 0);
  hatCrown.rotation.x = -0.1;
  headGroup.add(hatCrown);

  const hatBand = makeMesh(trackGeo(new THREE.CylinderGeometry(0.183, 0.185, 0.04, 14)), scarfMat);
  hatBand.position.set(0, 0.27, 0);
  hatBand.rotation.x = -0.1;
  headGroup.add(hatBand);

  // Arms
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.29, 0.46, 0);
    torso.add(shoulder);

    const upperArm = makeMesh(
      trackGeo(new THREE.CapsuleGeometry(0.065, 0.2, 6, 10)),
      jacketMat
    );
    upperArm.position.set(0, -0.15, 0);
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.3, 0);
    shoulder.add(elbow);

    const forearm = makeMesh(
      trackGeo(new THREE.CapsuleGeometry(0.055, 0.18, 6, 10)),
      skinMat
    );
    forearm.position.set(0, -0.14, 0);
    elbow.add(forearm);

    const glove = makeMesh(trackGeo(new THREE.SphereGeometry(0.062, 10, 8)), leatherMat);
    glove.position.set(0, -0.27, 0);
    elbow.add(glove);

    return { shoulder, elbow };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Legs
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.9, 0);
    bodyPivot.add(hip);

    const thigh = makeMesh(trackGeo(new THREE.CapsuleGeometry(0.085, 0.28, 6, 10)), pantsMat);
    thigh.position.set(0, -0.22, 0);
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    hip.add(knee);

    const shin = makeMesh(trackGeo(new THREE.CapsuleGeometry(0.072, 0.26, 6, 10)), leatherMat);
    shin.position.set(0, -0.2, 0);
    knee.add(shin);

    const boot = makeMesh(trackGeo(new THREE.BoxGeometry(0.14, 0.11, 0.25)), leatherMat);
    boot.position.set(0, -0.4, -0.04);
    knee.add(boot);

    return { hip, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Soft contact shadow disc projected on ground below explorer
  const shadowGeo = trackGeo(new THREE.CircleGeometry(0.55, 20));
  shadowGeo.rotateX(-Math.PI * 0.5);
  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x050908,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  );
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.set(0, 0.03, 0);
  root.add(shadowDisc);

  // Protective Shield Energy Aura (attached to explorer root)
  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(0, 0.92, 0);
  shieldGroup.visible = false;
  root.add(shieldGroup);

  const shieldShellMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x3ef2cf,
      transparent: true,
      opacity: 0.2,
      wireframe: true,
      depthWrite: false,
    })
  );
  const shieldShell = new THREE.Mesh(
    trackGeo(new THREE.IcosahedronGeometry(0.92, 1)),
    shieldShellMat
  );
  shieldGroup.add(shieldShell);

  const shieldRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x7effe6,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const shieldRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.95, 0.03, 8, 32)),
    shieldRingMat
  );
  shieldRing.rotation.x = Math.PI * 0.5;
  shieldGroup.add(shieldRing);

  const speedRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffcf45,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const speedHalo = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.72, 0.025, 8, 28)),
    speedRingMat
  );
  speedHalo.position.set(0, 0.88, 0.1);
  speedHalo.visible = false;
  root.add(speedHalo);

  const magnetRingMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  const magnetHalo = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.84, 0.024, 8, 26)),
    magnetRingMat
  );
  magnetHalo.rotation.x = Math.PI * 0.5;
  magnetHalo.position.set(0, 0.96, 0);
  magnetHalo.visible = false;
  root.add(magnetHalo);

  const updatePose: ExplorerRig['updatePose'] = ({
    time,
    runPhase,
    action,
    jumpVelY,
    doubleJumpSpin = 0,
    slideProgress,
    slideElapsed,
    slideRemaining,
    slideHeld,
    lateralVel,
    playerY,
    groundY,
    shieldActive,
    speedActive,
    magnetActive = false,
    feverActive = false,
    hurtFlash,
  }) => {
    const bankAngle = THREE.MathUtils.clamp(-lateralVel * 0.045, -0.34, 0.34);

    // Invulnerability blink visibility
    bodyPivot.visible = hurtFlash ? Math.floor(time * 22) % 2 === 0 : true;

    // Power-up aura animations
    shieldGroup.visible = shieldActive;
    if (shieldActive) {
      shieldGroup.position.y = action === 'slide' ? 0.52 : 0.92;
      shieldGroup.scale.setScalar(action === 'slide' ? 0.85 : 1);
      shieldShell.rotation.y = time * 1.8;
      shieldShell.rotation.x = Math.sin(time * 2.1) * 0.25;
      shieldRing.rotation.z = time * 2.8;
      shieldRing.rotation.y = Math.cos(time * 2.4) * 0.35;
      shieldShellMat.opacity = 0.18 + Math.sin(time * 7) * 0.05;
    }

    speedHalo.visible = speedActive || feverActive;
    if (speedActive || feverActive) {
      speedRingMat.color.setHex(feverActive ? 0xfef08a : 0xffcf45);
      speedHalo.position.y = action === 'slide' ? 0.5 : 0.88;
      speedHalo.rotation.z = time * (feverActive ? 9.5 : 6.5);
      speedHalo.scale.setScalar((feverActive ? 1.04 : 0.92) + Math.sin(time * 12) * 0.08);
    }

    magnetHalo.visible = magnetActive;
    if (magnetActive) {
      magnetHalo.position.y = (action === 'slide' ? 0.54 : 0.96) + Math.sin(time * 6) * 0.08;
      magnetHalo.rotation.z = time * 4.5;
      magnetHalo.scale.setScalar(0.95 + Math.cos(time * 8) * 0.09);
    }

    // Contact shadow tracks ground height below explorer
    const clearance = Math.max(0, playerY - groundY);
    if (groundY < -5) {
      shadowDisc.visible = false;
    } else {
      shadowDisc.visible = true;
      shadowDisc.position.y = groundY - playerY + 0.03;
      const s = THREE.MathUtils.clamp(1.0 - clearance * 0.18, 0.42, 1.0);
      shadowDisc.scale.set(s, 1, s);
      shadowMat.opacity = THREE.MathUtils.clamp(0.42 - clearance * 0.12, 0.08, 0.42);
    }

    // Scarf aerodynamic flutter
    scarfTail.rotation.x = 0.24 + Math.sin(time * (speedActive ? 24 : 16)) * 0.18;
    scarfTail.rotation.y = Math.cos(time * 11) * 0.18 - bankAngle * 0.6;

    if (action === 'crash') {
      // Dramatic tumble back pose on Game Over
      bodyPivot.position.set(0, -0.45, 0.1);
      bodyPivot.rotation.set(1.38, 0.28, -0.35);
      torso.rotation.set(-0.1, 0, 0);
      headGroup.rotation.set(-0.35, 0.2, 0);
      leftLeg.hip.rotation.set(0.45, 0, -0.25);
      leftLeg.knee.rotation.set(-0.7, 0, 0);
      rightLeg.hip.rotation.set(0.25, 0, 0.22);
      rightLeg.knee.rotation.set(-0.4, 0, 0);
      leftArm.shoulder.rotation.set(-0.6, 0, -0.75);
      leftArm.elbow.rotation.set(0.6, 0, 0);
      rightArm.shoulder.rotation.set(-0.4, 0, 0.82);
      rightArm.elbow.rotation.set(0.5, 0, 0);
      return;
    }

    if (action === 'slide') {
      // Sleek feet-first baseball/parkour slide:
      // Smooth ease-in once at slide start, holds steady low while S/Down is held, smooth ease-out on release.
      let blend: number;
      if (slideElapsed !== undefined && slideRemaining !== undefined) {
        const easeIn = Math.min(1, Math.max(0, slideElapsed / 0.13));
        const easeOut = slideHeld ? 1 : Math.min(1, Math.max(0, slideRemaining / 0.14));
        blend = Math.min(easeIn, easeOut);
      } else {
        const p = Math.min(1, Math.max(0, slideProgress));
        const easeIn = Math.min(1, p * 4.5);
        const easeOut = slideHeld ? 1 : Math.min(1, (1 - p) * 4.5);
        blend = Math.min(easeIn, easeOut);
      }
      const holdRipple = blend > 0.92 ? Math.sin(time * 22) * 0.015 : 0;

      bodyPivot.position.set(0, -0.22 * blend + holdRipple * 0.3, 0.08 * blend);
      bodyPivot.rotation.set(0.98 * blend, 0.1 * blend, bankAngle * 0.45);

      torso.rotation.set(0.08 * blend, -0.1 * blend, 0);
      // Tilt head forward so explorer looks ahead and hat stays proud above shoulders
      headGroup.rotation.set(-0.72 * blend, 0, 0);

      // Right leg extended straight forward (-Z) leading the slide
      rightLeg.hip.rotation.set(0.52 * blend, 0, 0.06);
      rightLeg.knee.rotation.set(-0.08 * blend, 0, 0);

      // Left leg bent and tucked neatly alongside
      leftLeg.hip.rotation.set(0.42 * blend, 0, -0.34 * blend);
      leftLeg.knee.rotation.set(-1.38 * blend, 0, 0);

      // Left arm raised slightly for balance, right arm trailing behind
      leftArm.shoulder.rotation.set(0.55 * blend + holdRipple, 0, -0.32 * blend);
      leftArm.elbow.rotation.set(0.95 * blend, 0, 0);
      rightArm.shoulder.rotation.set(-0.78 * blend - holdRipple, 0, 0.42 * blend);
      rightArm.elbow.rotation.set(0.35 * blend, 0, 0);
      return;
    }

    if (action === 'jump') {
      // Dynamic mid-air tuck OR 360 aerial somersault on Double Jump!
      const riseFactor = THREE.MathUtils.clamp(jumpVelY / 9.5, -1, 1);
      if (doubleJumpSpin > 0) {
        const tuck = Math.sin(doubleJumpSpin * Math.PI);
        bodyPivot.position.set(0, 0.32 * tuck, 0);
        bodyPivot.rotation.set(doubleJumpSpin * Math.PI * 2, 0, bankAngle * 0.5);
        torso.rotation.set(0.55 * tuck, 0, 0);
        headGroup.rotation.set(-0.25 * tuck, 0, 0);
        leftLeg.hip.rotation.set(1.25 * tuck, 0, 0);
        leftLeg.knee.rotation.set(-1.65 * tuck, 0, 0);
        rightLeg.hip.rotation.set(1.1 * tuck, 0, 0);
        rightLeg.knee.rotation.set(-1.55 * tuck, 0, 0);
        leftArm.shoulder.rotation.set(0.95 * tuck, 0, -0.3);
        leftArm.elbow.rotation.set(1.25, 0, 0);
        rightArm.shoulder.rotation.set(0.95 * tuck, 0, 0.3);
        rightArm.elbow.rotation.set(1.25, 0, 0);
        return;
      }

      bodyPivot.position.set(0, 0.04, 0);
      bodyPivot.rotation.set(-riseFactor * 0.18, 0, bankAngle);

      torso.rotation.set(0.22 - riseFactor * 0.12, 0, 0);
      headGroup.rotation.set(-0.1, 0, 0);

      // Split hurdle pose
      leftLeg.hip.rotation.set(0.75 + riseFactor * 0.25, 0, 0);
      leftLeg.knee.rotation.set(-1.15, 0, 0);
      rightLeg.hip.rotation.set(-0.35 + riseFactor * 0.2, 0, 0);
      rightLeg.knee.rotation.set(-0.65, 0, 0);

      leftArm.shoulder.rotation.set(1.25 * riseFactor + 0.4, 0, -0.22);
      leftArm.elbow.rotation.set(0.85, 0, 0);
      rightArm.shoulder.rotation.set(-0.65 + riseFactor * 0.4, 0, 0.22);
      rightArm.elbow.rotation.set(0.95, 0, 0);
      return;
    }

    // Energetic Forward Run Cycle (character runs toward -Z, so +hip.rotation.x swings leg forward!)
    const stride = Math.sin(runPhase);
    const bounce = Math.abs(Math.cos(runPhase)) * 0.075;

    bodyPivot.position.set(0, bounce, 0);
    bodyPivot.rotation.set(0.08, Math.sin(runPhase) * 0.04, bankAngle);

    torso.rotation.set(0.22, -stride * 0.09, -bankAngle * 0.25);
    headGroup.rotation.set(-0.14, stride * 0.05, 0);

    // Legs
    leftLeg.hip.rotation.set(stride * 0.92, 0, 0);
    leftLeg.knee.rotation.set(
      stride > 0 ? -stride * 0.45 - 0.18 : stride * 0.72 - 0.55,
      0,
      0
    );

    rightLeg.hip.rotation.set(-stride * 0.92, 0, 0);
    rightLeg.knee.rotation.set(
      -stride > 0 ? stride * 0.45 - 0.18 : -stride * 0.72 - 0.55,
      0,
      0
    );

    // Counter-swinging arms
    leftArm.shoulder.rotation.set(-stride * 0.85, 0, -0.14);
    leftArm.elbow.rotation.set(1.05 + Math.max(0, -stride) * 0.35, 0, 0);

    rightArm.shoulder.rotation.set(stride * 0.85, 0, 0.14);
    rightArm.elbow.rotation.set(1.05 + Math.max(0, stride) * 0.35, 0, 0);
  };

  const getFootWorldPositions = (leftOut: THREE.Vector3, rightOut: THREE.Vector3) => {
    leftOut.set(0, -0.42, 0);
    rightOut.set(0, -0.42, 0);
    leftLeg.knee.localToWorld(leftOut);
    rightLeg.knee.localToWorld(rightOut);
  };

  return {
    root,
    bodyPivot,
    torso,
    headGroup,
    scarfTail,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    shadowDisc,
    updatePose,
    getFootWorldPositions,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
