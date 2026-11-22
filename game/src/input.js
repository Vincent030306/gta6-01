// Solmar Bay — keyboard and mouse input.
// WASD moves, mouse orbits the camera (pointer lock on click), E enters and
// exits cars, F or left click fires, Shift runs, Space jumps, P pauses.
window.SB = window.SB || {};
(function () {
  const SB = window.SB;

  function Input(canvas) {
    this.keys = {};
    this.pressed = {};   // keys pressed since the last frame was consumed
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;
    const self = this;

    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      self.keys[e.code] = true;
      self.pressed[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });

    canvas.addEventListener('click', function () {
      if (!self.locked && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (err) { /* pointer lock unavailable */ }
      }
    });
    document.addEventListener('pointerlockchange', function () {
      self.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', function (e) {
      if (self.locked) {
        self.mouseDX += e.movementX || 0;
        self.mouseDY += e.movementY || 0;
      }
    });
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) { self.mouseDown = true; self.mouseClicked = true; }
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) self.mouseDown = false;
    });
    window.addEventListener('blur', function () {
      self.keys = {};
      self.mouseDown = false;
    });
  }

  Input.prototype.down = function (code) { return !!this.keys[code]; };
  Input.prototype.wasPressed = function (code) { return !!this.pressed[code]; };
  Input.prototype.anyKey = function () {
    for (const code in this.keys) if (this.keys[code]) return true;
    return false;
  };

  // Movement axes: forward is W/Up, strafe is A/D, run is Shift.
  Input.prototype.moveAxes = function () {
    let f = 0, s = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    return {
      forward: f, strafe: s,
      run: this.down('ShiftLeft') || this.down('ShiftRight'),
    };
  };

  Input.prototype.consumeMouse = function () {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx: dx, dy: dy };
  };

  Input.prototype.consumeClick = function () {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  };

  // Called at the end of each frame: single-press edges live for one frame.
  Input.prototype.endFrame = function () {
    this.pressed = {};
  };

  SB.Input = Input;
})();
