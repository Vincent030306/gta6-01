// Solmar Bay — shared configuration and helpers.
// The city of Solmar Bay: a sun-soaked coastal town of nine-by-nine blocks,
// a beach and marina on the south edge, and a downtown of tall towers.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  SB.CONFIG = {
    cityBlocks: 9,          // blocks per side
    blockSize: 46,          // metres per block
    roadWidth: 14,
    worldSize: 9 * 46 + 14, // full span of the road grid
    beachDepth: 60,         // sand + sea strip south of the grid
    playerWalkSpeed: 9,
    playerRunSpeed: 15,
    carTopSpeed: 42,
    carAccel: 26,
    carBrake: 40,
    carTurn: 1.9,
    maxWanted: 5,
    startMoney: 120,
    startHealth: 100,
    saveKey: 'solmar-bay-save-v1',
  };

  // Deterministic random: same seed gives the same city every load, so
  // screenshots and playtests are stable.
  SB.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  SB.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  SB.lerp = function (a, b, t) { return a + (b - a) * t; };
  SB.distance = function (ax, az, bx, bz) {
    const dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  };
  SB.rand = function (rng, lo, hi) { return lo + rng() * (hi - lo); };
  SB.pick = function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; };

  // Angle helpers: keep headings wrapped to -PI..PI.
  SB.wrapAngle = function (a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  SB.angleLerp = function (a, b, t) {
    return a + SB.wrapAngle(b - a) * t;
  };

  // Grid helpers: road centre lines sit every blockSize metres.
  SB.roadCoord = function (i) {
    const c = SB.CONFIG;
    return (i - (c.cityBlocks - 1) / 2) * c.blockSize;
  };
  SB.nearestRoad = function (x) {
    const c = SB.CONFIG;
    const i = Math.round(x / c.blockSize + (c.cityBlocks - 1) / 2);
    const clamped = SB.clamp(i, 0, c.cityBlocks - 1);
    return { index: clamped, coord: SB.roadCoord(clamped) };
  };

  // The story: Rico Vega, a driver fresh out of the Solmar Bay docks, works
  // his way up from courier runs to the Meridian Bank job.
  SB.STORY = {
    hero: 'Rico Vega',
    city: 'Solmar Bay',
    intro: 'Rico Vega came back to Solmar Bay with an empty wallet and a fast pair of hands. ' +
      'The docks remember him. The syndicate remembers him too. Five jobs stand between him ' +
      'and the Meridian Bank score — if the Solmar Bay police do not catch him first.',
  };

  SB.MISSION_DEFS = [
    {
      id: 'm1', name: 'Dockside Courier', giver: 'Mara Quinn',
      brief: 'Mara needs a sealed case picked up from Pier 4 and delivered to the Bluefin Bar. No questions, no stops.',
      target: { x: -138, z: 168 }, targetLabel: 'Pier 4 — pick up the case',
      deliver: { x: 92, z: -46 }, deliverLabel: 'Bluefin Bar — deliver the case',
      reward: 350, kind: 'fetch',
    },
    {
      id: 'm2', name: 'Hot Wheels', giver: 'Mara Quinn',
      brief: 'The case was hot. A fresh sedan is parked by the marina — take it and bring it to the lockup on Harbor Row.',
      target: { x: -92, z: 184 }, targetLabel: 'Marina — take the sedan',
      deliver: { x: 138, z: 92 }, deliverLabel: 'Lockup — park the sedan',
      reward: 500, kind: 'steal-car',
    },
    {
      id: 'm3', name: 'Lose the Tail', giver: 'Eddie Sol',
      brief: 'Eddie tipped off the cops by accident. Get in a car, hit three stars of heat, and lose them before the timer runs out.',
      target: { x: 0, z: 0 }, targetLabel: 'Get wanted, then shake the police',
      deliver: null, deliverLabel: '',
      reward: 650, kind: 'evade',
    },
    {
      id: 'm4', name: 'Warehouse Stand', giver: 'Eddie Sol',
      brief: 'The Vulture crew moved on Eddie\u2019s warehouse. Clear the yard of gunmen, then grab the ledger from the office.',
      target: { x: -138, z: -138 }, targetLabel: 'Warehouse yard — clear the gunmen',
      deliver: { x: -138, z: -138 }, deliverLabel: 'Warehouse office — take the ledger',
      reward: 900, kind: 'combat',
    },
    {
      id: 'm5', name: 'The Meridian Job', giver: 'Mara Quinn',
      brief: 'The big one. Lift the Meridian Bank vault cash, fight past the guards, and deliver it to the hideout on Coral Street.',
      target: { x: 46, z: -138 }, targetLabel: 'Meridian Bank — take the vault cash',
      deliver: { x: 138, z: -92 }, deliverLabel: 'Hideout — deliver the cash',
      reward: 2500, kind: 'heist',
    },
  ];

  SB.PALETTE = {
    sky: 0x8ec9e8, sun: 0xfff2cf, sea: 0x1e7fa8, sand: 0xe8d29a,
    road: 0x33363d, sidewalk: 0x9aa0a3, grass: 0x5da24a,
    building: [0xd8c9a3, 0xb8c4cc, 0xe0a878, 0xa3b8a0, 0xc9b8d8, 0xe8e0d0, 0x9fb8c8],
    car: [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a],
  };
})();
