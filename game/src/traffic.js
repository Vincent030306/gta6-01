// Solmar Bay — traffic cars and pedestrians.
// Traffic cars loop the road grid on fixed lanes; pedestrians stroll the
// sidewalks. Both are simple box-built vehicles and walkers, no assets.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function makeCarMesh(color, isPolice) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: color });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2833 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2), glassMat);
    cabin.position.set(0, 1.3, -0.2);
    cabin.castShadow = true;
    group.add(cabin);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
    const wheels = [];
    [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]].forEach(function (p) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(p[0], 0.42, p[1]);
      group.add(w);
      wheels.push(w);
    });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6b0 });
    [-0.65, 0.65].forEach(function (x) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
      h.position.set(x, 0.7, 2.32);
      group.add(h);
    });
    if (isPolice) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.22, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff2222 })
      );
      bar.position.set(0, 1.85, -0.2);
      group.add(bar);
      group.userData.lightBar = bar;
    }
    group.userData.wheels = wheels;
    return group;
  }

  function Traffic(scene, world, seed) {
    this.scene = scene;
    this.world = world;
    this.rng = SB.mulberry32(seed + 7);
    this.cars = [];
    this.peds = [];
    const C = SB.CONFIG;
    // 10 traffic cars, each assigned to one road lane and one direction.
    for (let i = 0; i < 10; i++) {
      const vertical = this.rng() < 0.5;
      const road = SB.roadCoord(Math.floor(this.rng() * C.cityBlocks));
      const lane = this.rng() < 0.5 ? 3.2 : -3.2;
      const along = SB.rand(this.rng, -C.worldSize / 2, C.worldSize / 2);
      const mesh = makeCarMesh(SB.pick(this.rng, SB.PALETTE.car), false);
      mesh.position.set(vertical ? road + lane : along, 0, vertical ? along : road + lane);
      mesh.rotation.y = vertical ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2);
      scene.add(mesh);
      this.cars.push({
        mesh: mesh, vertical: vertical, road: road, lane: lane,
        pos: along, speed: SB.rand(this.rng, 7, 12), heading: mesh.rotation.y,
      });
    }
    // 16 pedestrians wandering the sidewalks.
    const shirtColors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c];
    for (let i = 0; i < 16; i++) {
      const spawn = world.pedSpawns[i % world.pedSpawns.length];
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.1, 0.45),
        new THREE.MeshLambertMaterial({ color: SB.pick(this.rng, shirtColors) })
      );
      body.position.y = 1.05; body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xe8b88a })
      );
      head.position.y = 1.85;
      const legs = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
      );
      legs.position.y = 0.3;
      g.add(body); g.add(head); g.add(legs);
      g.position.set(spawn.x, 0, spawn.z);
      scene.add(g);
      this.peds.push({
        mesh: g, x: spawn.x, z: spawn.z,
        dir: this.rng() * Math.PI * 2,
        speed: SB.rand(this.rng, 1.2, 2.4),
        changeIn: SB.rand(this.rng, 2, 6),
        panicked: false,
      });
    }
  }

  Traffic.prototype.update = function (dt, playerPos, wanted) {
    const C = SB.CONFIG;
    const half = C.worldSize / 2;
    // Traffic cars drive their lane and wrap around the grid edge.
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      c.pos += c.speed * dt * (c.lane > 0 ? 1 : -1) * (c.vertical ? 1 : 1);
      if (c.pos > half + 20) c.pos = -half - 20;
      if (c.pos < -half - 20) c.pos = half + 20;
      if (c.vertical) { c.mesh.position.x = c.road + c.lane; c.mesh.position.z = c.pos; }
      else { c.mesh.position.x = c.pos; c.mesh.position.z = c.road + c.lane; }
      // Brake when another traffic car is directly ahead on the same lane.
      for (let j = 0; j < this.cars.length; j++) {
        if (j === i) continue;
        const o = this.cars[j];
        if (o.vertical !== c.vertical || o.road !== c.road || o.lane !== c.lane) continue;
        const gap = (o.pos - c.pos) * (c.lane > 0 ? 1 : -1);
        if (gap > 0 && gap < 9) { c.pos -= c.speed * dt * 0.8; }
      }
    }
    // Pedestrians stroll, change direction, and flee when wanted is high.
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      p.changeIn -= dt;
      const dxp = p.x - playerPos.x, dzp = p.z - playerPos.z;
      const dist2 = dxp * dxp + dzp * dzp;
      if (wanted >= 2 && dist2 < 900) {
        p.panicked = true;
        p.dir = Math.atan2(dxp, dzp);
        p.speed = 5.5;
      } else if (p.changeIn <= 0) {
        p.panicked = false;
        p.dir = this.rng() * Math.PI * 2;
        p.speed = SB.rand(this.rng, 1.2, 2.4);
        p.changeIn = SB.rand(this.rng, 3, 8);
      }
      p.x += Math.sin(p.dir) * p.speed * dt;
      p.z += Math.cos(p.dir) * p.speed * dt;
      const fixed = SB.collideCircle(this.world, p.x, p.z, 0.6);
      p.x = fixed.x; p.z = fixed.z;
      p.mesh.position.set(p.x, Math.abs(Math.sin(performance.now() / 180 + i)) * 0.06, p.z);
      p.mesh.rotation.y = p.dir;
    }
  };

  // Nearest pedestrian within range — used for hit-and-run wanted gain.
  Traffic.prototype.nearestPed = function (x, z, range) {
    let best = null, bestD = range * range;
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      const dx = p.x - x, dz = p.z - z, d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = p; }
    }
    return best;
  };

  SB.makeCarMesh = makeCarMesh;
  SB.Traffic = Traffic;
})();
