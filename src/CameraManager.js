import * as THREE from 'three';

export class CameraManager {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    
    // Ideal static offset values
    this.followDistance = 7.5;
    this.followHeight = 1.85;
    this.lookAtHeight = 1.15;
    
    this.currentPosition = new THREE.Vector3();
    this.currentTarget = new THREE.Vector3();
    
    this.init();
  }

  init() {
    // Initial camera position relative to origin
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 1, 0);
  }

  update(dt, horsePosition, horseHeadingAngle, horseVelocity) {
    // 1. Calculate base camera tracking vectors
    const forward = new THREE.Vector3(Math.cos(horseHeadingAngle), 0, -Math.sin(horseHeadingAngle));
    
    // Get mouse orbit additions from Controls
    const orbit = this.controls.cameraOrbit;
    const currentDistance = orbit.distance;

    // Combine horse forward heading angle with mouse horizontal orbit angle (theta)
    const combinedTheta = horseHeadingAngle + orbit.theta;
    const combinedPhi = orbit.phi; // vertical pitch

    // Spherical coordinate tracking system
    const targetOffset = new THREE.Vector3(
      Math.cos(combinedTheta) * Math.cos(combinedPhi),
      Math.sin(combinedPhi),
      -Math.sin(combinedTheta) * Math.cos(combinedPhi)
    );
    
    // Negative offset to place camera BEHIND
    targetOffset.multiplyScalar(-currentDistance);
    
    // Target camera position
    const targetCameraPos = horsePosition.clone().add(targetOffset);
    // Add custom hover height to keep camera floating above sand dunes
    targetCameraPos.y += this.followHeight;

    // Adjust camera distance/height cinematic effect:
    // If horse is going fast (galloping), zoom out slightly to heighten the sensation of speed!
    const speed = horseVelocity.length();
    const speedRatio = Math.min(1.0, speed / 12.0);
    targetCameraPos.addScaledVector(targetOffset.clone().normalize(), speedRatio * 1.5);
    
    // 2. Dampened Interpolation (Lerping) for cinematic smoothness
    const followLerpFactor = 0.08; // smooth delay position tracking
    this.currentPosition.lerp(targetCameraPos, followLerpFactor);

    const lookTarget = horsePosition.clone();
    lookTarget.y += this.lookAtHeight;
    
    const targetLerpFactor = 0.12; // slightly faster tracking look-target
    this.currentTarget.lerp(lookTarget, targetLerpFactor);

    // Apply tracking coordinates
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentTarget);
  }
}
