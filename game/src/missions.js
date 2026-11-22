// Solmar Bay — the five-mission story campaign.
// Each mission has a pickup stage and a delivery stage (or a combat / evade
// stage), a beacon in the world, and a cash reward on completion.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function Missions(scene, game) {
    this.scene = scene;
    this.game = game;
    this.index = 0;            // mission currently offered
    this.active = null;        // {def, stage, timer, ...}
    this.completed = 0;
    this.beacon = null;
    this.beaconRing = null;
    this.message = '';
    this.messageTimer = 0;
    this.evadeTimer = 0;
    this.evadeNeed = 0;
  }

  Missions.prototype.currentDef = function () {
    return SB.MISSION_DEFS[this.index] || null;
  };

  Missions.prototype.start = function () {
    const def = this.currentDef();
    if (!def) return false;
    this.active = { def: def, stage: 'go', timer: 0, enemiesLeft: 0 };
    this.showBeacon(def.target.x, def.target.z);
    this.say(def.name + ' — ' + def.brief);
    if (def.kind === 'evade') {
      this.game.police.setWanted(3);
      this.evadeNeed = 25;
      this.evadeTimer = 0;
      this.say('Heat is on! Lose the cops — stay out of sight for 25 seconds.');
    }
    if (def.kind === 'combat' || def.kind === 'heist') {
      this.active.enemiesLeft = def.kind === 'combat' ? 5 : 4;
      this.game.combat.spawnEnemies(def.target.x, def.target.z, this.active.enemiesLeft);
    }
    return true;
  };

  Missions.prototype.say = function (text) {
    this.message = text;
    this.messageTimer = 8;
  };

  Missions.prototype.showBeacon = function (x, z) {
    this.hideBeacon();
    const geo = new THREE.CylinderGeometry(3.2, 3.2, 60, 20, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(x, 30, z);
    this.scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.6, 3.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, side: THREE.DoubleSide });
    this.beaconRing = new THREE.Mesh(ringGeo, ringMat);
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.set(x, 0.15, z);
    this.scene.add(this.beaconRing);
  };

  Missions.prototype.hideBeacon = function () {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
    if (this.beaconRing) { this.scene.remove(this.beaconRing); this.beaconRing = null; }
  };

  Missions.prototype.distanceToTarget = function (pos) {
    if (!this.active) return null;
    const def = this.active.def;
    const t = this.active.stage === 'go' ? def.target : def.deliver;
    if (!t) return null;
    const dx = t.x - pos.x, dz = t.z - pos.z;
    return { dist: Math.sqrt(dx * dx + dz * dz), x: t.x, z: t.z };
  };

  Missions.prototype.objectiveText = function () {
    if (!this.active) {
      const def = this.currentDef();
      return def ? 'Next job: ' + def.name + ' — press M to start' : 'All jobs done — Solmar Bay is yours, Rico.';
    }
    const def = this.active.def;
    if (def.kind === 'evade') {
      return 'Lose the police! Stay hidden: ' + Math.max(0, Math.ceil(this.evadeNeed - this.evadeTimer)) + 's';
    }
    return this.active.stage === 'go' ? def.targetLabel : def.deliverLabel;
  };

  // Called every frame while a mission is active.
  Missions.prototype.update = function (dt, playerPos, driving, inCar) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.beacon) this.beacon.rotation.y += dt * 0.8;
    if (!this.active) return;
    const def = this.active.def;
    const game = this.game;

    if (def.kind === 'evade') {
      const copsNear = game.police.cars.some(function (c) {
        const dx = c.x - playerPos.x, dz = c.z - playerPos.z;
        return dx * dx + dz * dz < 2500;
      });
      if (!copsNear && game.police.wanted > 0) this.evadeTimer += dt;
      else this.evadeTimer = Math.max(0, this.evadeTimer - dt * 0.5);
      if (game.police.wanted === 0) this.evadeTimer += dt;
      if (this.evadeTimer >= this.evadeNeed) this.complete();
      return;
    }

    if (def.kind === 'combat' || def.kind === 'heist') {
      if (this.active.stage === 'go') {
        const left = game.combat.enemiesAlive();
        this.active.enemiesLeft = left;
        if (left === 0) {
          this.active.stage = 'deliver';
          this.say(def.kind === 'combat' ? 'Yard is clear — grab the ledger from the office.' : 'Vault cash secured — get it to the hideout.');
          if (def.deliver) this.showBeacon(def.deliver.x, def.deliver.z);
          else this.complete();
        }
        return;
      }
    }

    const t = this.active.stage === 'go' ? def.target : def.deliver;
    if (!t) { this.complete(); return; }
    const dx = t.x - playerPos.x, dz = t.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 7) {
      if (this.active.stage === 'go') {
        if (def.kind === 'steal-car' && !inCar) {
          this.say('Get in the sedan first — press E next to it.');
          return;
        }
        if (def.kind === 'steal-car' && inCar) {
          this.active.stage = 'deliver';
          this.say('Nice wheels. Now bring the sedan to the lockup.');
          this.showBeacon(def.deliver.x, def.deliver.z);
          return;
        }
        this.active.stage = 'deliver';
        this.say(def.kind === 'fetch' ? 'Case secured. Deliver it to the Bluefin Bar.' : 'Got it. Now deliver.');
        if (def.deliver) this.showBeacon(def.deliver.x, def.deliver.z);
        else this.complete();
      } else {
        this.complete();
      }
    }
  };

  Missions.prototype.complete = function () {
    if (!this.active) return;   // already completed or abandoned
    const def = this.active.def;
    this.game.money += def.reward;
    this.completed++;
    this.index++;
    this.active = null;
    this.hideBeacon();
    this.say('Job complete: ' + def.name + ' — +$' + def.reward);
    if (this.game.audio) this.game.audio.missionDone();
    this.game.save();
  };

  Missions.prototype.abandon = function () {
    this.active = null;
    this.hideBeacon();
    this.say('Job abandoned.');
  };

  SB.Missions = Missions;
})();
