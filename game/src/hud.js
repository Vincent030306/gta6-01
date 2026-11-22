// Solmar Bay — HUD, minimap, menus and the save banner.
// The minimap is a 2D canvas redrawn every frame: roads, the player arrow,
// traffic, police, and the gold mission beacon.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function HUD(game) {
    this.game = game;
    this.el = {};
    const ids = ['hud', 'health-fill', 'health-num', 'money', 'stars', 'objective',
      'objective-dist', 'speed', 'ammo', 'message', 'minimap', 'crosshair',
      'menu-start', 'menu-pause', 'menu-dead', 'dead-title', 'dead-sub',
      'prompt', 'mission-list', 'toast'];
    for (let i = 0; i < ids.length; i++) {
      this.el[ids[i]] = document.getElementById(ids[i]);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = 0;
  }

  HUD.prototype.show = function (id, visible) {
    if (this.el[id]) this.el[id].style.display = visible ? '' : 'none';
  };

  HUD.prototype.setMenu = function (which) {
    this.show('menu-start', which === 'start');
    this.show('menu-pause', which === 'pause');
    this.show('menu-dead', which === 'dead');
    this.show('hud', which === 'play');
    this.show('crosshair', which === 'play');
  };

  HUD.prototype.setDead = function (title, sub) {
    this.el['dead-title'].textContent = title;
    this.el['dead-sub'].textContent = sub;
    this.setMenu('dead');
  };

  HUD.prototype.toast = function (text) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.toastTimer = 3;
  };

  HUD.prototype.update = function (dt) {
    const g = this.game;
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.style.opacity = '0';
    }
    this.el['health-fill'].style.width = Math.max(0, g.health) + '%';
    this.el['health-num'].textContent = Math.ceil(Math.max(0, g.health));
    this.el.money.textContent = '$' + g.money.toLocaleString('en-US');
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < g.police.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = g.police.wanted > 0 ? '#ffd23f' : '#ffffff';
    const missionText = g.missions.objectiveText();
    this.el.objective.textContent = missionText;
    const target = g.missions.distanceToTarget(g.playerPos());
    this.el['objective-dist'].textContent = target ? Math.round(target.dist) + ' m' : '';
    const speed = g.driving ? Math.abs(Math.round(g.vehicles.playerCar.speed * 2.4)) : 0;
    this.el.speed.textContent = g.driving ? speed + ' km/h' : '';
    this.el.ammo.textContent = g.combat.ammo + ' / ' + g.combat.reserve;
    const msg = g.missions.message;
    this.el.message.textContent = g.missions.messageTimer > 0 ? msg : '';
    this.el.prompt.textContent = g.promptText || '';
    this.drawMinimap();
  };

  HUD.prototype.drawMinimap = function () {
    const g = this.game;
    const ctx = this.mapCtx;
    const S = 168;
    const C = SB.CONFIG;
    const worldSpan = C.worldSize + 40;
    const scale = S / worldSpan;
    const toMap = function (x, z) {
      return { x: S / 2 + x * scale, y: S / 2 + z * scale };
    };
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#16241c';
    ctx.fillRect(0, 0, S, S);
    // Sea strip at the bottom.
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, S / 2 + (C.worldSize / 2) * scale, S, S);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 5;
    for (let i = 0; i < C.cityBlocks; i++) {
      const c = SB.roadCoord(i);
      const p = toMap(c, 0);
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(S, p.y); ctx.stroke();
    }
    // Building blocks between the roads, so the map reads as a city.
    ctx.fillStyle = '#3d5a45';
    for (let bx = 0; bx < C.cityBlocks - 1; bx++) {
      for (let bz = 0; bz < C.cityBlocks - 1; bz++) {
        const cx = (SB.roadCoord(bx) + SB.roadCoord(bx + 1)) / 2;
        const cz = (SB.roadCoord(bz) + SB.roadCoord(bz + 1)) / 2;
        const p = toMap(cx - 11, cz - 11);
        ctx.fillRect(p.x, p.y, 22 * scale, 22 * scale);
      }
    }
    // Mission beacon.
    const target = g.missions.distanceToTarget(g.playerPos());
    if (target) {
      const p = toMap(target.x, target.z);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.stroke();
    }
    // Traffic (white) and police (red/blue).
    const drawDot = function (x, z, color, r) {
      const p = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    };
    for (let i = 0; i < g.traffic.cars.length; i++) {
      const c = g.traffic.cars[i];
      drawDot(c.mesh.position.x, c.mesh.position.z, '#dddddd', 2.5);
    }
    for (let i = 0; i < g.police.cars.length; i++) {
      const c = g.police.cars[i];
      drawDot(c.x, c.z, '#ff4444', 3.5);
    }
    // Player arrow, rotated to the camera heading.
    const pp = toMap(g.playerPos().x, g.playerPos().z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(g.cameraHeading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  HUD.prototype.renderMissionList = function () {
    const list = this.el['mission-list'];
    if (!list) return;
    let html = '';
    SB.MISSION_DEFS.forEach(function (def, i) {
      const done = i < this.game.missions.completed;
      const current = i === this.game.missions.index;
      html += '<div class="mission-row' + (done ? ' done' : '') + (current ? ' current' : '') + '">' +
        '<b>' + (i + 1) + '. ' + def.name + '</b> — ' + def.giver + ' · $' + def.reward +
        (done ? ' ✓' : '') + '</div>';
    }, this);
    list.innerHTML = html;
  };

  SB.HUD = HUD;
})();
