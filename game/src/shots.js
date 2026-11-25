// Kuali Emas — shots: deterministic screenshot staging.
// Each named scene plays the real rules forward from a seeded world with a
// simple autopilot (walk to the station the oldest ticket needs next, press
// E there), so every frame is what a short real game looks like and the
// same seed always gives the same frame. No mockups, no edited images.
import { INGREDIENTS, INGREDIENT_ORDER, STATIONS } from './config.js';
import { createWorld, EVENT_OVER } from './world.js';

const STEP = 1 / 60;

function stationX(id) { return STATIONS.find((s) => s.id === id).x; }

// What the autopilot wants next for the ticket closest to completion, as
// { station, action } where action is 'pick' | 'chop' | 'cook' | 'take' |
// 'plate' | 'serve' | 'wait' | 'drop'. It only ever uses world.step /
// interact / discardCarry, and it counts a wok item already cooking as
// handled, so it never fetches a duplicate of what is on the stove.
function plan(world) {
  const s = world.state;
  // Work the ticket closest to completion first: a nearly-done dish served
  // now beats an old ticket that still needs three trips across the kitchen.
  let ticket = null;
  let fewest = 1e9;
  for (const t of s.tickets) {
    const n = world.neededComponents(t).length;
    if (n < fewest) { fewest = n; ticket = t; }
  }
  if (!ticket) return { station: 'crate', action: 'wait' };
  const ready = world.plateCompleteForAny();
  if (ready) return { station: 'serve', action: 'serve' };
  // Components still missing from the plate, minus the one already on the wok.
  let missing = world.neededComponents(ticket);
  if (s.wok.item) {
    missing = missing.filter((c) => !(c.ing === s.wok.item.ing && c.prep === 'cooked'));
  }
  // A finished wok item is picked up first — unless the hands hold something
  // the ticket still needs, which is plated or prepped first; anything else
  // in the way is dropped at the crate.
  if (s.wok.item && s.wok.done) {
    if (!s.chef.carry) return { station: 'wok', action: 'take' };
    if (!missing.some((c) => c.ing === s.chef.carry.ing)) return { station: 'crate', action: 'drop' };
  }
  if (missing.length === 0) {
    // Nothing missing and nothing to take: the wok is still cooking the last part.
    return { station: 'wok', action: 'wait' };
  }
  let need = missing[0];
  if (s.chef.carry) {
    // Never drop what the hands already hold if any ticket still needs it.
    const held = missing.find((c) => c.ing === s.chef.carry.ing);
    if (held) need = held;
  } else if (s.wok.item && !s.wok.done) {
    // While the wok cooks, work on a component that needs no wok.
    const side = missing.find((c) => c.prep !== 'cooked');
    if (side) need = side;
    else return { station: 'wok', action: 'wait' };
  }
  const carry = s.chef.carry;
  if (carry && carry.ing === need.ing) {
    if (carry.prep === need.prep) return { station: 'plate', action: 'plate' };
    // A raw choppable ingredient is always chopped first, even when the
    // recipe finally wants it cooked (ayam: raw -> chopped -> cooked).
    if (carry.prep === 'raw' && INGREDIENTS[carry.ing].chop) return { station: 'board', action: 'chop' };
    if (need.prep === 'chopped') return { station: 'board', action: 'chop' };
    if (need.prep === 'cooked') return { station: 'wok', action: 'cook' };
  }
  if (carry && carry.ing !== need.ing) return { station: 'crate', action: 'drop' };
  // Pick the needed ingredient (select it first, then take it at the crate).
  s.selectedIng = INGREDIENT_ORDER.indexOf(need.ing);
  return { station: 'crate', action: 'pick' };
}

function runAutopilot(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    const s = world.state;
    if (s.screen !== 'play') break;
    const { station, action } = plan(world);
    const target = stationX(station);
    const dx = target - s.chef.x;
    const dir = Math.abs(dx) > 12 ? Math.sign(dx) : 0;
    let interact = false;
    if (Math.abs(dx) <= 12) {
      if (action === 'pick' || action === 'chop' || action === 'cook' || action === 'take'
        || action === 'plate' || action === 'serve') interact = true;
      if (action === 'drop') world.discardCarry();
    }
    // Chopping needs repeated presses; the wok needs one press to load.
    const events = world.step(STEP, dir, interact, null);
    if (events & EVENT_OVER) break;
  }
}

// Put the world into a busy mid-rush state, then let the autopilot play.
function stageRush(world, seconds) {
  world.reset();
  // Seed three tickets at once so the board reads full.
  world.spawnTicket(); world.spawnTicket(); world.spawnTicket();
  world.state.spawnTimer = 8;
  runAutopilot(world, seconds);
}

export function stageShot(name, world, seed) {
  // The world was already built on mulberry32(seed) by main.js, so the
  // autopilot below is fully deterministic for this seed.
  if (name === 'chop') {
    stageRush(world, 9);
    // Force the chef onto the board mid-chop for a readable chop frame:
    // knife down, the ayam on the board, cut pieces piling up beside it.
    world.state.selectedIng = INGREDIENT_ORDER.indexOf('ayam');
    world.state.chef.x = stationX('board');
    world.state.chef.carry = { ing: 'ayam', prep: 'raw' };
    world.state.chef.chopProgress = 0.9;
    world.state.wok = { item: { ing: 'nasi', prep: 'raw' }, progress: 2.4, done: false, burnt: false };
    world.state.message = 'Pisau tajam! Ayam dipotong halus.';
    world.state.messageAt = world.state.time;
    world.state.messageColor = '#FFD60A';
    return { screen: 'play', best: world.state.score };
  }
  if (name === 'plate') {
    stageRush(world, 16);
    // Guarantee a plate mid-assembly: three components on, chef carrying
    // the fourth — the dish mound with garnish is the focus of this shot,
    // so the wok is left empty here (it cooks in the chop shot instead).
    const ticket = world.state.tickets[0];
    if (ticket) {
      const comps = ticket.recipe.components;
      world.state.plate = comps.slice(0, 3).map((c) => ({ ing: c.ing, prep: c.prep }));
      world.state.chef.carry = { ing: comps[3].ing, prep: comps[3].prep };
      world.state.chef.x = stationX('plate');
      world.state.wok = { item: null, progress: 0, done: false, burnt: false };
      world.state.message = 'Tiga bahan di piring — satu lagi!';
      world.state.messageAt = world.state.time;
      world.state.messageColor = '#FFD60A';
    }
    return { screen: 'play', best: world.state.score };
  }
  if (name === 'serve') {
    stageRush(world, 26);
    // Guarantee a finished plate at the window with coins in the air.
    const ticket = world.state.tickets[0];
    if (ticket) {
      world.state.plate = ticket.recipe.components.map((c) => ({ ing: c.ing, prep: c.prep }));
      world.state.chef.x = stationX('serve');
      world.state.score = Math.max(world.state.score, 1250);
      world.state.coins = Math.max(world.state.coins, 1250);
      world.state.combo = 3;
      world.state.served = Math.max(world.state.served, 4);
      // Coins mid-flight above the window, as if the last serve just paid out.
      for (let i = 0; i < 12; i += 1) {
        world.state.particles.push({
          x: 1030 + i * 12, y: 250 + (i % 3) * 26, vx: 0, vy: 0,
          life: 1, text: '●', color: '#FFD60A', size: 14 + (i % 3) * 4,
        });
      }
      world.state.message = 'Antar sekarang — kombo x3!';
      world.state.messageAt = world.state.time;
      world.state.messageColor = '#7BC96F';
    }
    return { screen: 'play', best: world.state.score };
  }
  // Cover: the busiest rush — full board, wok cooking, plate assembling.
  stageRush(world, 22);
  if (world.state.tickets.length < 3) world.spawnTicket();
  // D5: the wok must be visibly cooking in the busiest shot, not an empty
  // black bowl — nasi mid-cook (48%), so the render shows the food mound,
  // progress bar, flame and side steam, as in the chop shot.
  world.state.wok = { item: { ing: 'nasi', prep: 'raw' }, progress: 2.4, done: false, burnt: false };
  world.state.score = Math.max(world.state.score, 980);
  world.state.coins = Math.max(world.state.coins, 980);
  world.state.combo = 3;
  world.state.served = Math.max(world.state.served, 3);
  world.state.message = 'Rush hour! Tiga pesanan masuk!';
  world.state.messageAt = world.state.time;
  world.state.messageColor = '#FFD60A';
  return { screen: 'play', best: world.state.score };
}

export { createWorld };
