import * as THREE from 'three';

export class Horse {
  constructor(scene) {
    this.scene = scene;
    
    // Horse Group container
    this.mesh = new THREE.Group();
    this.scene.add(this.mesh);

    // Particle pool for hoof trails
    this.hoofSparkles = [];
    this.maxSparkles = 150;
    this.sparkleIndex = 0;
    
    // Animation state variables
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.isAirborne = false;
    this.animTime = 0;

    // References to articulated parts for procedural movement
    this.body = null;
    this.neck = null;
    this.head = null;
    this.tail = null;
    
    this.thighFL = null; this.shinFL = null; this.hoofFL = null;
    this.thighFR = null; this.shinFR = null; this.hoofFR = null;
    this.thighBL = null; this.shinBL = null; this.hoofBL = null;
    this.thighBR = null; this.shinBR = null; this.hoofBR = null;

    this.init();
  }

  init() {
    this.createModel();
    this.createHoofSparkleSystem();
  }

  createModel() {
    // 1. Materials Configuration
    // Ultra glossy metallic cosmic black body
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x07040d,          // Deep obsidian black
      metalness: 0.95,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      flatShading: true         // Low-poly stylized finish
    });

    // Cosmic Neon Cyan glow trim
    const neonCyan = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      roughness: 0.2,
      flatShading: true
    });

    // Cosmic Neon Magenta glow trim
    const neonMagenta = new THREE.MeshPhysicalMaterial({
      color: 0xec4899,
      emissive: 0xdb2777,
      roughness: 0.2,
      flatShading: true
    });

    // --- CONSTRUCT SKELETAL PARTS ---

    // A. Main Body Barrel
    const bodyGroup = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(2.0, 1.2, 1.1); // Stretched sleek body
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bodyGroup.add(bodyMesh);
    
    // Cosmic Spine Trim
    const spineGeo = new THREE.BoxGeometry(2.1, 0.1, 0.15);
    const spine = new THREE.Mesh(spineGeo, neonCyan);
    spine.position.y = 0.61;
    bodyMesh.add(spine);

    this.body = bodyGroup;
    this.mesh.add(bodyGroup);

    // B. Neck & Head
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0.9, 0.4, 0); // Shoulder anchor point
    
    const neckGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.4, 5);
    neckGeo.rotateZ(-0.4); // Slant neck forward
    const neckMesh = new THREE.Mesh(neckGeo, bodyMat);
    neckMesh.position.set(0.2, 0.5, 0);
    neckMesh.castShadow = true;
    neckGroup.add(neckMesh);

    // Cosmic Glowing Mane
    const maneGeo = new THREE.BoxGeometry(0.1, 1.3, 0.35);
    const mane = new THREE.Mesh(maneGeo, neonMagenta);
    mane.position.set(-0.25, 0.5, 0);
    mane.rotation.z = -0.4;
    neckMesh.add(mane);

    // Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0.4, 1.1, 0); // Neck joint to head

    const headGeo = new THREE.BoxGeometry(0.9, 0.5, 0.5);
    const headMesh = new THREE.Mesh(headGeo, bodyMat);
    headMesh.position.set(0.25, -0.1, 0);
    headMesh.rotation.z = -0.3; // Tilt snout down
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Ears
    const earLGeo = new THREE.ConeGeometry(0.1, 0.35, 4);
    const earL = new THREE.Mesh(earLGeo, bodyMat);
    earL.position.set(0.0, 0.25, 0.2);
    const earR = earL.clone();
    earR.position.z = -0.2;
    headGroup.add(earL);
    headGroup.add(earR);

    // Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(0.15, 0.08, 0.08);
    const eyeL = new THREE.Mesh(eyeGeo, neonCyan);
    eyeL.position.set(0.35, -0.05, 0.26);
    const eyeR = eyeL.clone();
    eyeR.position.z = -0.26;
    headGroup.add(eyeL);
    headGroup.add(eyeR);

    this.head = headGroup;
    neckGroup.add(headGroup);
    this.neck = neckGroup;
    bodyGroup.add(neckGroup);

    // C. Articulated Legs (4 Legs)
    // Anchors relative to body coordinates:
    // Front legs anchor near x = 0.8, y = -0.4, z = +/- 0.42
    // Back legs anchor near x = -0.8, y = -0.4, z = +/- 0.42

    const legZOffset = 0.42;
    
    // 1. Front Left Leg
    this.thighFL = this.createLegPart(0.3, 0.9, 0.3, bodyMat);
    this.shinFL = this.createLegPart(0.2, 0.8, 0.2, bodyMat);
    this.hoofFL = this.createHoofPart(neonCyan);
    this.assembleLeg(this.thighFL, this.shinFL, this.hoofFL, 0.8, -0.4, legZOffset);

    // 2. Front Right Leg
    this.thighFR = this.createLegPart(0.3, 0.9, 0.3, bodyMat);
    this.shinFR = this.createLegPart(0.2, 0.8, 0.2, bodyMat);
    this.hoofFR = this.createHoofPart(neonCyan);
    this.assembleLeg(this.thighFR, this.shinFR, this.hoofFR, 0.8, -0.4, -legZOffset);

    // 3. Back Left Leg
    this.thighBL = this.createLegPart(0.35, 1.0, 0.35, bodyMat); // Hind thighs are beefier
    this.shinBL = this.createLegPart(0.22, 0.9, 0.22, bodyMat);
    this.hoofBL = this.createHoofPart(neonMagenta);
    this.assembleLeg(this.thighBL, this.shinBL, this.hoofBL, -0.8, -0.4, legZOffset);

    // 4. Back Right Leg
    this.thighBR = this.createLegPart(0.35, 1.0, 0.35, bodyMat);
    this.shinBR = this.createLegPart(0.22, 0.9, 0.22, bodyMat);
    this.hoofBR = this.createHoofPart(neonMagenta);
    this.assembleLeg(this.thighBR, this.shinBR, this.hoofBR, -0.8, -0.4, -legZOffset);

    // D. Cosmic Flowing Tail
    const tailGroup = new THREE.Group();
    tailGroup.position.set(-1.0, 0.4, 0); // Anchors at rump

    const tailPartCount = 4;
    this.tailSegments = [];
    
    let lastSegment = tailGroup;
    for (let i = 0; i < tailPartCount; i++) {
      const segGeo = new THREE.BoxGeometry(0.35, 0.15, 0.15);
      // Gradually make tail pieces smaller and slant downwards
      segGeo.translate(-0.15, 0, 0); 
      
      const seg = new THREE.Mesh(segGeo, neonMagenta);
      seg.position.set(-0.25, i === 0 ? 0 : -0.08, 0);
      seg.rotation.z = -0.15;
      
      lastSegment.add(seg);
      this.tailSegments.push(seg);
      lastSegment = seg;
    }
    
    this.tail = tailGroup;
    bodyGroup.add(tailGroup);

    // Adjust entire horse vertical offset so legs touch ground naturally
    this.body.position.y = 1.6; // Base ground height offset
  }

  createLegPart(w, h, d, mat) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2; // Move pivot to joint top
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return group;
  }

  createHoofPart(mat) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.25), mat);
    mesh.position.y = -0.1;
    mesh.castShadow = true;
    group.add(mesh);
    return group;
  }

  assembleLeg(thigh, shin, hoof, x, y, z) {
    thigh.position.set(x, y, z);
    
    // Connect shin to thigh bottom
    const thighH = thigh.children[0].geometry.parameters.height;
    shin.position.y = -thighH;
    thigh.add(shin);

    // Connect hoof to shin bottom
    const shinH = shin.children[0].geometry.parameters.height;
    hoof.position.y = -shinH;
    shin.add(hoof);

    this.body.add(thigh);
  }

  createHoofSparkleSystem() {
    // Sparkle elements pool setup (recycled particles)
    const sparkleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const cyanSparkleMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.8 });
    const magentaSparkleMat = new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.8 });

    for (let i = 0; i < this.maxSparkles; i++) {
      const isCyan = i % 2 === 0;
      const mesh = new THREE.Mesh(sparkleGeo, isCyan ? cyanSparkleMat : magentaSparkleMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.hoofSparkles.push({
        mesh,
        life: 0,
        maxLife: 0,
        velocity: new THREE.Vector3()
      });
    }
  }

  spawnHoofSparkle(originPos, count = 1) {
    for (let c = 0; c < count; c++) {
      // Recycle particle using ring buffer index
      const sparkle = this.hoofSparkles[this.sparkleIndex];
      this.sparkleIndex = (this.sparkleIndex + 1) % this.maxSparkles;

      sparkle.mesh.position.copy(originPos);
      sparkle.mesh.visible = true;
      sparkle.mesh.scale.set(1.0, 1.0, 1.0);
      
      sparkle.life = 0.4 + Math.random() * 0.4; // Time to live (seconds)
      sparkle.maxLife = sparkle.life;

      // Random outwards splatter velocity
      sparkle.velocity.set(
        (Math.random() - 0.5) * 4.0,
        Math.random() * 3.0 + 1.0,
        (Math.random() - 0.5) * 4.0
      );
    }
  }

  getHoofWorldPositions() {
    const positions = [];
    const hooves = [this.hoofFL, this.hoofFR, this.hoofBL, this.hoofBR];
    
    hooves.forEach(hoof => {
      if (hoof) {
        const worldPos = new THREE.Vector3();
        hoof.getWorldPosition(worldPos);
        positions.push(worldPos);
      }
    });

    return positions;
  }

  update(dt, velocity, isAirborne) {
    this.velocity.copy(velocity);
    this.speed = velocity.length();
    this.isAirborne = isAirborne;

    this.animTime += dt * Math.max(1.0, this.speed * 1.5); // Animation frequency speeds up with travel

    this.animateJoints(dt);
    this.updateSparkles(dt);
  }

  animateJoints(dt) {
    const time = this.animTime;
    
    // Default resets
    let neckZRot = 0.0;
    let headZRot = -0.3;
    let tailXRot = 0.0;
    let bodyYPos = 1.6;
    let bodyZRot = 0.0; // Pitch angle

    let thighFLRot = 0, shinFLRot = 0;
    let thighFRRot = 0, shinFRRot = 0;
    let thighBLRot = 0, shinBLRot = 0;
    let thighBRRot = 0, shinBRRot = 0;

    if (this.isAirborne) {
      // --- ANTIGRAVITY GLIDE / JUMP ANIMATION ---
      // Majestic float: legs extended, tail floating high, body tilted up
      bodyYPos = 1.8;
      
      const glideOffset = Math.sin(this.animTime * 1.5) * 0.05; // Gentle hover bob
      bodyYPos += glideOffset;

      // Slanted slightly upwards based on climb
      const verticalSpeed = this.velocity.y;
      bodyZRot = THREE.MathUtils.clamp(-verticalSpeed * 0.04, -0.35, 0.15);

      neckZRot = 0.25; // Hold head up proudly
      headZRot = -0.15;

      // Front legs reach forward
      thighFLRot = 0.45;
      shinFLRot = -0.3; // Knee bends backwards
      
      thighFRRot = 0.35;
      shinFRRot = -0.25;

      // Back legs trail backwards
      thighBLRot = -0.65;
      shinBLRot = 0.45; // Knee joint bends forward (creepy/majestic low-poly aesthetic)

      thighBRRot = -0.55;
      shinBRRot = 0.35;

      // Tail swishes floating high
      tailXRot = -0.6 + Math.sin(this.animTime * 2.0) * 0.08;

      // CONTINUOUSLY emit particles from hooves during antigravity glide!
      if (Math.random() < 0.25) {
        const hoofWorldPositions = this.getHoofWorldPositions();
        hoofWorldPositions.forEach(pos => this.spawnHoofSparkle(pos, 1));
      }

    } else if (this.speed < 0.15) {
      // --- IDLE STATE ---
      // Gentle breathing scale, swishing tail, occasional neck bobs
      const breath = Math.sin(window.performance.now() * 0.0015);
      
      bodyYPos = 1.6 + breath * 0.015;
      neckZRot = -0.05 + breath * 0.02;
      headZRot = -0.25 + breath * 0.04;
      
      // Symmetrical posture
      thighFLRot = 0.05; shinFLRot = 0.05;
      thighFRRot = -0.05; shinFRRot = 0.05;
      thighBLRot = -0.05; shinBLRot = 0.05;
      thighBRRot = 0.05; shinBRRot = 0.05;

      // Gentle tail swish
      tailXRot = Math.sin(window.performance.now() * 0.002) * 0.12;

    } else if (this.speed <= 3.8) {
      // --- TROT ANIMATION (Moderate Speed) ---
      // Diagonal pair stride (Front-Left & Back-Right move together; Front-Right & Back-Left move together)
      const swingRange = 0.35;
      const cycle = time * 1.8; // cycle frequency
      
      const strideL = Math.sin(cycle);
      const strideR = -strideL;

      // Body bobs at twice the stride frequency
      bodyYPos = 1.6 + Math.abs(Math.sin(cycle)) * 0.1;
      bodyZRot = Math.sin(cycle) * 0.04;

      // Diagonal pairs
      thighFLRot = strideL * swingRange;
      shinFLRot = (strideL > 0 ? -strideL * 0.3 : 0);

      thighBRRot = strideL * (swingRange * 0.9);
      shinBRRot = (strideL < 0 ? -strideL * 0.2 : 0);

      thighFRRot = strideR * swingRange;
      shinFRRot = (strideR > 0 ? -strideR * 0.3 : 0);

      thighBLRot = strideR * (swingRange * 0.9);
      shinBLRot = (strideR < 0 ? -strideR * 0.2 : 0);

      neckZRot = Math.sin(cycle * 2.0) * 0.06;
      headZRot = -0.25 + Math.sin(cycle * 2.0) * 0.04;
      tailXRot = -0.2 + Math.sin(cycle) * 0.15;

      // Spawn minor trail sparkles on ground impact
      if (Math.abs(strideL) > 0.9 && Math.random() < 0.3) {
        const hoofWorldPositions = this.getHoofWorldPositions();
        this.spawnHoofSparkle(hoofWorldPositions[0], 1); // Front Left
        this.spawnHoofSparkle(hoofWorldPositions[3], 1); // Back Right
      }

    } else {
      // --- GALLOP ANIMATION (High Speed) ---
      // Rotary gallop cycle: powerful leaps, body pitching forward and back, legs fully compressing/extending
      const gallopCycle = time * 2.0;
      const swingRange = 0.7;
      
      // Rotary phase offsets (FR, FL, BL, BR sequence)
      const strideFL = Math.sin(gallopCycle);
      const strideFR = Math.sin(gallopCycle - 0.5);
      const strideBL = Math.sin(gallopCycle + 1.2);
      const strideBR = Math.sin(gallopCycle + 1.7);

      // Severe body bobbing and heavy pitch pitching
      bodyYPos = 1.55 + Math.sin(gallopCycle * 2.0) * 0.25;
      bodyZRot = Math.sin(gallopCycle) * 0.25; // Tilted forward/backward heavily

      thighFLRot = strideFL * swingRange;
      shinFLRot = (strideFL > 0 ? -strideFL * 0.45 : 0.08);

      thighFRRot = strideFR * swingRange;
      shinFRRot = (strideFR > 0 ? -strideFR * 0.45 : 0.08);

      thighBLRot = strideBL * swingRange;
      shinBLRot = (strideBL < 0 ? -strideBL * 0.35 : 0.08);

      thighBRRot = strideBR * swingRange;
      shinBRRot = (strideBR < 0 ? -strideBR * 0.35 : 0.08);

      neckZRot = Math.sin(gallopCycle) * 0.12 - 0.05;
      headZRot = -0.3 + Math.sin(gallopCycle) * 0.08;
      
      tailXRot = -0.4 + Math.sin(gallopCycle) * 0.3;

      // Heavy sparkles generated under full gallop!
      if (Math.random() < 0.6) {
        const hoofWorldPositions = this.getHoofWorldPositions();
        // Spawn sparks at the back feet
        this.spawnHoofSparkle(hoofWorldPositions[2], 2);
        this.spawnHoofSparkle(hoofWorldPositions[3], 2);
      }
    }

    // Apply calculated bone rotations
    this.body.position.y = bodyYPos;
    this.body.rotation.z = bodyZRot;
    
    this.neck.rotation.z = neckZRot;
    this.head.rotation.z = headZRot;
    
    // Front Legs
    this.thighFL.rotation.z = thighFLRot;
    this.shinFL.rotation.z = shinFLRot;
    
    this.thighFR.rotation.z = thighFRRot;
    this.shinFR.rotation.z = shinFRRot;

    // Back Legs
    this.thighBL.rotation.z = thighBLRot;
    this.shinBL.rotation.z = shinBLRot;

    this.thighBR.rotation.z = thighBRRot;
    this.shinBR.rotation.z = shinBRRot;

    // Wiggle Tail Segments sequentially for fluid physics vibe
    this.tailSegments.forEach((seg, idx) => {
      seg.rotation.z = (tailXRot / this.tailSegments.length) + Math.sin(this.animTime + idx * 0.4) * 0.04;
    });
  }

  updateSparkles(dt) {
    this.hoofSparkles.forEach(sparkle => {
      if (sparkle.life <= 0) return;

      sparkle.life -= dt;
      if (sparkle.life <= 0) {
        sparkle.mesh.visible = false;
        return;
      }

      // Physics motion
      sparkle.mesh.position.addScaledVector(sparkle.velocity, dt);
      sparkle.velocity.y -= 9.8 * dt; // Gravity pull

      // Taper down scale as it dies
      const lifeRatio = sparkle.life / sparkle.maxLife;
      sparkle.mesh.scale.setScalar(lifeRatio);
    });
  }
}
