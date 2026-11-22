// Solmar Bay — the wanted level and the Solmar Bay Police Department.
// Crimes raise stars; police cars spawn at the city edge and chase, ram and
// try to box the player in. Lay low and the heat cools off.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function Police(scene, world) {
    this.scene = scene;
    this.world = world;
    this.wanted = 0;
    this.heat = 0;        // 0..100, stars are heat / 20
    this.coolTimer = 0;
    this.cars = [];
    this.spawnTimer = 0;
    this.flashTimer = 0;
  }

  Police.prototype.addHeat = function (amount) {
    this.heat = SB.clamp(this.heat + amount, 0, 100);
    const stars = Math.ceil(this.heat / 20);
    const rose = stars > this.wanted;
    this.wanted = stars;
    this.coolTimer = 0;
    return rose;
  };

  Police.prototype.setWanted = function (stars) {
    this.wanted = SB.clamp(stars, 0, SB.CONFIG.maxWanted);
    this.heat = this.wanted * 20;
    this.coolTimer = 0;
  };

  Police.prototype.update = function (dt, playerPos, playerSpeed, audio) {
    const C = SB.CONFIG;
    // Heat cools only while the player is slow and out of a chase.
    if (this.wanted > 0) {
      this.coolTimer += dt;
      const chasing = this.cars.length > 0;
      if (!chasing && playerSpeed < 3 && this.coolTimer > 6) {
        this.heat -= dt * 4;
        if (this.heat <= 0) { this.heat = 0; this.wanted = 0; }
        else this.wanted = Math.ceil(this.heat / 20);
      }
    }
    // Desired police cars: one per star, up to five.
    const want = this.wanted;
    this.spawnTimer -= dt;
    if (this.cars.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      this.spawnCar(playerPos);
    }
    while (this.cars.length > want) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
    }
    // Chase: steer toward the player, ram on contact, flash the light bar.
    this.flashTimer += dt;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const dxp = car.x - playerPos.x, dzp = car.z - playerPos.z;
      // A pursuit car that lost the player far away gives up and despawns.
      if (dxp * dxp + dzp * dzp > 90000) {
        this.scene.remove(car.mesh);
        this.cars.splice(i, 1);
        continue;
      }
      const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      car.heading = SB.angleLerp(car.heading, targetHeading, Math.min(1, dt * 2.2));
      car.speed = SB.lerp(car.speed, 30 + this.wanted * 2, Math.min(1, dt));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = SB.collideCircle(this.world, car.x, car.z, 1.6);
      car.x = fixed.x; car.z = fixed.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      if (car.mesh.userData.lightBar) {
        car.mesh.userData.lightBar.material.color.setHex(
          Math.floor(this.flashTimer * 2.4) % 2 === 0 ? 0xff2222 : 0x2266ff
        );
      }
      car.rammed = dist < 3.2;
    }
    if (audio) audio.updateSiren(dt, this.wanted);
  };

  Police.prototype.spawnCar = function (playerPos) {
    const C = SB.CONFIG;
    const half = C.worldSize / 2;
    const angle = Math.random() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * 90;
    const z = playerPos.z + Math.sin(angle) * 90;
    const clamped = SB.collideCircle(this.world, SB.clamp(x, -half, half), SB.clamp(z, -half, half), 1.6);
    const mesh = SB.makeCarMesh(0xffffff, true);
    // Police livery: white body with a black hood stripe.
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.06, 4.0),
      new THREE.MeshLambertMaterial({ color: 0x111111 })
    );
    stripe.position.y = 1.04;
    mesh.add(stripe);
    mesh.position.set(clamped.x, 0, clamped.z);
    this.scene.add(mesh);
    this.cars.push({
      mesh: mesh, x: clamped.x, z: clamped.z,
      heading: Math.atan2(playerPos.x - clamped.x, playerPos.z - clamped.z),
      speed: 18, rammed: false,
    });
  };

  // Busted when a police car stays in contact for a while.
  Police.prototype.bustedCheck = function (dt) {
    let contact = 0;
    for (let i = 0; i < this.cars.length; i++) if (this.cars[i].rammed) contact++;
    return contact > 0 && this.wanted >= 3;
  };

  SB.Police = Police;
})();
