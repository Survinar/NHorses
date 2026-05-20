import * as THREE from 'three';
import { getTerrainHeight } from './Environment.js';

export class GameLogic {
  constructor(scene, horse, environment, controls, audioManager) {
    this.scene = scene;
    this.horse = horse;
    this.environment = environment;
    this.controls = controls;
    this.audioManager = audioManager;

    // Movement & Physics parameters
    this.horsePosition = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.headingAngle = 0; // Radian heading direction
    
    this.maxSpeedNormal = 6.0;
    this.maxSpeedGallop = 12.0;
    this.accelRate = 12.0;
    this.decelRate = 6.0;
    this.turnSpeed = 1.8;

    // Gravity settings
    this.standardGravity = 28.0;
    this.antiGravity = 5.0; // Float low gravity
    this.isAirborne = false;
    this.onPlatform = null; // Stored platform index if landed

    // Gameplay parameters
    this.orbCount = 0;
    this.boostFuel = 1.0; // 0.0 to 1.0 (Full)
    this.isGameOver = false;
    this.reserveTimer = 10.0; // 10 seconds reserve countdown
    this.inReserve = false;

    // Orb management
    this.orbs = [];
    this.orbCountToSpawn = 18;

    // DOM UI bindings
    this.ui = {
      orbCount: document.getElementById('orb-count'),
      boostCharge: document.getElementById('boost-charge'),
      boostStatus: document.getElementById('boost-status'),
      speed: document.getElementById('telemetry-speed'),
      alt: document.getElementById('telemetry-alt'),
      hudTip: document.getElementById('dynamic-tip')
    };

    this.highScore = parseInt(localStorage.getItem('antigravity_highscore') || '0', 10);

    this.init();
  }

  init() {
    // Determine initial ground Y coordinate
    this.horsePosition.y = getTerrainHeight(0, 0);
    this.horse.mesh.position.copy(this.horsePosition);

    // Initial spawn of energy orbs
    this.spawnOrbs();
  }

  spawnOrbs() {
    const orbGeo = new THREE.DodecahedronGeometry(0.65, 1);
    
    // Glossy glowing orb materials
    const cyanOrbMat = new THREE.MeshPhysicalMaterial({
      color: 0x00ffff,
      emissive: 0x0891b2,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });

    const goldOrbMat = new THREE.MeshPhysicalMaterial({
      color: 0xffd700,
      emissive: 0xb45309,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });

    for (let i = 0; i < this.orbCountToSpawn; i++) {
      const isCyan = i % 2 === 0;
      const mesh = new THREE.Mesh(orbGeo, isCyan ? cyanOrbMat : goldOrbMat);
      
      // Spawn some on the ground dunes, some high in the air near floating islands
      let ox = (Math.random() - 0.5) * 500;
      let oz = (Math.random() - 0.5) * 500;
      let oy = 0;

      const nearPlatform = i % 2 === 0 && this.environment.floatingIslands.length > 0;
      
      if (nearPlatform) {
        // Place orb directly on a floating island!
        const islandIdx = Math.floor(Math.random() * this.environment.floatingIslands.length);
        const island = this.environment.floatingIslands[islandIdx];
        ox = island.group.position.x + (Math.random() - 0.5) * (island.rx - 4);
        oz = island.group.position.z + (Math.random() - 0.5) * (island.rz - 4);
        oy = island.y + 2.5 + Math.random() * 2.0; // hover above island
      } else {
        // Dune placement
        oy = getTerrainHeight(ox, oz) + 1.8 + Math.random() * 8.0; // hover above dunes
      }

      mesh.position.set(ox, oy, oz);
      this.scene.add(mesh);

      // Add soft pulsing light inside orb
      const light = new THREE.PointLight(isCyan ? 0x22d3ee : 0xfbbf24, 3, 10, 1.5);
      mesh.add(light);

      this.orbs.push({
        mesh,
        baseY: oy,
        pulseOffset: Math.random() * Math.PI * 2,
        isCyan
      });
    }
  }

  relocateOrb(orb) {
    let ox = (Math.random() - 0.5) * 600;
    let oz = (Math.random() - 0.5) * 600;
    let oy = 0;

    const nearPlatform = Math.random() < 0.45 && this.environment.floatingIslands.length > 0;
    
    if (nearPlatform) {
      const islandIdx = Math.floor(Math.random() * this.environment.floatingIslands.length);
      const island = this.environment.floatingIslands[islandIdx];
      ox = island.group.position.x + (Math.random() - 0.5) * (island.rx - 4);
      oz = island.group.position.z + (Math.random() - 0.5) * (island.rz - 4);
      oy = island.y + 2.2 + Math.random() * 2.0;
    } else {
      oy = getTerrainHeight(ox, oz) + 1.8 + Math.random() * 10.0;
    }

    orb.mesh.position.set(ox, oy, oz);
    orb.baseY = oy;
  }

  restart() {
    this.orbCount = 0;
    this.boostFuel = 1.0;
    this.isGameOver = false;
    this.inReserve = false;
    this.reserveTimer = 10.0;
    
    this.horsePosition.set(0, getTerrainHeight(0, 0), 0);
    this.velocity.set(0, 0, 0);
    this.headingAngle = 0;
    
    this.horse.mesh.position.copy(this.horsePosition);
    this.horse.mesh.rotation.y = 0;
    this.isAirborne = false;
    this.onPlatform = null;

    // Reset UI
    this.ui.orbCount.innerText = "00";
    this.ui.boostCharge.style.width = "100%";
    this.ui.boostCharge.classList.remove('depleted');
    this.ui.boostStatus.innerText = "READY";
    this.ui.boostStatus.style.color = "";
    
    // Relocate all orbs
    this.orbs.forEach(orb => this.relocateOrb(orb));
  }

  update(dt) {
    if (this.isGameOver) return;

    this.handleInput(dt);
    this.applyPhysics(dt);
    this.checkCollisions(dt);
    this.updateOrbAnimations(dt);
    this.updateHUD(dt);
  }

  handleInput(dt) {
    const keys = this.controls.keys;

    // 1. Steering (A/D or Left/Right)
    if (keys.left) {
      this.headingAngle += this.turnSpeed * dt;
    }
    if (keys.right) {
      this.headingAngle -= this.turnSpeed * dt;
    }

    // Wrap heading angle
    this.headingAngle = (this.headingAngle + Math.PI * 2) % (Math.PI * 2);
    this.horse.mesh.rotation.y = this.headingAngle;

    // 2. Speed acceleration logic (W/S or Up/Down)
    let targetSpeed = 0;
    let currentMax = keys.shift && this.boostFuel > 0.01 ? this.maxSpeedGallop : this.maxSpeedNormal;
    
    if (keys.forward) targetSpeed = currentMax;
    if (keys.backward) targetSpeed = -this.maxSpeedNormal * 0.4; // Slow reverse

    const headingDir = new THREE.Vector3(Math.cos(this.headingAngle), 0, -Math.sin(this.headingAngle));
    
    // Projects current horizontal velocity along horse heading
    let forwardVelScalar = this.velocity.dot(headingDir);
    
    if (forwardVelScalar < targetSpeed) {
      forwardVelScalar = Math.min(targetSpeed, forwardVelScalar + this.accelRate * dt);
    } else if (forwardVelScalar > targetSpeed) {
      forwardVelScalar = Math.max(targetSpeed, forwardVelScalar - this.decelRate * dt);
    }

    // Set horizontal velocities
    this.velocity.x = headingDir.x * forwardVelScalar;
    this.velocity.z = headingDir.z * forwardVelScalar;

    // 3. Jump Mechanic (Spacebar) - Antigravity Leap
    if (keys.space && !this.isAirborne) {
      this.isAirborne = true;
      this.onPlatform = null;
      
      const hasBoost = this.boostFuel > 0.15;
      
      if (hasBoost) {
        // High launch thruster!
        this.velocity.y = 12.5; // High upward velocity
        this.boostFuel = Math.max(0, this.boostFuel - 0.22); // Drains boost chunk
        this.audioManager.playLeap();
      } else {
        // Small standard jump
        this.velocity.y = 5.5;
        this.audioManager.playHoofbeat(this.maxSpeedNormal, false); // Thud sound
      }
    }

    // 4. Boost Fuel Draining
    if (keys.shift && keys.forward && !this.isAirborne && this.boostFuel > 0) {
      // Galloping burns fuel
      this.boostFuel = Math.max(0, this.boostFuel - dt * 0.08);
    }

    // 5. Airborne micro-control glide
    if (this.isAirborne && this.boostFuel > 0) {
      if (keys.space) {
        // Hover thruster: slow down descent and give slight upward nudge
        if (this.velocity.y < 2.0) {
          this.velocity.y += 4.5 * dt; // Hold lift
          this.boostFuel = Math.max(0, this.boostFuel - dt * 0.12); // Steady drain
        }
      }
    }
  }

  applyPhysics(dt) {
    // Determine gravity: standard vs low-gravity antigravity float
    const gravityForce = (this.isAirborne && this.boostFuel > 0.01) ? this.antiGravity : this.standardGravity;
    
    if (this.isAirborne) {
      this.velocity.y -= gravityForce * dt;
    }

    // Position updates
    this.horsePosition.addScaledVector(this.velocity, dt);
  }

  checkCollisions(dt) {
    // 1. Dune Ground checking
    const groundHeight = getTerrainHeight(this.horsePosition.x, this.horsePosition.z);

    // 2. Floating Island landing checking
    let landingHeight = groundHeight;
    let isOnAnIsland = false;
    let islandRef = null;

    for (let i = 0; i < this.environment.floatingIslands.length; i++) {
      const island = this.environment.floatingIslands[i];
      const dx = this.horsePosition.x - island.group.position.x;
      const dz = this.horsePosition.z - island.group.position.z;

      // Platform bounding check (using bounding box radius)
      if (Math.abs(dx) < island.rx * 0.5 && Math.abs(dz) < island.rz * 0.5) {
        // Horse is above/inside this platform column
        landingHeight = island.y;
        isOnAnIsland = true;
        islandRef = i;
        break;
      }
    }

    // Perform landing
    if (isOnAnIsland) {
      // Landing on floating island
      if (this.velocity.y <= 0 && this.horsePosition.y <= landingHeight && this.horsePosition.y >= landingHeight - 1.8) {
        this.horsePosition.y = landingHeight;
        this.velocity.y = 0;
        this.isAirborne = false;
        this.onPlatform = islandRef;
      }
    }

    // Landing on standard desert floor
    if (!isOnAnIsland || this.horsePosition.y < groundHeight) {
      if (this.horsePosition.y <= groundHeight) {
        this.horsePosition.y = groundHeight;
        this.velocity.y = 0;
        
        if (this.isAirborne) {
          this.isAirborne = false;
          // Spawn impact dust/sparkles at hooves
          const hoofPos = this.horse.getHoofWorldPositions();
          hoofPos.forEach(pos => this.horse.spawnHoofSparkle(pos, 3));
        }
        this.onPlatform = null;
      }
    }

    // Apply resolved position to 3D mesh
    this.horse.mesh.position.copy(this.horsePosition);

    // 3. Collision with pillars/stone blocks (basic push-away collision)
    this.environment.collidables.forEach(col => {
      const colPos = new THREE.Vector3();
      col.getWorldPosition(colPos);
      
      const dx = this.horsePosition.x - colPos.x;
      const dz = this.horsePosition.z - colPos.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      
      const minDistance = 2.4; // cylinder boundaries
      if (dist < minDistance && Math.abs(this.horsePosition.y - colPos.y) < 6.0) {
        // Push horse away
        const pushX = (dx / dist) * (minDistance - dist);
        const pushZ = (dz / dist) * (minDistance - dist);
        
        this.horsePosition.x += pushX;
        this.horsePosition.z += pushZ;
        this.horse.mesh.position.copy(this.horsePosition);
        
        // Retard velocity
        this.velocity.x *= 0.2;
        this.velocity.z *= 0.2;
      }
    });

    // 4. Energy Orb collection checks
    const colDistToOrb = 2.4;
    
    this.orbs.forEach(orb => {
      const dist = this.horsePosition.distanceTo(orb.mesh.position);
      if (dist < colDistToOrb) {
        // Collect!
        this.audioManager.playOrbCollect();
        
        this.orbCount++;
        this.boostFuel = Math.min(1.0, this.boostFuel + (orb.isCyan ? 0.25 : 0.35)); // Replenish thruster
        
        // Animate collected orb burst sparkles
        this.horse.spawnHoofSparkle(orb.mesh.position, 12);
        
        // Relocate orb
        this.relocateOrb(orb);
      }
    });
  }

  updateOrbAnimations(dt) {
    const time = window.performance.now() * 0.002;
    
    this.orbs.forEach(orb => {
      // Rotation
      orb.mesh.rotation.x += dt * 1.5;
      orb.mesh.rotation.y += dt * 1.0;
      
      // Floating wave Y bobbing
      orb.mesh.position.y = orb.baseY + Math.sin(time + orb.pulseOffset) * 0.45;
    });
  }

  updateHUD(dt) {
    // Trigger rhythmic sound effects (hoofbeats)
    const horizSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    this.audioManager.playHoofbeat(horizSpeed, this.isAirborne);

    // 1. Orb Counter
    const padStr = this.orbCount < 10 ? '0' + this.orbCount : this.orbCount;
    this.ui.orbCount.innerText = padStr;

    // 2. Speed HUD (arbitrary conversion)
    const kmh = (horizSpeed * 8.2).toFixed(1);
    this.ui.speed.innerText = `${kmh} km/h`;

    // 3. Altitude HUD
    const relativeAlt = Math.max(0, this.horsePosition.y - getTerrainHeight(this.horsePosition.x, this.horsePosition.z));
    this.ui.alt.innerText = `${(relativeAlt * 3.3).toFixed(1)} m`;

    // 4. Boost Fuel Meter & Countdown reserves
    const pct = (this.boostFuel * 100).toFixed(0);
    this.ui.boostCharge.style.width = `${pct}%`;

    if (this.boostFuel > 0.3) {
      this.inReserve = false;
      this.ui.boostCharge.classList.remove('depleted');
      this.ui.boostStatus.innerText = "READY";
      this.ui.boostStatus.style.color = "";
    } else if (this.boostFuel > 0.01) {
      this.inReserve = false;
      this.ui.boostCharge.classList.remove('depleted');
      this.ui.boostStatus.innerText = "LOW POWER";
      this.ui.boostStatus.style.color = "#fbbf24";
    } else {
      // DRAINED OUT! Activate Reserve Warning Countdown
      this.inReserve = true;
      this.ui.boostCharge.classList.add('depleted');
      this.ui.boostCharge.style.width = "0%";
      
      this.reserveTimer -= dt;
      this.ui.boostStatus.innerText = `EMERGENCY Reserve: ${Math.max(0.0, this.reserveTimer).toFixed(1)}s`;
      this.ui.boostStatus.style.color = "#ef4444";

      // Display warning tips
      if (Math.floor(window.performance.now() / 400) % 2 === 0) {
        this.ui.hudTip.innerHTML = "<span style='color:#ef4444; font-weight:800; animation: flash-red 0.5s infinite alternate;'>WARNING: THRUSTER CORES DRAINED. ACQUIRE ENERGY ORBS NOW!</span>";
      }

      if (this.reserveTimer <= 0) {
        this.triggerGameOver();
      }
    }

    // Dynamic tip banner cycles or displays relevant instructions
    if (!this.inReserve) {
      if (this.isAirborne) {
        this.ui.hudTip.innerHTML = "Airborne. Hold <span class='keyboard-hint'>Spacebar</span> to engage **low-gravity glide thusters**!";
      } else if (horizSpeed > 6.5) {
        this.ui.hudTip.innerHTML = "Galloping. Thrusters active. Speed boosted, but **fuel is slowly draining**!";
      } else {
        this.ui.hudTip.innerHTML = "Steer using <span class='keyboard-hint'>WASD</span>. Hold <span class='keyboard-hint'>Shift</span> to accelerate. Press <span class='keyboard-hint'>Spacebar</span> to launch!";
      }
    }
  }

  triggerGameOver() {
    this.isGameOver = true;
    
    // Save high score
    if (this.orbCount > this.highScore) {
      this.highScore = this.orbCount;
      localStorage.setItem('antigravity_highscore', this.highScore.toString());
    }

    // Render Game Over panels
    document.getElementById('final-orbs').innerText = this.orbCount;
    document.getElementById('high-score').innerText = this.highScore;

    const isCoreDrained = this.reserveTimer <= 0;
    document.getElementById('gameover-title').innerText = isCoreDrained ? "Core Drained" : "Voyage Terminated";
    document.getElementById('gameover-subtitle').innerText = isCoreDrained ? "Antigravity thruster reserves exhausted" : "Rider lost control of the steed";

    // Play low hum crash chord
    if (this.audioManager.ctx && !this.audioManager.muted) {
      try {
        const now = this.audioManager.ctx.currentTime;
        const osc = this.audioManager.ctx.createOscillator();
        const gain = this.audioManager.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 1.5);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
        osc.connect(gain);
        gain.connect(this.audioManager.ctx.destination);
        osc.start();
        osc.stop(now + 1.8);
      } catch (e) {}
    }

    document.getElementById('hud-overlay').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.remove('hidden');
  }
}
