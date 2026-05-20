import * as THREE from 'three';

// Procedural 2D Value Noise for smooth sand dunes
const NOISE_SCALE = 0.015;
const NOISE_HEIGHT = 8.0;

function hash2D(x, z) {
  const sx = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return sx - Math.floor(sx);
}

function noise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  // Cubic interpolation
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);

  const a = hash2D(ix, iz);
  const b = hash2D(ix + 1, iz);
  const c = hash2D(ix, iz + 1);
  const d = hash2D(ix + 1, iz + 1);

  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, ux),
    THREE.MathUtils.lerp(c, d, ux),
    uz
  );
}

// Fractional Brownian Motion for dune layers
export function getTerrainHeight(x, z) {
  const nx = x * NOISE_SCALE;
  const nz = z * NOISE_SCALE;
  
  // Layer 1: Large rolling dunes
  let height = noise2D(nx, nz) * NOISE_HEIGHT;
  // Layer 2: Medium ridges
  height += noise2D(nx * 3.1, nz * 2.8) * (NOISE_HEIGHT * 0.25);
  // Layer 3: Tiny sand ripples
  height += noise2D(nx * 12.0, nz * 11.0) * 0.15;
  
  return height;
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.collidables = [];
    this.floatingIslands = [];
    this.oasisCenter = new THREE.Vector3(120, 0, -80);
    this.oasisRadius = 35;
    
    this.particles = null;
    this.particleCount = 600;
    
    this.init();
  }

  init() {
    this.createSkybox();
    this.createLights();
    this.createTerrain();
    this.createOasis();
    this.createAncientRuins();
    this.createFloatingIslands();
    this.createSandWindParticles();
  }

  createSkybox() {
    // Atmospheric color gradients
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec3 dir = normalize(vWorldPosition);
        // Cinematic warm cinematic color palette:
        // Deep purple sky at zenith, glowing warm gold/orange at horizon
        float h = dir.y * 0.5 + 0.5;
        
        vec3 zenithColor = vec3(0.08, 0.03, 0.15); // Deep space purple
        vec3 horizonColor = vec3(0.95, 0.45, 0.20); // Warm fiery orange
        vec3 goldColor = vec3(0.98, 0.75, 0.35); // Golden twilight
        
        vec3 finalColor = mix(horizonColor, zenithColor, pow(h, 1.5));
        finalColor = mix(finalColor, goldColor, exp(-abs(dir.y) * 8.0));
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const skyGeo = new THREE.SphereGeometry(1500, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false
    });

    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Twin Suns in skybox
    this.createTwinSuns();
  }

  createTwinSuns() {
    const sunGroup = new THREE.Group();

    // Sun 1: Giant cinematic Golden Sun
    const sun1Geo = new THREE.SphereGeometry(32, 16, 16);
    const sun1Mat = new THREE.MeshBasicMaterial({
      color: 0xffe294,
      transparent: true,
      opacity: 0.95
    });
    const sun1 = new THREE.Mesh(sun1Geo, sun1Mat);
    sun1.position.set(-300, 180, -600);
    sunGroup.add(sun1);

    // Sun 1 Corona Flare
    const corona1Geo = new THREE.RingGeometry(35, 60, 32);
    const corona1Mat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15
    });
    const corona1 = new THREE.Mesh(corona1Geo, corona1Mat);
    corona1.position.copy(sun1.position);
    corona1.lookAt(0, 0, 0);
    sunGroup.add(corona1);

    // Sun 2: Smaller Sci-fi Magenta/Purple Sun
    const sun2Geo = new THREE.SphereGeometry(18, 16, 16);
    const sun2Mat = new THREE.MeshBasicMaterial({
      color: 0xd946ef,
      transparent: true,
      opacity: 0.9
    });
    const sun2 = new THREE.Mesh(sun2Geo, sun2Mat);
    sun2.position.set(-180, 240, -580);
    sunGroup.add(sun2);

    this.scene.add(sunGroup);
  }

  createLights() {
    // Ambient light - cinematic long shadows need cool deep purple ambient tones
    const ambientLight = new THREE.AmbientLight(0x2d174d, 0.85);
    this.scene.add(ambientLight);

    // Primary golden directional light (representing Sun 1)
    const sunLight = new THREE.DirectionalLight(0xffb74d, 2.2);
    sunLight.position.set(-300, 180, -600);
    sunLight.castShadow = true;
    
    // Shadow quality configuration
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 100;
    sunLight.shadow.camera.far = 1200;
    const d = 250;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;

    this.scene.add(sunLight);

    // Secondary magenta directional light (filling the shadows with sci-fi glow)
    const fillLight = new THREE.DirectionalLight(0xba55d3, 0.95);
    fillLight.position.set(-180, 240, -580);
    this.scene.add(fillLight);
  }

  createTerrain() {
    const terrainSize = 1000;
    const segments = 128;
    
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    terrainGeo.rotateX(-Math.PI / 2); // Orient flat

    // Update vertices dynamically based on procedural sand dune noise
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      
      // Keep oasis center flatter for the lake pool
      const dx = x - this.oasisCenter.x;
      const dz = z - this.oasisCenter.z;
      const distToOasis = Math.sqrt(dx * dx + dz * dz);
      
      let targetH = getTerrainHeight(x, z);
      
      if (distToOasis < this.oasisRadius) {
        const factor = distToOasis / this.oasisRadius;
        // Smoothly taper to a pool bowl
        const oasisH = -4.0 + (factor * factor * 4.0);
        targetH = THREE.MathUtils.lerp(oasisH, targetH, Math.min(1.0, factor * 2.0));
      }
      
      posAttr.setY(i, targetH);
    }
    
    terrainGeo.computeVertexNormals();

    // Stylized sand material (rough, warm glowing gold, with purplish shadows)
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xdf843a,          // Golden-orange base
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true         // Gives sand dunes a gorgeous low-poly stylized shading
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, sandMat);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);
    
    // Save terrain reference for logic updates
    this.terrainMesh = terrainMesh;
  }

  createOasis() {
    this.oasisCenter.y = getTerrainHeight(this.oasisCenter.x, this.oasisCenter.z);
    
    // 1. Water Plane
    const waterGeo = new THREE.CircleGeometry(16, 32);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,           // Cosmic neon cyan
      emissive: 0x083344,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.9,         // See-through
      ior: 1.333,
      transparent: true,
      opacity: 0.8
    });
    
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotateX(-Math.PI / 2);
    waterMesh.position.set(this.oasisCenter.x, -2.8, this.oasisCenter.z);
    this.scene.add(waterMesh);

    // Water Glow PointLight
    const waterLight = new THREE.PointLight(0x22d3ee, 5, 45, 1.5);
    waterLight.position.set(this.oasisCenter.x, -1, this.oasisCenter.z);
    this.scene.add(waterLight);

    // 2. Oasis Rocks & Vegetation
    const numRocks = 12;
    for (let i = 0; i < numRocks; i++) {
      const angle = (i / numRocks) * Math.PI * 2;
      const r = 14.5 + Math.random() * 4.0;
      const rx = this.oasisCenter.x + Math.cos(angle) * r;
      const rz = this.oasisCenter.z + Math.sin(angle) * r;
      const ry = getTerrainHeight(rx, rz) - 0.2;
      
      const rockGeo = new THREE.DodecahedronGeometry(1.5 + Math.random() * 2, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x2e193c,
        roughness: 0.9,
        flatShading: true
      });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, ry, rz);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      rock.receiveShadow = true;
      
      this.scene.add(rock);
      this.collidables.push(rock);
    }

    // 3. Glowing Oasis Palms
    const numTrees = 5;
    for (let i = 0; i < numTrees; i++) {
      const angle = (i / numTrees) * Math.PI * 2 + Math.random();
      const r = 21.0 + Math.random() * 5.0;
      const tx = this.oasisCenter.x + Math.cos(angle) * r;
      const tz = this.oasisCenter.z + Math.sin(angle) * r;
      const ty = getTerrainHeight(tx, tz) - 0.5;

      const tree = this.createCosmicPalm(tx, ty, tz);
      this.scene.add(tree);
      this.collidables.push(tree);
    }
  }

  createCosmicPalm(x, y, z) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    // Curved Trunk
    const trunkHeight = 10 + Math.random() * 6;
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.7, trunkHeight, 5, 5);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x1d112d,
      roughness: 0.8,
      flatShading: true
    });
    
    // Slant trunk organic-style
    const pos = trunkGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const py = pos.getY(i);
      const factor = (py + trunkHeight/2) / trunkHeight; // 0 to 1
      const curve = Math.sin(factor * Math.PI * 0.5) * 1.5;
      pos.setX(i, pos.getX(i) + curve);
    }
    trunkGeo.computeVertexNormals();

    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    // Glowing Palm Leaves
    const leafMat = new THREE.MeshPhysicalMaterial({
      color: 0xd946ef,
      emissive: 0x4a044e,
      roughness: 0.3,
      metalness: 0.1,
      flatShading: true
    });

    const leafCount = 8;
    for (let i = 0; i < leafCount; i++) {
      const leafGeo = new THREE.ConeGeometry(1.5, 6, 4);
      leafGeo.rotateX(Math.PI / 3); // Droop down
      leafGeo.translate(0, 0, 3);
      
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = trunkHeight;
      leaf.position.x = Math.sin(trunkHeight / trunkHeight * Math.PI * 0.5) * 1.5; // Offset based on trunk bend
      leaf.rotation.y = (i / leafCount) * Math.PI * 2;
      leaf.rotation.z = 0.2; // Slight droop
      
      leaf.castShadow = true;
      treeGroup.add(leaf);
    }

    // Top Glowing Crystal/Fruit
    const fruitGeo = new THREE.OctahedronGeometry(0.8, 0);
    const fruitMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const fruit = new THREE.Mesh(fruitGeo, fruitMat);
    fruit.position.set(Math.sin(trunkHeight / trunkHeight * Math.PI * 0.5) * 1.5, trunkHeight + 0.5, 0);
    treeGroup.add(fruit);

    return treeGroup;
  }

  createAncientRuins() {
    // Generate scattered ancient pillars and columns deterministically in the desert
    // Deterministic random spots
    const ruinPositions = [
      { x: -50, z: -80, scale: 1.2 },
      { x: -140, z: 20, scale: 1.0 },
      { x: 80, z: 160, scale: 1.5 },
      { x: 180, z: -20, scale: 0.9 },
      { x: -250, z: -250, scale: 1.8 }
    ];

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x231836,           // Dark purple ruins
      roughness: 0.9,
      flatShading: true
    });

    const trimMat = new THREE.MeshPhysicalMaterial({
      color: 0xff7e47,
      emissive: 0x7c2d12,
      roughness: 0.4,
      flatShading: true
    });

    ruinPositions.forEach((ruin, ruinIdx) => {
      const rx = ruin.x;
      const rz = ruin.z;
      const ry = getTerrainHeight(rx, rz);
      
      const ruinGroup = new THREE.Group();
      ruinGroup.position.set(rx, ry, rz);
      ruinGroup.scale.set(ruin.scale, ruin.scale, ruin.scale);

      // Structure: 4 standing pillars supporting a cracked crossbeam (stonehenge arch structure)
      const pillarH = 12.0;
      const radius = 0.8;
      
      const pillarOffsets = [
        { x: -4, z: -4 },
        { x: 4, z: -4 },
        { x: -4, z: 4 },
        { x: 4, z: 4 }
      ];

      pillarOffsets.forEach((off, idx) => {
        // Crumbled ratio
        const crumble = (ruinIdx * 7 + idx * 13) % 10 < 3; // some pillars are broken
        const actualH = crumble ? pillarH * 0.4 : pillarH;
        
        const pillarGeo = new THREE.CylinderGeometry(radius * 0.8, radius, actualH, 6);
        const pillar = new THREE.Mesh(pillarGeo, stoneMat);
        pillar.position.set(off.x, actualH / 2, off.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        ruinGroup.add(pillar);
        
        if (!crumble) {
          // Glowing trim rings
          const ringGeo = new THREE.CylinderGeometry(radius * 0.85, radius * 0.85, 0.4, 6);
          const ring = new THREE.Mesh(ringGeo, trimMat);
          ring.position.set(off.x, actualH * 0.75, off.z);
          ruinGroup.add(ring);
        }

        this.collidables.push(pillar);
      });

      // Crossbeams for the uncrumbled pillars
      const beamGeo = new THREE.BoxGeometry(10.0, 1.2, 1.6);
      const beam = new THREE.Mesh(beamGeo, stoneMat);
      beam.position.set(0, pillarH + 0.6, 0);
      beam.rotation.y = (ruinIdx * 45) * Math.PI / 180;
      beam.castShadow = true;
      beam.receiveShadow = true;
      
      ruinGroup.add(beam);
      this.collidables.push(beam);
      
      this.scene.add(ruinGroup);
    });
  }

  createFloatingIslands() {
    // Generate major floating rock formations high in the sky
    const islandParams = [
      { x: -70, y: 18, z: -100, rx: 18, rz: 14, col: 0x221337 },
      { x: 50, y: 28, z: -60, rx: 25, rz: 20, col: 0x1d0f30 },
      { x: 0, y: 38, z: 80, rx: 20, rz: 16, col: 0x24143a },
      { x: -160, y: 32, z: 60, rx: 24, rz: 24, col: 0x1d112d },
      { x: 120, y: 48, z: 120, rx: 16, rz: 16, col: 0x2a1642 }
    ];

    islandParams.forEach((param, idx) => {
      const island = new THREE.Group();
      island.position.set(param.x, param.y, param.z);

      // Main Flat Platform Rock (faceted geometric Dodecahedrons stretched out)
      const segmentsX = 4;
      const segmentsZ = 4;
      const rockGeo = new THREE.BoxGeometry(param.rx, 5, param.rz, segmentsX, 1, segmentsZ);

      // Deform rock geometry bottom to taper down to a point (floating mountain style)
      const pos = rockGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);

        if (py < 0) {
          // Bottom face tapered inwards
          const shrinkFactor = 0.2;
          pos.setX(i, px * shrinkFactor + (hash2D(i, idx) - 0.5) * 2.0);
          pos.setZ(i, pz * shrinkFactor + (hash2D(i + 9, idx) - 0.5) * 2.0);
          pos.setY(i, py - 4.0 - Math.random() * 2.0); // Make it deep & conical
        } else {
          // Flatten top face slightly
          pos.setY(i, py + (hash2D(i, idx) - 0.5) * 0.5);
        }
      }
      rockGeo.computeVertexNormals();

      const rockMat = new THREE.MeshStandardMaterial({
        color: param.col,
        roughness: 0.9,
        flatShading: true
      });

      const rockMesh = new THREE.Mesh(rockGeo, rockMat);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      island.add(rockMesh);

      // Glowing Neon Crystals jutting out of the sides and bottom
      const crystalCount = 3 + (idx % 3);
      const crystalMat = new THREE.MeshPhysicalMaterial({
        color: 0x06b6d4,
        emissive: 0x0e7490,
        roughness: 0.2,
        metalness: 0.2,
        flatShading: true
      });

      for (let c = 0; c < crystalCount; c++) {
        const cryGeo = new THREE.ConeGeometry(0.8, 4, 4);
        cryGeo.rotateX(Math.PI / 2); // Orient pointing outward
        const cry = new THREE.Mesh(cryGeo, crystalMat);
        
        // Random position along the rim
        const angle = (c / crystalCount) * Math.PI * 2;
        const cx = Math.cos(angle) * (param.rx * 0.45);
        const cz = Math.sin(angle) * (param.rz * 0.45);
        const cy = -1.5 - Math.random() * 2.5;

        cry.position.set(cx, cy, cz);
        cry.lookAt(new THREE.Vector3(cx * 2, cy - 2, cz * 2).add(island.position)); // Face outwards & down
        
        island.add(cry);
      }

      // Add a PointLight underneath to cast light on the sand dunes beneath it
      const rockLight = new THREE.PointLight(0xa855f7, 4, 30, 1.2);
      rockLight.position.set(0, -5, 0);
      island.add(rockLight);

      this.scene.add(island);

      // Save references for floating platforms so horse can land on them!
      this.floatingIslands.push({
        group: island,
        mesh: rockMesh,
        y: param.y + 2.5, // Landing height (half of box Y height)
        rx: param.rx,
        rz: param.rz
      });
    });
  }

  createSandWindParticles() {
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const velocities = [];

    // Spawn wind dust motes scattered around the player area
    for (let i = 0; i < this.particleCount; i++) {
      const px = (Math.random() - 0.5) * 350;
      const py = Math.random() * 40; // Dune level to sky levels
      const pz = (Math.random() - 0.5) * 350;
      
      pos.push(px, py, pz);
      
      // Wind blows primarily along the X/Z axis
      velocities.push(
        -15 - Math.random() * 15,  // Fast blow X
        -0.5 + Math.random() * 1.0, // Floating wobble Y
        (Math.random() - 0.5) * 2   // Minor Z variance
      );
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

    // Glowing golden dust motes
    const mat = new THREE.PointsMaterial({
      color: 0xffd54f,
      size: 0.45,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particles = new THREE.Points(geo, mat);
    this.scene.add(particles);

    this.particles = particles;
    this.particleVelocities = velocities;
  }

  updateParticles(dt, centerPos) {
    if (!this.particles) return;

    const posAttr = this.particles.geometry.attributes.position;
    const array = posAttr.array;

    for (let i = 0; i < this.particleCount; i++) {
      const idx = i * 3;
      
      // Update position based on velocity
      array[idx] += this.particleVelocities[idx] * dt;
      array[idx + 1] += this.particleVelocities[idx + 1] * dt;
      array[idx + 2] += this.particleVelocities[idx + 2] * dt;

      // Wrap particles if they go too far from the horse/player center (keeps them localized)
      const dx = array[idx] - centerPos.x;
      const dz = array[idx + 2] - centerPos.z;

      const boundary = 180.0;
      if (Math.abs(dx) > boundary) {
        array[idx] = centerPos.x + (dx > 0 ? -boundary : boundary);
        array[idx + 1] = Math.random() * 40;
      }
      if (Math.abs(dz) > boundary) {
        array[idx + 2] = centerPos.z + (dz > 0 ? -boundary : boundary);
      }
      
      // Floor checking
      const currentH = getTerrainHeight(array[idx], array[idx + 2]);
      if (array[idx + 1] < currentH) {
        array[idx + 1] = currentH + Math.random() * 30; // Float high again
      }
    }

    posAttr.needsUpdate = true;
  }
}
