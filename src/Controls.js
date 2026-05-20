export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      shift: false,
      space: false
    };

    // Camera orbit parameters (modified by dragging)
    this.cameraOrbit = {
      theta: 0, // Horizontal rotation
      phi: 0.15,  // Vertical rotation (clamped)
      distance: 8.0,
      targetTheta: 0,
      targetPhi: 0.15,
      targetDistance: 8.0
    };

    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    
    this.init();
  }

  init() {
    // Keyboard listeners
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Mouse listeners for camera orbit
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', () => this.handleMouseUp());

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    window.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    window.addEventListener('touchend', () => this.handleMouseUp());

    // Wheel zoom support
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: true });
  }

  handleKeyDown(e) {
    const key = e.key.toLowerCase();
    
    if (key === 'w' || e.key === 'ArrowUp') this.keys.forward = true;
    if (key === 's' || e.key === 'ArrowDown') this.keys.backward = true;
    if (key === 'a' || e.key === 'ArrowLeft') this.keys.left = true;
    if (key === 'd' || e.key === 'ArrowRight') this.keys.right = true;
    if (e.key === 'Shift') this.keys.shift = true;
    if (e.key === ' ') {
      this.keys.space = true;
      e.preventDefault(); // Prevent scrolling down on page
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    
    if (key === 'w' || e.key === 'ArrowUp') this.keys.forward = false;
    if (key === 's' || e.key === 'ArrowDown') this.keys.backward = false;
    if (key === 'a' || e.key === 'ArrowLeft') this.keys.left = false;
    if (key === 'd' || e.key === 'ArrowRight') this.keys.right = false;
    if (e.key === 'Shift') this.keys.shift = false;
    if (e.key === ' ') this.keys.space = false;
  }

  handleMouseDown(e) {
    this.isDragging = true;
    this.previousMousePosition = {
      x: e.clientX,
      y: e.clientY
    };
  }

  handleMouseMove(e) {
    if (!this.isDragging) return;
    
    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;
    
    // Adjust target horizontal & vertical angles based on mouse drag
    this.cameraOrbit.targetTheta -= deltaX * 0.005;
    this.cameraOrbit.targetPhi = Math.max(
      -0.3,
      Math.min(0.8, this.cameraOrbit.targetPhi + deltaY * 0.005)
    );
    
    this.previousMousePosition = {
      x: e.clientX,
      y: e.clientY
    };
  }

  handleMouseUp() {
    this.isDragging = false;
  }

  handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    this.isDragging = true;
    this.previousMousePosition = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }

  handleTouchMove(e) {
    if (!this.isDragging || e.touches.length !== 1) return;
    
    const deltaX = e.touches[0].clientX - this.previousMousePosition.x;
    const deltaY = e.touches[0].clientY - this.previousMousePosition.y;
    
    this.cameraOrbit.targetTheta -= deltaX * 0.007;
    this.cameraOrbit.targetPhi = Math.max(
      -0.3,
      Math.min(0.8, this.cameraOrbit.targetPhi + deltaY * 0.007)
    );
    
    this.previousMousePosition = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }

  handleWheel(e) {
    // Zoom camera in and out smoothly
    const zoomAmount = e.deltaY * 0.005;
    this.cameraOrbit.targetDistance = Math.max(
      4.0,
      Math.min(18.0, this.cameraOrbit.targetDistance + zoomAmount)
    );
  }

  update() {
    // Smoothly interpolate current camera angle to target angle (lerp)
    this.cameraOrbit.theta += (this.cameraOrbit.targetTheta - this.cameraOrbit.theta) * 0.12;
    this.cameraOrbit.phi += (this.cameraOrbit.targetPhi - this.cameraOrbit.phi) * 0.12;
    this.cameraOrbit.distance += (this.cameraOrbit.targetDistance - this.cameraOrbit.distance) * 0.12;
  }

  resetCamera() {
    this.cameraOrbit.targetTheta = 0;
    this.cameraOrbit.targetPhi = 0.15;
    this.cameraOrbit.targetDistance = 8.0;
  }
}
