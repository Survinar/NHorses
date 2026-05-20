import * as THREE from 'three';
import './style.css';

import { AudioManager } from './AudioManager.js';
import { Controls } from './Controls.js';
import { Environment } from './Environment.js';
import { Horse } from './Horse.js';
import { CameraManager } from './CameraManager.js';
import { GameLogic } from './GameLogic.js';

class GameApp {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Subsystems
    this.audioManager = null;
    this.controls = null;
    this.environment = null;
    this.horse = null;
    this.cameraManager = null;
    this.gameLogic = null;

    // Timing
    this.clock = new THREE.Clock();
    this.isPaused = false;
    this.isInitialized = false;

    this.init();
  }

  async init() {
    this.setupThree();
    
    // Simulate gradual asset loading progression for high-end feel
    await this.updateProgress("Configuring Audio Cores...", 15);
    this.audioManager = new AudioManager();

    await this.updateProgress("Interfacing Control Systems...", 30);
    this.controls = new Controls(this.canvas);

    await this.updateProgress("Sculpting Sand Dunes & oases...", 50);
    this.environment = new Environment(this.scene);

    await this.updateProgress("Assembling Cosmic Steed skeletal matrix...", 75);
    this.horse = new Horse(this.scene);

    await this.updateProgress("Calibrating Cinematic Camera Tracking...", 90);
    this.cameraManager = new CameraManager(this.camera, this.controls);

    await this.updateProgress("Synchronizing Quantum Physics Loops...", 98);
    this.gameLogic = new GameLogic(this.scene, this.horse, this.environment, this.controls, this.audioManager);

    await this.updateProgress("Voyage Ready.", 100);

    // Hide loader, show start overlay
    setTimeout(() => {
      document.getElementById('loading-overlay').classList.add('hidden');
      document.getElementById('start-overlay').classList.remove('hidden');
      this.isInitialized = true;
    }, 600);

    this.bindDOMEvents();

    // Start rendering frame loop (but logic doesn't tick until start is pressed)
    this.animate();
  }

  setupThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    
    // Warm atmospheric purple fog to match sunset Cinematic theme
    this.scene.fog = new THREE.FogExp2(0x231135, 0.0055);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Shadow maps
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Color management
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Window Resizing
    window.addEventListener('resize', () => this.handleResize());
  }

  async updateProgress(text, pct) {
    const bar = document.getElementById('loader-progress');
    const textEl = document.querySelector('.loader-text');
    if (bar) bar.style.width = `${pct}%`;
    if (textEl) textEl.innerText = text;
    
    // Yield to main thread for smooth painting
    return new Promise(resolve => setTimeout(resolve, 150));
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  bindDOMEvents() {
    // 1. Start game button
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());

    // 2. Pause Buttons
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());

    // 3. Restart Buttons
    document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
    document.getElementById('restart-pause-btn').addEventListener('click', () => {
      this.togglePause();
      this.restartGame();
    });

    // 4. Mute Audio Button
    const muteBtn = document.getElementById('mute-btn');
    const speakerIcon = document.getElementById('speaker-icon');
    
    muteBtn.addEventListener('click', () => {
      if (!this.audioManager) return;
      const isMuted = this.audioManager.toggleMute();
      
      // Visual feedback change SVG icon color
      if (isMuted) {
        speakerIcon.style.fill = '#ef4444';
        muteBtn.title = "Unmute Sound";
      } else {
        speakerIcon.style.fill = '';
        muteBtn.title = "Mute Sound";
      }
    });
  }

  startGame() {
    // Hide menus, show play HUD
    document.getElementById('start-overlay').classList.add('hidden');
    document.getElementById('hud-overlay').classList.remove('hidden');

    // Wake up/initialize sound synthesizers on interaction
    if (this.audioManager) {
      this.audioManager.init();
    }
    
    this.clock.getDelta(); // reset clock
    this.isPaused = false;
  }

  togglePause() {
    if (this.gameLogic && this.gameLogic.isGameOver) return;
    
    this.isPaused = !this.isPaused;
    const pauseMenu = document.getElementById('pause-overlay');
    
    if (this.isPaused) {
      pauseMenu.classList.remove('hidden');
      if (this.audioManager && this.audioManager.ctx) {
        this.audioManager.ctx.suspend();
      }
    } else {
      pauseMenu.classList.add('hidden');
      if (this.audioManager && this.audioManager.ctx && !this.audioManager.muted) {
        this.audioManager.ctx.resume();
      }
      this.clock.getDelta(); // reset clock so no physics jumps
    }
  }

  restartGame() {
    // Hide panels
    document.getElementById('gameover-overlay').classList.add('hidden');
    document.getElementById('hud-overlay').classList.remove('hidden');

    if (this.gameLogic) {
      this.gameLogic.restart();
    }
    if (this.controls) {
      this.controls.resetCamera();
    }
    if (this.audioManager && this.audioManager.ctx && !this.audioManager.muted) {
      this.audioManager.ctx.resume();
    }

    this.clock.getDelta();
    this.isPaused = false;
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(0.1, this.clock.getDelta()); // Cap step rate during slow frames

    if (this.isInitialized) {
      // 1. Tick main physics logic only when active
      const activeState = !this.isPaused && !this.gameLogic.isGameOver && !document.getElementById('start-overlay').classList.contains('hidden') === false;
      
      if (activeState) {
        // Main updates
        this.gameLogic.update(dt);
        this.controls.update();
        
        // Pass animated properties to environment and horse
        this.environment.updateParticles(dt, this.gameLogic.horsePosition);
        
        this.horse.update(
          dt, 
          this.gameLogic.velocity, 
          this.gameLogic.isAirborne
        );
      }

      // Always camera track for majestic panning in loading or menu screens!
      // If menu is open, rotate camera slowly in a circle (360 cinematic orbits!)
      if (!activeState && !this.isPaused && !this.gameLogic.isGameOver) {
        const panTime = window.performance.now() * 0.0003;
        this.controls.cameraOrbit.targetTheta = panTime;
        this.controls.cameraOrbit.targetPhi = 0.08 + Math.sin(panTime * 2.0) * 0.04;
        this.controls.update();
      }
      
      // Update camera follow positions
      this.cameraManager.update(
        dt,
        this.gameLogic.horsePosition,
        this.gameLogic.headingAngle,
        this.gameLogic.velocity
      );
    }

    // Render screen
    this.renderer.render(this.scene, this.camera);
  }
}

// Launch app
new GameApp();
