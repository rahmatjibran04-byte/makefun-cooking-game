// Kuali Emas — world: the cooking rules and state, no drawing, no browser.
// The chef carries one item at a time along a fixed route:
//   crate (pick) -> board (chop) -> wok (cook) -> plate (assemble) -> serve.
// step() advances one fixed step and returns event flags the caller turns
// into sound and particles. A seeded RNG makes every run reproducible.
import {
  BURN_TIME, CHEF, CHOP_TIME, COMBO_WINDOW, COOK_TIME, INGREDIENTS,
  INGREDIENT_ORDER, MAX_TICKETS, ORDER_INTERVAL, ORDER_TIME_BASE,
  ORDER_TIME_MIN, RECIPES, SHIFT_SECONDS, STATIONS, TIP_FAST,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_CHOP = 2;
export const EVENT_CHOP_DONE = 4;
export const EVENT_COOK_START = 8;
export const EVENT_COOK_DONE = 16;
export const EVENT_BURN = 32;
export const EVENT_PLATE = 64;
export const EVENT_SERVE = 128;
export const EVENT_ERROR = 256;
export const EVENT_ORDER = 512;
export const EVENT_EXPIRE = 1024;
export const EVENT_OVER = 2048;
export const EVENT_TICK = 4096;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function recipeById(id) { return RECIPES.find((r) => r.id === id); }

export function createWorld(random) {
  const state = {
    screen: 'title', // title | play | over
    time: 0, shiftLeft: SHIFT_SECONDS, spawnTimer: 4, orderCount: 0,
    score: 0, coins: 0, served: 0, failed: 0, combo: 0, bestCombo: 0,
    lastServeAt: -999, tipTotal: 0,
    chef: { x: 640, dir: 1, carry: null, chopProgress: 0, walkTarget: null },
    selectedIng: 0,
    tickets: [], // { id, recipe, timeLeft, total, flash }
    wok: { item: null, progress: 0, done: false, burnt: false },
    plate: [], // [{ ing, prep }]
    particles: [], // { x, y, vx, vy, life, text, color, size }
    floaters: [],  // { x, y, text, life, color }
    message: '', messageAt: -99, messageColor: '#FFD60A',
    tickSecond: -1,
  };
  let nextTicketId = 1;

  function reset() {
    state.screen = 'play'; state.time = 0; state.shiftLeft = SHIFT_SECONDS;
    state.spawnTimer = 4; state.orderCount = 0;
    state.score = 0; state.coins = 0; state.served = 0; state.failed = 0;
    state.combo = 0; state.bestCombo = 0; state.lastServeAt = -999; state.tipTotal = 0;
    state.chef = { x: 640, dir: 1, carry: null, chopProgress: 0, walkTarget: null };
    state.selectedIng = 0; state.tickets = [];
    state.wok = { item: null, progress: 0, done: false, burnt: false };
    state.plate = []; state.particles = []; state.floaters = [];
    state.message = ''; state.messageAt = -99; nextTicketId = 1; state.tickSecond = -1;
  }

  function say(text, color = '#FFD60A') {
    state.message = text; state.messageAt = state.time; state.messageColor = color;
  }

  function addFloater(x, y, text, color) {
    state.floaters.push({ x, y, text, life: 1.4, color });
  }

  function coinBurst(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      state.particles.push({
        x, y, vx: (random() - 0.5) * 260, vy: -140 - random() * 160,
        life: 0.9 + random() * 0.4, text: '●', color: '#FFD60A', size: 13 + random() * 8,
      });
    }
  }

  function spawnTicket() {
    if (state.tickets.length >= MAX_TICKETS) return false;
    const difficulty = Math.min(1, state.time / SHIFT_SECONDS);
    // Never duplicate a dish already on the board: the board reads better
    // and every ticket is a different route through the kitchen.
    const open = RECIPES.filter((r) => !state.tickets.some((t) => t.recipe.id === r.id));
    const pool = open.length ? open : RECIPES;
    const recipe = pool[Math.floor(random() * pool.length)];
    const total = Math.max(ORDER_TIME_MIN, ORDER_TIME_BASE - difficulty * 16);
    state.tickets.push({ id: nextTicketId, recipe, timeLeft: total, total, flash: 0 });
    nextTicketId += 1;
    state.orderCount += 1;
    return true;
  }

  function nearestStation() {
    let best = null; let bestD = 1e9;
    for (const s of STATIONS) {
      const d = Math.abs(s.x - state.chef.x);
      if (d < bestD) { bestD = d; best = s; }
    }
    return bestD <= 110 ? best : null;
  }

  function neededComponents(ticket) {
    return ticket.recipe.components.filter((c) =>
      !state.plate.some((p) => p.ing === c.ing && p.prep === c.prep));
  }

  function plateMatches(ticket) {
    if (state.plate.length !== ticket.recipe.components.length) return false;
    return ticket.recipe.components.every((c) =>
      state.plate.some((p) => p.ing === c.ing && p.prep === c.prep));
  }

  function plateCompleteForAny() {
    return state.tickets.find((t) => plateMatches(t)) || null;
  }

  // --- the five station actions -------------------------------------------
  function actCrate() {
    if (state.chef.carry) return EVENT_ERROR;
    const ing = INGREDIENT_ORDER[state.selectedIng];
    state.chef.carry = { ing, prep: 'raw' };
    state.chef.chopProgress = 0;
    return EVENT_PICKUP;
  }

  function actBoard() {
    const carry = state.chef.carry;
    if (!carry) return EVENT_ERROR;
    const def = INGREDIENTS[carry.ing];
    if (carry.prep !== 'raw' || !def.chop) { say('Tidak perlu dipotong!', '#FF8A80'); return EVENT_ERROR; }
    state.chef.chopProgress += 0.4;
    if (state.chef.chopProgress >= CHOP_TIME) {
      carry.prep = 'chopped';
      state.chef.chopProgress = 0;
      say(`${def.name} sudah dipotong!`, '#7BC96F');
      return EVENT_CHOP_DONE;
    }
    return EVENT_CHOP;
  }

  function actWok() {
    const wok = state.wok;
    if (wok.item) {
      if (wok.burnt) { wok.item = null; wok.progress = 0; wok.burnt = false; say('Dibuang — gosong!', '#FF8A80'); return EVENT_BURN; }
      if (!wok.done) { say('Masih dimasak…', '#FFD60A'); return EVENT_ERROR; }
      if (state.chef.carry) { say('Tangan penuh!', '#FF8A80'); return EVENT_ERROR; }
      state.chef.carry = { ing: wok.item.ing, prep: 'cooked' };
      wok.item = null; wok.progress = 0; wok.done = false;
      return EVENT_PICKUP;
    }
    const carry = state.chef.carry;
    if (!carry) return EVENT_ERROR;
    const def = INGREDIENTS[carry.ing];
    const cookable = (carry.prep === 'chopped' && def.cook) || (carry.prep === 'raw' && def.cook && !def.chop);
    if (!cookable) { say('Bahan ini tidak dimasak!', '#FF8A80'); return EVENT_ERROR; }
    wok.item = { ing: carry.ing, prep: carry.prep };
    wok.progress = 0; wok.done = false; wok.burnt = false;
    state.chef.carry = null;
    return EVENT_COOK_START;
  }

  function actPlate() {
    const carry = state.chef.carry;
    if (!carry) return EVENT_ERROR;
    const wanted = state.tickets.some((t) =>
      t.recipe.components.some((c) => c.ing === carry.ing && c.prep === carry.prep
        && !state.plate.some((p) => p.ing === c.ing && p.prep === c.prep)));
    if (!wanted) { say('Tidak ada pesanan butuh ini!', '#FF8A80'); return EVENT_ERROR; }
    state.plate.push({ ing: carry.ing, prep: carry.prep });
    state.chef.carry = null;
    const done = plateCompleteForAny();
    if (done) say(`${done.recipe.name} SIAP! Antar ke jendela!`, '#7BC96F');
    return EVENT_PLATE;
  }

  function actServe() {
    const ticket = plateCompleteForAny();
    if (!ticket) {
      if (state.plate.length === 0) { say('Piring masih kosong!', '#FF8A80'); return EVENT_ERROR; }
      say('Rakitannya belum lengkap!', '#FF8A80');
      return EVENT_ERROR;
    }
    const fast = ticket.timeLeft >= TIP_FAST;
    const comboKept = state.time - state.lastServeAt <= COMBO_WINDOW;
    state.combo = comboKept ? state.combo + 1 : 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const tip = fast ? Math.round(ticket.recipe.price * 0.25) : 0;
    const comboBonus = (state.combo - 1) * 25;
    const earned = ticket.recipe.price + tip + comboBonus;
    state.score += earned;
    state.coins += earned;
    state.tipTotal += tip;
    state.served += 1;
    state.lastServeAt = state.time;
    state.tickets = state.tickets.filter((t) => t.id !== ticket.id);
    state.plate = [];
    coinBurst(1100, 300, 14);
    addFloater(1100, 260, `+Rp${earned}`, '#FFD60A');
    if (tip > 0) addFloater(1100, 300, `Tip +Rp${tip}!`, '#7BC96F');
    if (state.combo >= 2) addFloater(640, 200, `KOMBO x${state.combo}!`, '#FF6B35');
    return EVENT_SERVE;
  }

  function interact() {
    const station = nearestStation();
    if (!station) { say('Dekati stasiun dulu!', '#FFD60A'); return EVENT_ERROR; }
    switch (station.id) {
      case 'crate': return actCrate();
      case 'board': return actBoard();
      case 'wok': return actWok();
      case 'plate': return actPlate();
      case 'serve': return actServe();
      default: return EVENT_ERROR;
    }
  }

  function discardCarry() {
    if (!state.chef.carry) {
      // Empty-handed at the plating table: clear a stale plate instead.
      if (nearestStation() && nearestStation().id === 'plate' && state.plate.length > 0) {
        state.plate = [];
        say('Piring dikosongkan.', '#FF8A80');
      }
      return 0;
    }
    state.chef.carry = null;
    state.chef.chopProgress = 0;
    say('Bahan dibuang.', '#FF8A80');
    return EVENT_ERROR;
  }

  // --- fixed step ----------------------------------------------------------
  function step(dt, direction, doInteract, clickStationId) {
    let events = 0;
    if (state.screen !== 'play') return events;
    state.time += dt;
    state.shiftLeft = Math.max(0, SHIFT_SECONDS - state.time);

    // Walk-to target (mouse click) beats held keys.
    if (clickStationId) {
      const s = STATIONS.find((x) => x.id === clickStationId);
      if (s) state.chef.walkTarget = s.x;
    }
    if (state.chef.walkTarget !== null) {
      const dx = state.chef.walkTarget - state.chef.x;
      if (Math.abs(dx) < 6) { state.chef.walkTarget = null; }
      else {
        const dir = Math.sign(dx);
        state.chef.x += dir * CHEF.speed * dt;
        state.chef.dir = dir;
        if (Math.sign(state.chef.walkTarget - state.chef.x) !== dir) state.chef.x = state.chef.walkTarget;
      }
    } else if (direction !== 0) {
      state.chef.x = Math.min(1210, Math.max(70, state.chef.x + direction * CHEF.speed * dt));
      state.chef.dir = direction;
    }

    if (doInteract) events |= interact();

    // Orders arrive on a timer; pressure grows as the shift goes on.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = Math.max(7, ORDER_INTERVAL - (state.time / SHIFT_SECONDS) * 4);
      if (spawnTicket()) events |= EVENT_ORDER;
    }

    // Ticket countdowns; an expired ticket costs score and breaks the combo.
    for (const t of state.tickets) {
      t.timeLeft -= dt;
      t.flash = t.timeLeft < 10 ? (t.flash + dt) : 0;
      const sec = Math.ceil(t.timeLeft);
      if (t.timeLeft < 10 && sec !== state.tickSecond) { state.tickSecond = sec; events |= EVENT_TICK; }
    }
    const expired = state.tickets.filter((t) => t.timeLeft <= 0);
    if (expired.length) {
      for (const t of expired) {
        state.failed += 1;
        state.score = Math.max(0, state.score - 50);
        addFloater(640, 150, `${t.recipe.name} hangus! -50`, '#E63946');
      }
      state.combo = 0;
      state.tickets = state.tickets.filter((t) => t.timeLeft > 0);
      // A plate built for a dead ticket would block every new dish, so drop
      // components no remaining ticket needs.
      state.plate = state.plate.filter((p) =>
        state.tickets.some((t) => t.recipe.components.some((c) => c.ing === p.ing && c.prep === p.prep)));
      events |= EVENT_EXPIRE;
    }

    // The wok cooks on its own; leave it too long and it burns.
    const wok = state.wok;
    if (wok.item && !wok.burnt) {
      wok.progress += dt;
      if (!wok.done && wok.progress >= COOK_TIME) { wok.done = true; events |= EVENT_COOK_DONE; }
      if (wok.progress >= BURN_TIME) {
        wok.burnt = true; wok.done = false;
        addFloater(590, 260, 'GOSONG!', '#E63946');
        events |= EVENT_BURN;
      }
    }

    // Particles and floaters.
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.life -= dt; }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const f of state.floaters) { f.y -= 34 * dt; f.life -= dt; }
    state.floaters = state.floaters.filter((f) => f.life > 0);

    if (state.shiftLeft <= 0) {
      state.screen = 'over';
      events |= EVENT_OVER;
    }
    return events;
  }

  return {
    state, reset, step, interact, discardCarry, spawnTicket, plateMatches,
    plateCompleteForAny, neededComponents, nearestStation, recipeById,
  };
}
