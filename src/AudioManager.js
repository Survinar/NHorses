export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ambientOsc = null;
    this.ambientFilter = null;
    this.ambientGain = null;
    this.hoofbeatTimer = null;
    this.isHoofbeatPlaying = false;
    this.lastHoofbeatTime = 0;
  }

  init() {
    if (this.ctx) return;
    
    // Create AudioContext on user interaction
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    this.ctx = new AudioContextClass();
    
    // Initialize background ambience
    this.startAmbience();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      if (this.muted) {
        this.ctx.suspend();
      } else {
        this.ctx.resume();
        if (this.ctx.state === 'suspended') {
          // Re-initialize if state didn't wake up
          this.init();
        }
      }
    }
    return this.muted;
  }

  startAmbience() {
    if (!this.ctx || this.muted) return;

    try {
      // Deep cosmic pad synthesizers (multiple detuned sine waves through a lowpass filter)
      const frequencies = [73.42, 110.00, 146.83, 220.00]; // D2, A2, D3, A3 chords
      
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      
      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(300, this.ctx.currentTime);
      this.ambientFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.oscs = [];
      
      frequencies.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        osc.type = index % 2 === 0 ? 'sine' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        // Add tiny frequency modulation to feel organic
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.1 + index * 0.05, this.ctx.currentTime);
        
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        
        osc.connect(this.ambientFilter);
        
        lfo.start();
        osc.start();
        this.oscs.push(osc);
      });

      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);
      
      // Sweep the ambient filter slowly over time for the "wind/desert" effect
      this.sweepAmbience();
    } catch (e) {
      console.warn("Failed to start Web Audio ambience:", e);
    }
  }

  sweepAmbience() {
    if (!this.ambientFilter || this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const nextFreq = 200 + Math.random() * 400;
    const nextTime = 4 + Math.random() * 6;
    this.ambientFilter.frequency.exponentialRampToValueAtTime(nextFreq, now + nextTime);
    
    // Schedule next sweep
    setTimeout(() => this.sweepAmbience(), nextTime * 1000);
  }

  playHoofbeat(speed, isAirborne) {
    if (!this.ctx || this.muted || isAirborne || speed < 0.1) return;
    
    const now = this.ctx.currentTime;
    // Determine tempo interval based on speed: faster speed = faster tempo
    // Trot: ~300ms interval, Gallop: ~180ms interval
    const interval = Math.max(0.15, 0.45 - (speed * 0.03));
    
    if (now - this.lastHoofbeatTime < interval) return;
    this.lastHoofbeatTime = now;
    
    // Synthesize a hoofbeat (low-passed impact noise burst)
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(10, now + 0.08);
      
      gain.gain.setValueAtTime(0.15 * Math.min(1.5, speed/5), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, now);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.1);

      // Double beat for horse gallop rhythm! (Front/back legs offset by ~60ms)
      if (speed > 4.5) {
        setTimeout(() => {
          if (this.muted || !this.ctx) return;
          const osc2 = this.ctx.createOscillator();
          const gain2 = this.ctx.createGain();
          
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(70, this.ctx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.08);
          
          gain2.gain.setValueAtTime(0.10 * Math.min(1.5, speed/5), this.ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
          
          const filter2 = this.ctx.createBiquadFilter();
          filter2.type = 'lowpass';
          filter2.frequency.setValueAtTime(200, this.ctx.currentTime);
          
          osc2.connect(filter2);
          filter2.connect(gain2);
          gain2.connect(this.ctx.destination);
          
          osc2.start();
          osc2.stop(this.ctx.currentTime + 0.1);
        }, 60);
      }
    } catch (e) {
      // Ignore audio synthesis glitches
    }
  }

  playOrbCollect() {
    this.init();
    if (!this.ctx || this.muted) return;
    
    try {
      const now = this.ctx.currentTime;
      // High-pitched crystal bell sound using FM synthesis or double sine wave chords
      const freqs = [880, 1318.51, 1760]; // A5, E6, A6 chord
      
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.03);
        
        gain.gain.setValueAtTime(0.05, now + idx * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.03 + 0.8);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.95);
      });
    } catch (e) {
      // Audio fallback
    }
  }

  playLeap() {
    this.init();
    if (!this.ctx || this.muted) return;
    
    try {
      const now = this.ctx.currentTime;
      
      // Dramatic sci-fi antigravity thruster/hum sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(45, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 1.2);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(80, now);
      filter.frequency.exponentialRampToValueAtTime(1000, now + 1.0);
      filter.Q.setValueAtTime(4.0, now);
      
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 1.6);
      
      // Also play a high sweep crystal sparkle sound on top
      const sparkleOsc = this.ctx.createOscillator();
      const sparkleGain = this.ctx.createGain();
      
      sparkleOsc.type = 'sine';
      sparkleOsc.frequency.setValueAtTime(500, now);
      sparkleOsc.frequency.exponentialRampToValueAtTime(2000, now + 0.8);
      
      sparkleGain.gain.setValueAtTime(0.08, now);
      sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      
      sparkleOsc.connect(sparkleGain);
      sparkleGain.connect(this.ctx.destination);
      
      sparkleOsc.start(now);
      sparkleOsc.stop(now + 0.9);
    } catch (e) {
      // Audio fallback
    }
  }

  playEngineOverdrive(active) {
    // Optional continuous hover sound while floating
  }
}
