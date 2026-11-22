// Solmar Bay — the city itself: roads, blocks, towers, palms, beach and sea.
// Built once from a seeded random stream so the layout is identical on
// every load. Colliders are plain boxes the player, cars and police share.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function buildWorld(scene, seed) {
    const C = SB.CONFIG;
    const rng = SB.mulberry32(seed);
    const world = {
      colliders: [],   // {minX,maxX,minZ,maxZ}
      buildings: [],
      palms: [],
      lamps: [],
      carSpawns: [],   // parked-car spots on road edges
      pedSpawns: [],
      bounds: C.worldSize / 2 + C.roadWidth,
    };

    const sun = new THREE.DirectionalLight(0xfff2cf, 2.4);
    sun.position.set(120, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xbfd9e8, 0.85));
    scene.fog = new THREE.Fog(0x9fc8e0, 260, 620);
    scene.background = new THREE.Color(SB.PALETTE.sky);

    // Ground: one big grass slab, roads drawn as dark strips on top.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(C.worldSize + 260, C.worldSize + 260),
      new THREE.MeshLambertMaterial({ color: SB.PALETTE.grass })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = 40;
    ground.receiveShadow = true;
    scene.add(ground);

    const roadMat = new THREE.MeshLambertMaterial({ color: SB.PALETTE.road });
    const sideMat = new THREE.MeshLambertMaterial({ color: SB.PALETTE.sidewalk });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
    for (let i = 0; i < C.cityBlocks; i++) {
      const c = SB.roadCoord(i);
      const span = C.worldSize + C.roadWidth;
      // Vertical road (along Z) and horizontal road (along X).
      const rv = new THREE.Mesh(new THREE.PlaneGeometry(C.roadWidth, span), roadMat);
      rv.rotation.x = -Math.PI / 2; rv.position.set(c, 0.02, 0); rv.receiveShadow = true;
      scene.add(rv);
      const rh = new THREE.Mesh(new THREE.PlaneGeometry(span, C.roadWidth), roadMat);
      rh.rotation.x = -Math.PI / 2; rh.position.set(0, 0.02, c); rh.receiveShadow = true;
      scene.add(rh);
      // Sidewalk border around each road.
      const sv = new THREE.Mesh(new THREE.PlaneGeometry(C.roadWidth + 6, span), sideMat);
      sv.rotation.x = -Math.PI / 2; sv.position.set(c, 0.01, 0);
      scene.add(sv);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(span, C.roadWidth + 6), sideMat);
      sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.01, c);
      scene.add(sh);
      // Centre dashes.
      for (let d = -C.worldSize / 2; d < C.worldSize / 2; d += 12) {
        const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
        dashV.rotation.x = -Math.PI / 2; dashV.position.set(c, 0.04, d);
        scene.add(dashV);
        const dashH = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
        dashH.rotation.x = -Math.PI / 2; dashH.position.set(d, 0.04, c);
        scene.add(dashH);
      }
    }

    // Beach and sea south of the grid (positive Z), with a pier.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(C.worldSize + 260, C.beachDepth),
      new THREE.MeshLambertMaterial({ color: SB.PALETTE.sand })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, C.worldSize / 2 + C.beachDepth / 2);
    sand.receiveShadow = true;
    scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(C.worldSize + 260, 220),
      new THREE.MeshLambertMaterial({ color: SB.PALETTE.sea })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, C.worldSize / 2 + C.beachDepth + 110);
    scene.add(sea);
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 46),
      new THREE.MeshLambertMaterial({ color: 0x8a6b48 })
    );
    pier.position.set(-138, 0.5, C.worldSize / 2 + C.beachDepth + 6);
    pier.castShadow = true;
    scene.add(pier);

    // Buildings: one or two per block, taller toward downtown (centre).
    const winCanvas = makeWindowTexture();
    const winTex = new THREE.CanvasTexture(winCanvas);
    for (let bx = 0; bx < C.cityBlocks - 1; bx++) {
      for (let bz = 0; bz < C.cityBlocks - 1; bz++) {
        const cx = (SB.roadCoord(bx) + SB.roadCoord(bx + 1)) / 2;
        const cz = (SB.roadCoord(bz) + SB.roadCoord(bz + 1)) / 2;
        const distCentre = Math.abs(cx) + Math.abs(cz);
        const tall = distCentre < 90;
        const count = rng() < 0.35 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const w = SB.rand(rng, 16, 26);
          const d = SB.rand(rng, 16, 26);
          const h = tall ? SB.rand(rng, 26, 68) : SB.rand(rng, 10, 30);
          const ox = count === 2 ? (k === 0 ? -9 : 9) : 0;
          const oz = count === 2 ? (k === 0 ? -9 : 9) : 0;
          const color = SB.pick(rng, SB.PALETTE.building);
          const mat = new THREE.MeshLambertMaterial({ color: color, map: winTex });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(cx + ox, h / 2, cz + oz);
          b.castShadow = true; b.receiveShadow = true;
          scene.add(b);
          world.buildings.push(b);
          world.colliders.push({
            minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
            minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2,
          });
          // Rooftop beacon for downtown towers.
          if (h > 50) {
            const beacon = new THREE.Mesh(
              new THREE.SphereGeometry(0.8, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xff4444 })
            );
            beacon.position.set(cx + ox, h + 1, cz + oz);
            scene.add(beacon);
          }
        }
      }
    }

    // Landmarks the missions name: bank, bar, warehouse, marina lockup.
    addLandmark(scene, world, 46, -138, 'Meridian Bank', 0xd8b13a);
    addLandmark(scene, world, 92, -46, 'Bluefin Bar', 0x2e86c1);
    addLandmark(scene, world, -138, -138, 'Warehouse', 0x7d6b52);
    addLandmark(scene, world, 138, 92, 'Lockup', 0x5d6d7e);

    // Palms along the beach and street lamps at intersections.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e9e4f });
    for (let i = 0; i < 40; i++) {
      const x = SB.rand(rng, -C.worldSize / 2, C.worldSize / 2);
      const z = C.worldSize / 2 + SB.rand(rng, 4, C.beachDepth - 6);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
      trunk.position.set(x, 3.5, z);
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.5, 7), leafMat);
      leaves.position.set(x, 8.2, z);
      scene.add(trunk); scene.add(leaves);
      world.palms.push({ x: x, z: z });
    }
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let i = 0; i < C.cityBlocks; i++) {
      for (let j = 0; j < C.cityBlocks; j += 2) {
        const x = SB.roadCoord(i) + 8;
        const z = SB.roadCoord(j) + 8;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 6), poleMat);
        pole.position.set(x, 4, z);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), lampMat);
        lamp.position.set(x, 8.2, z);
        scene.add(pole); scene.add(lamp);
        world.lamps.push({ x: x, z: z });
      }
    }

    // Parked-car spots and pedestrian spawns on road edges.
    for (let i = 0; i < 26; i++) {
      const road = SB.roadCoord(Math.floor(rng() * C.cityBlocks));
      const along = SB.rand(rng, -C.worldSize / 2 + 20, C.worldSize / 2 - 20);
      const vertical = rng() < 0.5;
      world.carSpawns.push({
        x: vertical ? road + 5.5 : along,
        z: vertical ? along : road + 5.5,
        heading: vertical ? 0 : Math.PI / 2,
      });
    }
    for (let i = 0; i < 24; i++) {
      const road = SB.roadCoord(Math.floor(rng() * C.cityBlocks));
      const along = SB.rand(rng, -C.worldSize / 2, C.worldSize / 2);
      world.pedSpawns.push({
        x: road + (rng() < 0.5 ? 9 : -9),
        z: along,
      });
    }
    return world;
  }

  // A canvas texture of lit and dark windows, reused by every building so
  // the towers read as offices and flats at a glance.
  function makeWindowTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 128, 128);
    const rng = SB.mulberry32(99);
    for (let y = 8; y < 120; y += 16) {
      for (let x = 8; x < 120; x += 16) {
        g.fillStyle = rng() < 0.45 ? '#ffe9a8' : '#2c3e50';
        g.fillRect(x, y, 9, 11);
      }
    }
    return cv;
  }

  // A named landmark: a coloured roof plate plus a floating label sprite.
  function addLandmark(scene, world, x, z, label, color) {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(20, 1.2, 14),
      new THREE.MeshLambertMaterial({ color: color })
    );
    plate.position.set(x, 12.5, z);
    scene.add(plate);
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 96;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(10,20,30,0.85)';
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#ffffff';
    g.font = 'bold 44px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 256, 50);
    const tex = new THREE.CanvasTexture(cv);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(34, 6.4, 1);
    sprite.position.set(x, 19, z);
    scene.add(sprite);
  }

  // Circle-vs-box collision: push a circle of radius r out of every box.
  SB.collideCircle = function (world, x, z, r) {
    let px = x, pz = z;
    for (let i = 0; i < world.colliders.length; i++) {
      const b = world.colliders[i];
      const cx = SB.clamp(px, b.minX, b.maxX);
      const cz = SB.clamp(pz, b.minZ, b.maxZ);
      const dx = px - cx, dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * r;
        pz = cz + (dz / d) * r;
      } else if (d2 <= 0.0001) {
        // Centre inside the box: push out along the smallest penetration.
        const pushL = px - (b.minX - r), pushR = (b.maxX + r) - px;
        const pushT = pz - (b.minZ - r), pushB = (b.maxZ + r) - pz;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) px = b.minX - r;
        else if (m === pushR) px = b.maxX + r;
        else if (m === pushT) pz = b.minZ - r;
        else pz = b.maxZ + r;
      }
    }
    const bound = world.bounds;
    px = SB.clamp(px, -bound, bound);
    // South edge stops at the waterline, not past the end of the ground slab.
    pz = SB.clamp(pz, -bound, bound + SB.CONFIG.beachDepth);
    return { x: px, z: pz };
  };

  SB.buildWorld = buildWorld;
})();
