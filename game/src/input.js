// Kuali Emas — input: keyboard (WASD/arrows + E/Space + 1-8 + Q + M) and mouse.
// Clicking a station walks the chef there; clicking an ingredient picks it.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // edge-triggered, consumed by the game each frame
  let click = null;          // { x, y } in canvas pixels, consumed each frame

  function keyOf(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    return k;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyOf(e);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    if (!e.repeat) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyOf(e)));
  window.addEventListener('blur', () => { keys.clear(); pressed.clear(); });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    click = {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  });

  return {
    // -1 left, 0 still, +1 right, from held keys.
    moveDirection() {
      const left = keys.has('a') || keys.has('ArrowLeft');
      const right = keys.has('d') || keys.has('ArrowRight');
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    interactPressed() { return pressed.has('e') || pressed.has(' ') || pressed.has('Enter'); },
    discardPressed() { return pressed.has('q'); },
    mutePressed() { return pressed.has('m'); },
    restartPressed() { return pressed.has('r'); },
    startPressed() { return pressed.has('Enter') || pressed.has(' '); },
    // Number keys 1-8 select an ingredient at the crate; -1 when none.
    numberPressed() {
      for (let n = 1; n <= 8; n += 1) if (pressed.has(String(n))) return n - 1;
      return -1;
    },
    takeClick() { const c = click; click = null; return c; },
    endFrame() { pressed.clear(); },
  };
}
