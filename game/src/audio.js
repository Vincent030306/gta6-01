// Solmar Bay — procedural WebAudio sound.
// Every sound is synthesised live with oscillators and filtered noise; the
// game ships no audio files and makes no network request.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
  }

  AudioEngine.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngineHum();
      this.startSiren();
    } catch (e) {
      return false;
    }
    return true;
  };

  AudioEngine.prototype.startEngineHum = function () {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  };

  AudioEngine.prototype.setEngine = function (speedRatio, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const target = driving ? 0.05 + 0.10 * speedRatio : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + 130 * speedRatio, this.ctx.currentTime, 0.08);
  };

  AudioEngine.prototype.startSiren = function () {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  };

  // Two-tone police siren, updated once per frame from the game loop.
  AudioEngine.prototype.updateSiren = function (dt, wanted) {
    if (!this.ctx || !this.sirenOsc) return;
    if (wanted <= 0) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    this.sirenTimer += dt;
    const tone = Math.floor(this.sirenTimer / 0.45) % 2 === 0 ? 660 : 880;
    this.sirenOsc.frequency.setTargetAtTime(tone, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.2);
  };

  AudioEngine.prototype.blip = function (freq, dur, type, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  };

  AudioEngine.prototype.noiseBurst = function (dur, vol, filterFreq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.25;
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t);
  };

  AudioEngine.prototype.shot = function () { this.noiseBurst(0.14, 0.3, 2600); };
  AudioEngine.prototype.pickup = function () { this.blip(880, 0.18, 'sine', 0.2); this.blip(1320, 0.22, 'sine', 0.14); };
  AudioEngine.prototype.crash = function () { this.noiseBurst(0.35, 0.35, 900); };
  AudioEngine.prototype.door = function () { this.blip(220, 0.1, 'triangle', 0.15); };
  AudioEngine.prototype.missionDone = function () {
    const self = this;
    [523, 659, 784, 1047].forEach(function (f, i) {
      setTimeout(function () { self.blip(f, 0.3, 'triangle', 0.2); }, i * 130);
    });
  };
  AudioEngine.prototype.wasted = function () {
    const self = this;
    [392, 330, 262, 196].forEach(function (f, i) {
      setTimeout(function () { self.blip(f, 0.45, 'sawtooth', 0.14); }, i * 220);
    });
  };

  // A lazy bass-and-hats groove that only plays while driving, so the
  // streets stay quiet on foot and the radio wakes up behind the wheel.
  AudioEngine.prototype.updateMusic = function (dt, driving) {
    if (!this.ctx || !driving) return;
    this.musicTimer += dt;
    if (this.musicTimer < 0.21) return;
    this.musicTimer = 0;
    const bassLine = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    const note = bassLine[this.musicStep % bassLine.length];
    this.musicStep++;
    this.blip(note, 0.2, 'triangle', 0.10);
    if (this.musicStep % 2 === 0) this.noiseBurst(0.03, 0.05, 6000);
  };

  AudioEngine.prototype.toggleMute = function () {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  };

  // Silence every looped source at once (death screen, pause menu).
  AudioEngine.prototype.stopAll = function () {
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  };

  SB.AudioEngine = AudioEngine;
})();
