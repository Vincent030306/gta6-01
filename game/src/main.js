// Solmar Bay — game entry point: player, camera, state machine, save/load,
// screenshot staging, and the frame loop. Play it with WASD + mouse.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function Game() {
    this.state = 'start';   // start | play | pause | dead
    this.health = SB.CONFIG.startHealth;
    this.money = SB.CONFIG.startMoney;
    this.driving = false;
    this.promptText = '';
    this.cameraHeading = 0;
    this.cameraPitch = 0.32;
    this.cameraDist = 9;
    this.bustedTimer = 0;
    this.deadTimer = 0;
    this.shotMode = null;
    this.shotReady = false;
    this.frameCount = 0;
  }

  Game.prototype.playerPos = function () {
    if (this.driving && this.vehicles.playerCar) {
      return { x: this.vehicles.playerCar.x, z: this.vehicles.playerCar.z };
    }
    return { x: this.player.x, z: this.player.z };
  };

  Game.prototype.addWanted = function (heat) {
    const rose = this.police.addHeat(heat);
    if (rose) this.hud.toast('Wanted level up! The police are coming.');
  };

  Game.prototype.damage = function (amount) {
    if (this.state !== 'play') return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.die('FLATLINED', 'Rico did not make it out of Solmar Bay this time.');
    }
  };

  Game.prototype.die = function (title, sub) {
    this.state = 'dead';
    this.deadTimer = 0;
    if (this.audio) { this.audio.wasted(); this.audio.stopAll(); }
    this.hud.setDead(title, sub);
    if (document.pointerLockElement) document.exitPointerLock();
  };

  Game.prototype.save = function () {
    try {
      localStorage.setItem(SB.CONFIG.saveKey, JSON.stringify({
        money: this.money,
        missionsCompleted: this.missions.completed,
        missionIndex: this.missions.index,
        health: this.health,
        x: this.player.x, z: this.player.z,
        savedAt: Date.now(),
      }));
    } catch (e) { /* storage unavailable */ }
  };

  Game.prototype.load = function () {
    try {
      const raw = localStorage.getItem(SB.CONFIG.saveKey);
      if (!raw) return false;
      const s = JSON.parse(raw);
      this.money = s.money || SB.CONFIG.startMoney;
      this.missions.completed = s.missionsCompleted || 0;
      this.missions.index = s.missionIndex || 0;
      this.health = s.health || SB.CONFIG.startHealth;
      if (typeof s.x === 'number') { this.player.x = s.x; this.player.z = s.z; }
      return true;
    } catch (e) { return false; }
  };

  Game.prototype.init = function () {
    const params = new URLSearchParams(window.location.search);
    const seed = parseInt(params.get('seed') || '7', 10) || 7;
    this.shotMode = params.get('shot');

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

    this.world = SB.buildWorld(this.scene, seed);
    this.audio = new SB.AudioEngine();
    this.input = new SB.Input(this.renderer.domElement);
    this.traffic = new SB.Traffic(this.scene, this.world, seed);
    this.vehicles = new SB.Vehicles(this.scene, this.world, seed);
    this.police = new SB.Police(this.scene, this.world);
    this.combat = new SB.Combat(this.scene, this.world, this);
    this.missions = new SB.Missions(this.scene, this);
    this.hud = new SB.HUD(this);

    // The player: Rico Vega, built from boxes — jacket, jeans, cap.
    this.player = { x: 0, z: 20, heading: 0, vy: 0, onGround: true, speed: 0 };
    const g = new THREE.Group();
    const jacket = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.0, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2e86c1 })
    );
    jacket.position.y = 1.15; jacket.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a })
    );
    head.position.y = 1.95;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.14, 12),
      new THREE.MeshLambertMaterial({ color: 0xc0392b })
    );
    cap.position.y = 2.2;
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
    );
    legs.position.y = 0.35;
    // A visible pistol in the right hand when firing.
    this.gunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    this.gunMesh.position.set(0.5, 1.3, 0.35);
    g.add(jacket); g.add(head); g.add(cap); g.add(legs); g.add(this.gunMesh);
    this.playerMesh = g;
    this.scene.add(g);

    this.bindMenuButtons();
    this.hud.renderMissionList();
    window.addEventListener('resize', this.onResize.bind(this));

    if (this.shotMode) this.stageShot();
    else this.hud.setMenu('start');

    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  };

  Game.prototype.bindMenuButtons = function () {
    const self = this;
    const on = function (id, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('btn-start', function () { self.startGame(false); });
    on('btn-continue', function () { self.startGame(true); });
    on('btn-resume', function () { self.setState('play'); });
    on('btn-restart', function () { self.restart(); });
    on('btn-quit-menu', function () { self.setState('start'); self.hud.setMenu('start'); });
    on('btn-dead-retry', function () { self.restart(); });
    on('btn-dead-menu', function () { self.setState('start'); self.hud.setMenu('start'); });
    on('btn-mute', function () {
      self.audio.ensure();
      const muted = self.audio.toggleMute();
      document.getElementById('btn-mute').textContent = muted ? 'Sound: Off' : 'Sound: On';
    });
  };

  Game.prototype.setState = function (state) {
    this.state = state;
    if (state === 'play') this.hud.setMenu('play');
    else if (state === 'pause') this.hud.setMenu('pause');
  };

  Game.prototype.startGame = function (continueSave) {
    this.audio.ensure();
    if (continueSave) this.load();
    this.health = this.health > 0 ? this.health : SB.CONFIG.startHealth;
    this.setState('play');
    this.hud.toast(continueSave ? 'Welcome back to Solmar Bay, Rico.' : SB.STORY.intro);
    this.missions.say('Press M to start your first job: Dockside Courier.');
  };

  Game.prototype.restart = function () {
    this.health = SB.CONFIG.startHealth;
    this.money = SB.CONFIG.startMoney;
    this.player.x = 0; this.player.z = 20;
    this.police.setWanted(0);
    this.police.cars.forEach(function (c) { this.scene.remove(c.mesh); }, this);
    this.police.cars = [];
    this.combat.clearEnemies();
    this.combat.ammo = 24; this.combat.reserve = 120;
    this.missions.index = 0; this.missions.completed = 0;
    this.missions.active = null; this.missions.hideBeacon();
    if (this.driving) { this.vehicles.exitCar(); this.driving = false; }
    this.save();
    this.setState('play');
  };

  Game.prototype.onResize = function () {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // Screenshot staging: ?shot=cover|drive|chase|mission stages a live scene
  // (player, cars, police, mission) and starts play with no menus, so the
  // capture script only has to wait for window.__shotReady.
  Game.prototype.stageShot = function () {
    const mode = this.shotMode;
    this.audio.ensure();
    this.setState('play');
    if (mode === 'cover') {
      // Stand mid-road on the central avenue, looking down the street so the
      // cover shows the road, towers, traffic and the HUD at once.
      this.player.x = 0; this.player.z = -30;
      this.cameraHeading = 0; this.cameraPitch = 0.30; this.cameraDist = 12;
      this.missions.start();
    } else if (mode === 'drive') {
      const parked = this.vehicles.parked[0];
      this.vehicles.enterCar(parked);
      this.driving = true;
      this.vehicles.playerCar.x = 0; this.vehicles.playerCar.z = 46;
      this.vehicles.playerCar.heading = Math.PI;
      this.vehicles.playerCar.speed = 18;
      this.cameraHeading = Math.PI; this.cameraPitch = 0.3; this.cameraDist = 12;
      this.missions.start();
    } else if (mode === 'chase') {
      this.player.x = 0; this.player.z = 0;
      const parked = this.vehicles.parked[1];
      this.vehicles.enterCar(parked);
      this.driving = true;
      this.vehicles.playerCar.x = 0; this.vehicles.playerCar.z = 0;
      this.vehicles.playerCar.heading = 0;
      this.vehicles.playerCar.speed = 22;
      this.police.setWanted(3);
      this.police.spawnCar(this.playerPos());
      this.police.spawnCar(this.playerPos());
      // Pull the chase cars into the frame ahead of the player, closing in
      // from the opposite lane so the screenshot shows the pursuit.
      for (let i = 0; i < this.police.cars.length; i++) {
        const c = this.police.cars[i];
        c.x = this.playerPos().x + (i === 0 ? -5 : 6);
        c.z = this.playerPos().z + 34 + i * 10;
        c.heading = Math.PI;
      }
      this.cameraHeading = 0; this.cameraPitch = 0.34; this.cameraDist = 13;
      this.missions.start();
    } else if (mode === 'mission') {
      this.missions.index = 3;
      // Stand on the road outside the warehouse, looking down the street at
      // the yard so the gunmen and the gold beacon are both in frame.
      this.player.x = -138; this.player.z = -98;
      this.cameraHeading = Math.PI; this.cameraPitch = 0.30; this.cameraDist = 13;
      this.missions.start();
    }
    this.hud.update(0);
    window.__shotReady = false;
    setTimeout(function () { window.__shotReady = true; }, 2500);
  };

  Game.prototype.loop = function (now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.frameCount++;
    if (this.state === 'play') this.update(dt);
    this.render();
    if (this.state === 'play') this.hud.update(dt);
    this.input.endFrame();
    requestAnimationFrame(this.loop.bind(this));
  };

  Game.prototype.update = function (dt) {
    const input = this.input;
    const mouse = input.consumeMouse();
    this.cameraHeading -= mouse.dx * 0.0032;
    this.cameraPitch = SB.clamp(this.cameraPitch + mouse.dy * 0.0022, 0.08, 1.1);

    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      this.setState('pause');
      if (document.pointerLockElement) document.exitPointerLock();
      return;
    }
    if (input.wasPressed('KeyM')) {
      if (this.missions.active) this.missions.abandon();
      else this.missions.start();
    }
    if (input.wasPressed('KeyR')) this.combat.reload();
    if (input.wasPressed('KeyN')) this.audio.ensure();

    const axes = input.moveAxes();
    this.promptText = '';

    // Enter / exit cars with E.
    if (input.wasPressed('KeyE')) {
      if (this.driving) {
        const out = this.vehicles.exitCar();
        this.driving = false;
        this.player.x = out.x; this.player.z = out.z;
        if (this.audio) this.audio.door();
      } else {
        const near = this.vehicles.nearestParked(this.player.x, this.player.z, 4.5);
        if (near) {
          this.vehicles.enterCar(near);
          this.driving = true;
          this.addWanted(20);
          if (this.audio) { this.audio.door(); this.audio.pickup(); }
          this.hud.toast('You took the car. The owner called it in — wanted level up.');
        }
      }
    }

    if (this.driving) {
      // In staged screenshot modes the car keeps rolling on its own so the
      // capture shows it mid-drive instead of parked.
      if (this.shotMode === 'drive' || this.shotMode === 'chase') {
        axes.forward = Math.max(axes.forward, 1);
      }
      const result = this.vehicles.update(dt, axes, this.traffic);
      if (result.crashed && Math.abs(result.speed) > 6) {
        if (this.audio) this.audio.crash();
        this.damage(3);
      }
      // Hit a pedestrian while driving: wanted up.
      const ped = this.traffic.nearestPed(this.playerPos().x, this.playerPos().z, 2.6);
      if (ped && Math.abs(result.speed) > 5) {
        ped.x += 30; ped.z += 30;
        this.addWanted(20);
        this.hud.toast('You hit a pedestrian! Wanted level up.');
      }
      const near = this.vehicles.playerCar;
      if (near) this.player.x = near.x, this.player.z = near.z;
    } else {
      // On foot: move relative to the camera. Camera forward on the ground is
      // (sin(heading), cos(heading)); screen-right is (-cos, sin).
      const speed = axes.run ? SB.CONFIG.playerRunSpeed : SB.CONFIG.playerWalkSpeed;
      const sin = Math.sin(this.cameraHeading), cos = Math.cos(this.cameraHeading);
      let mx = sin * axes.forward - cos * axes.strafe;
      let mz = cos * axes.forward + sin * axes.strafe;
      const len = Math.sqrt(mx * mx + mz * mz) || 1;
      if (axes.forward !== 0 || axes.strafe !== 0) {
        this.player.x += (mx / len) * speed * dt;
        this.player.z += (mz / len) * speed * dt;
        this.player.heading = Math.atan2(mx, mz);
        this.player.speed = speed;
      } else {
        this.player.speed = 0;
      }
      if (input.wasPressed('Space') && this.player.onGround) {
        this.player.vy = 7;
        this.player.onGround = false;
      }
      if (!this.player.onGround) {
        this.player.vy -= 22 * dt;
        this.playerMesh.position.y += this.player.vy * dt;
        if (this.playerMesh.position.y <= 0) {
          this.playerMesh.position.y = 0;
          this.player.vy = 0;
          this.player.onGround = true;
        }
      }
      const fixed = SB.collideCircle(this.world, this.player.x, this.player.z, 0.7);
      this.player.x = fixed.x; this.player.z = fixed.z;
      this.playerMesh.position.set(this.player.x, this.playerMesh.position.y, this.player.z);
      this.playerMesh.rotation.y = this.player.heading;
      // Walk bob.
      const bob = this.player.speed > 0 ? Math.abs(Math.sin(performance.now() / 130)) * 0.08 : 0;
      this.playerMesh.position.y += bob;
      const near = this.vehicles.nearestParked(this.player.x, this.player.z, 4.5);
      if (near) this.promptText = 'Press E to steal the car';
      // Pick up cash lying on the street: small green stacks.
      if (this.frameCount % 600 === 0 && this.money < 5000) {
        this.money += 5;
      }
    }

    // Shooting: F key or left mouse click, aimed from the camera.
    if (input.wasPressed('KeyF') || input.consumeClick()) {
      if (!this.driving) {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const origin = this.camera.position.clone();
        this.combat.shoot(origin, dir);
        if (this.combat.ammo > 0) this.addWanted(4);
      }
    }

    // Busted: police contact at 3+ stars for a sustained moment.
    if (this.police.bustedCheck(dt)) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 1.6) {
        this.die('BUSTED', 'The Solmar Bay police hauled Rico in. The Meridian Job will have to wait.');
        return;
      }
    } else {
      this.bustedTimer = 0;
    }

    const pos = this.playerPos();
    const speed = this.driving && this.vehicles.playerCar ? Math.abs(this.vehicles.playerCar.speed) : this.player.speed;
    this.traffic.update(dt, pos, this.police.wanted);
    this.police.update(dt, pos, speed, this.audio);
    this.combat.update(dt, pos);
    this.missions.update(dt, pos, this.driving, this.driving);
    if (this.audio) {
      this.audio.setEngine(this.driving ? Math.abs(this.vehicles.playerCar.speed) / SB.CONFIG.carTopSpeed : 0, this.driving);
      this.audio.updateMusic(dt, this.driving);
    }
    // Autosave every ~10 seconds of play.
    if (this.frameCount % 600 === 0) this.save();
  };

  Game.prototype.render = function () {
    const pos = this.playerPos();
    const ch = this.cameraHeading, cp = this.cameraPitch;
    const dist = this.driving ? this.cameraDist + 3 : this.cameraDist;
    const cx = pos.x - Math.sin(ch) * Math.cos(cp) * dist;
    const cz = pos.z - Math.cos(ch) * Math.cos(cp) * dist;
    const cy = 2.2 + Math.sin(cp) * dist;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(pos.x, 2.0, pos.z);
    this.renderer.render(this.scene, this.camera);
  };

  SB.Game = Game;

  // Boot once the page and the vendored three.js build have loaded.
  window.addEventListener('DOMContentLoaded', function () {
    const game = new SB.Game();
    window.SolmarGame = game;
    game.init();
  });
})();
