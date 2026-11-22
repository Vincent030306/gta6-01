// Solmar Bay — combat: the player's pistol, enemy gunmen, health and ammo.
// Hitscan shooting with a visible tracer; enemies take cover positions and
// fire back with a short wind-up so the player can dodge.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function Combat(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.ammo = 24;
    this.reserve = 120;
    this.cooldown = 0;
    this.enemies = [];
    this.tracers = [];
    this.rng = SB.mulberry32(4242);
  }

  Combat.prototype.spawnEnemies = function (x, z, count) {
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 1.1, 0.45),
        new THREE.MeshLambertMaterial({ color: 0x4a235a })
      );
      body.position.y = 1.05; body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xd8a070 })
      );
      head.position.y = 1.85;
      const gun = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.9),
        new THREE.MeshLambertMaterial({ color: 0x111111 })
      );
      gun.position.set(0.4, 1.2, 0.4);
      g.add(body); g.add(head); g.add(gun);
      const ex = x + SB.rand(this.rng, -18, 18);
      const ez = z + SB.rand(this.rng, -18, 18);
      g.position.set(ex, 0, ez);
      this.scene.add(g);
      this.enemies.push({
        mesh: g, x: ex, z: ez, health: 60,
        shootTimer: SB.rand(this.rng, 1, 3), alive: true,
      });
    }
  };

  Combat.prototype.enemiesAlive = function () {
    let n = 0;
    for (let i = 0; i < this.enemies.length; i++) if (this.enemies[i].alive) n++;
    return n;
  };

  Combat.prototype.clearEnemies = function () {
    for (let i = 0; i < this.enemies.length; i++) this.scene.remove(this.enemies[i].mesh);
    this.enemies = [];
  };

  // Fire from the camera toward the crosshair: nearest enemy within a cone.
  Combat.prototype.shoot = function (origin, dir) {
    if (this.cooldown > 0 || this.ammo <= 0) return false;
    this.cooldown = 0.28;
    this.ammo--;
    if (this.game.audio) this.game.audio.shot();
    let best = null, bestT = 120;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const ex = e.x - origin.x, ey = 1.4 - origin.y, ez = e.z - origin.z;
      const t = ex * dir.x + ey * dir.y + ez * dir.z;
      if (t < 1 || t > bestT) continue;
      const px = origin.x + dir.x * t - e.x;
      const py = origin.y + dir.y * t - 1.4;
      const pz = origin.z + dir.z * t - e.z;
      if (px * px + py * py + pz * pz < 2.4) { best = e; bestT = t; }
    }
    const end = {
      x: origin.x + dir.x * bestT,
      y: origin.y + dir.y * bestT,
      z: origin.z + dir.z * bestT,
    };
    this.addTracer(origin, end);
    if (best) {
      best.health -= 34;
      if (best.health <= 0) {
        best.alive = false;
        best.mesh.visible = false;
        this.game.money += 25;
        this.reserve += 12;   // the gunman drops spare ammo
        this.game.addWanted(6);
        if (this.game.audio) this.game.audio.pickup();
      }
    }
    return true;
  };

  Combat.prototype.addTracer = function (from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
    this.scene.add(line);
    this.tracers.push({ line: line, life: 0.09 });
  };

  Combat.prototype.reload = function () {
    if (this.ammo >= 24 || this.reserve <= 0) return;
    const need = 24 - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
  };

  Combat.prototype.update = function (dt, playerPos) {
    if (this.cooldown > 0) this.cooldown -= dt;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      }
    }
    // Enemies strafe toward the player and shoot with a visible wind-up.
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      if (dist > 14) {
        e.x += (dx / dist) * 3.2 * dt;
        e.z += (dz / dist) * 3.2 * dt;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 42) {
        e.shootTimer = SB.rand(this.rng, 1.6, 2.8);
        this.addTracer({ x: e.x, y: 1.3, z: e.z }, { x: playerPos.x, y: 1.4, z: playerPos.z });
        if (this.game.audio) this.game.audio.shot();
        if (Math.random() < 0.45) {
          this.game.damage(7);
        }
      }
    }
  };

  SB.Combat = Combat;
})();
