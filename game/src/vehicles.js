// Solmar Bay — drivable cars: parked cars to steal, the player's car,
// arcade handling, and collisions with buildings and traffic.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function Vehicles(scene, world, seed) {
    this.scene = scene;
    this.world = world;
    this.rng = SB.mulberry32(seed + 21);
    this.parked = [];
    this.playerCar = null;   // the car the player is currently driving
    // Parked cars the player can steal, plus the marina sedan for mission 2.
    for (let i = 0; i < 12; i++) {
      const s = world.carSpawns[i % world.carSpawns.length];
      const mesh = SB.makeCarMesh(SB.pick(this.rng, SB.PALETTE.car), false);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = s.heading;
      scene.add(mesh);
      this.parked.push({ mesh: mesh, x: s.x, z: s.z, heading: s.heading, taken: false });
    }
    // Mission 2's sedan, parked by the marina pier.
    const sedan = SB.makeCarMesh(0xc0392b, false);
    sedan.position.set(-92, 0, 184);
    sedan.rotation.y = Math.PI / 2;
    scene.add(sedan);
    this.missionSedan = { mesh: sedan, x: -92, z: 184, heading: Math.PI / 2, taken: false, mission: true };
    this.parked.push(this.missionSedan);
  }

  Vehicles.prototype.nearestParked = function (x, z, range) {
    let best = null, bestD = range * range;
    for (let i = 0; i < this.parked.length; i++) {
      const p = this.parked[i];
      if (p.taken) continue;
      const dx = p.x - x, dz = p.z - z, d2 = dx * dx + dz * dz;
      if (d2 < bestD) { bestD = d2; best = p; }
    }
    return best;
  };

  Vehicles.prototype.enterCar = function (parked) {
    parked.taken = true;
    this.playerCar = {
      mesh: parked.mesh, x: parked.x, z: parked.z,
      heading: parked.heading, speed: 0, steer: 0,
    };
    return this.playerCar;
  };

  Vehicles.prototype.exitCar = function () {
    if (!this.playerCar) return null;
    const car = this.playerCar;
    this.playerCar = null;
    // Leave the car where it stopped, parked again and stealable later.
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    this.parked.push({
      mesh: car.mesh, x: car.x, z: car.z, heading: car.heading, taken: false,
    });
    // Step out on the pavement side, pushed out of any building.
    const out = SB.collideCircle(this.world,
      car.x + Math.sin(car.heading + Math.PI / 2) * 2.5,
      car.z + Math.cos(car.heading + Math.PI / 2) * 2.5, 0.7);
    return { x: out.x, z: out.z };
  };

  // Arcade driving: accelerate, brake/reverse, steer harder at low speed,
  // collide with buildings, and bump traffic cars out of the way.
  Vehicles.prototype.update = function (dt, axes, traffic) {
    const car = this.playerCar;
    if (!car) return { crashed: false, speed: 0 };
    const C = SB.CONFIG;
    const targetSteer = axes.strafe * C.carTurn;
    car.steer = SB.lerp(car.steer, targetSteer, Math.min(1, dt * 6));
    if (axes.forward > 0) car.speed += C.carAccel * dt;
    else if (axes.forward < 0) car.speed -= (car.speed > 0.5 ? C.carBrake : C.carAccel * 0.6) * dt;
    else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    car.speed = SB.clamp(car.speed, -12, C.carTopSpeed);
    const speedFactor = SB.clamp(Math.abs(car.speed) / 14, 0.15, 1);
    car.heading += car.steer * speedFactor * dt * Math.sign(car.speed || 1) * -1;
    let nx = car.x + Math.sin(car.heading) * car.speed * dt;
    let nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const before = { x: nx, z: nz };
    const fixed = SB.collideCircle(this.world, nx, nz, 1.6);
    const crashed = Math.abs(fixed.x - before.x) > 0.05 || Math.abs(fixed.z - before.z) > 0.05;
    if (crashed && Math.abs(car.speed) > 8) {
      car.speed *= -0.25;
    }
    nx = fixed.x; nz = fixed.z;
    // Nudge traffic cars aside on contact.
    if (traffic) {
      for (let i = 0; i < traffic.cars.length; i++) {
        const t = traffic.cars[i];
        const dx = t.mesh.position.x - nx, dz = t.mesh.position.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < 16 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          t.mesh.position.x += (dx / d) * 0.6;
          t.mesh.position.z += (dz / d) * 0.6;
          t.pos += 0.4;
          car.speed *= 0.92;
        }
      }
    }
    car.x = nx; car.z = nz;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const wheels = car.mesh.userData.wheels || [];
    for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x += car.speed * dt * 2;
    return { crashed: crashed, speed: car.speed };
  };

  SB.Vehicles = Vehicles;
})();
