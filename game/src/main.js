// Kuali Emas — main: the game loop, screens, input wiring and sound hooks.
// ?shot=<cover|chop|plate|serve>&seed=N stages a deterministic screenshot
// scene instead of the title screen; otherwise the game starts at the title.
import { CANVAS } from './config.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { drawOver, drawTitle, drawWorld } from './render.js';
import { stageShot } from './shots.js';
import {
  createWorld, EVENT_BURN, EVENT_CHOP, EVENT_CHOP_DONE, EVENT_COOK_DONE,
  EVENT_COOK_START, EVENT_ERROR, EVENT_EXPIRE, EVENT_ORDER, EVENT_OVER,
  EVENT_PICKUP, EVENT_PLATE, EVENT_SERVE, EVENT_TICK, mulberry32,
} from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS.width;
canvas.height = CANVAS.height;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '7');

const audio = createAudio();
const input = createInput(canvas);
const world = createWorld(mulberry32(seed));
const state = world.state;

let screen = 'title'; // title | play | over
let lastTime = performance.now();
let shotStaged = false;

function playEvents(events) {
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_CHOP) audio.chop();
  if (events & EVENT_CHOP_DONE) audio.chopDone();
  if (events & EVENT_COOK_START) audio.sizzle();
  if (events & EVENT_COOK_DONE) audio.cookDone();
  if (events & EVENT_BURN) audio.burn();
  if (events & EVENT_PLATE) audio.plate();
  if (events & EVENT_SERVE) { audio.ding(); audio.coin(); }
  if (events & EVENT_ERROR) audio.error();
  if (events & EVENT_ORDER) audio.order();
  if (events & EVENT_TICK) audio.tick();
  if (events & EVENT_EXPIRE) audio.burn();
  if (events & EVENT_OVER) audio.gameOver();
}

function stationIdAt(x, y) {
  // Clicking a station walks there; clicking the crate's ingredient chips
  // selects that ingredient. Returns the station id or null.
  const stations = [
    { id: 'crate', x: 110 }, { id: 'board', x: 350 }, { id: 'wok', x: 590 },
    { id: 'plate', x: 820 }, { id: 'serve', x: 1100 },
  ];
  if (y >= 300 && y <= 430) {
    for (const s of stations) if (Math.abs(x - s.x) <= 95) return s.id;
  }
  return null;
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const t = now / 1000;

  if (shotName && !shotStaged) {
    // Screenshot mode: stage the scene once, then hold the frame still.
    stageShot(shotName, world, seed);
    screen = 'play';
    shotStaged = true;
    drawWorld(ctx, state, 1.2);
    return; // one static frame: the scene is fully staged already
  }

  if (screen === 'title') {
    if (input.startPressed()) {
      audio.unlock();
      world.reset();
      screen = 'play';
    }
    drawTitle(ctx, state, t);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  if (screen === 'over') {
    if (input.restartPressed()) {
      world.reset();
      screen = 'play';
    }
    drawOver(ctx, state);
    input.endFrame();
    requestAnimationFrame(frame);
    return;
  }

  // Playing.
  const click = input.takeClick();
  let clickStation = null;
  if (click) {
    audio.unlock();
    clickStation = stationIdAt(click.x, click.y);
    // Clicking the crate's ingredient chips selects the ingredient.
    if (clickStation === 'crate' && click.y >= 380 && click.y <= 440) {
      const idx = Math.floor((click.x - (110 - 68 + 23)) / 46);
      if (idx >= 0 && idx < 8) state.selectedIng = idx;
    }
    // Clicking a station when already standing at it interacts at once.
    if (clickStation && Math.abs(state.chef.x - ({ crate: 110, board: 350, wok: 590, plate: 820, serve: 1100 })[clickStation]) <= 110) {
      const events = world.interact();
      playEvents(events);
    }
  }
  const num = input.numberPressed();
  if (num >= 0) state.selectedIng = num;
  if (input.mutePressed()) audio.toggleMute();
  if (input.discardPressed()) world.discardCarry();

  const events = world.step(dt, input.moveDirection(), input.interactPressed(), clickStation);
  playEvents(events);
  if (events & EVENT_OVER) screen = 'over';

  drawWorld(ctx, state, t);
  input.endFrame();
  requestAnimationFrame(frame);
}

// A few demo tickets behind the title so it reads as a kitchen at work.
world.state.screen = 'play';
world.spawnTicket();
world.spawnTicket();
world.state.screen = 'title';

requestAnimationFrame(frame);
