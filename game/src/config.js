// Kuali Emas — configuration: recipes, ingredients, stations, tuning.
// Every dish is built from shared street-food ingredients, so one crate
// feeds every recipe and the player plans routes, not shopping lists.
export const CANVAS = { width: 1280, height: 720 };

export const SHIFT_SECONDS = 180;
export const MAX_TICKETS = 4;
export const ORDER_INTERVAL = 14;
export const ORDER_TIME_BASE = 60;
export const ORDER_TIME_MIN = 32;

// Ingredient catalogue. prep: what a component needs before it can plate.
// chop: needs the board. cook: needs the wok. raw: goes straight to the plate.
export const INGREDIENTS = {
  nasi:   { name: 'Nasi',   short: 'NASI',  color: '#FFF3D6', dark: '#8A6D3B', chop: false, cook: true,  icon: '🍚' },
  mie:    { name: 'Mie',    short: 'MIE',   color: '#FFD166', dark: '#8A5A00', chop: false, cook: true,  icon: '🍜' },
  ayam:   { name: 'Ayam',   short: 'AYAM',  color: '#F4A261', dark: '#7A3E00', chop: true,  cook: true,  icon: '🍗' },
  telur:  { name: 'Telur',  short: 'TELUR', color: '#FFE66D', dark: '#7A5A00', chop: false, cook: true,  icon: '🥚' },
  sayur:  { name: 'Sayur',  short: 'SAYUR', color: '#7BC96F', dark: '#1E5B1E', chop: true,  cook: false, icon: '🥬' },
  cabai:  { name: 'Cabai',  short: 'CABAI', color: '#E63946', dark: '#7A0E18', chop: true,  cook: false, icon: '🌶️' },
  kecap:  { name: 'Kecap',  short: 'KECAP', color: '#6B4226', dark: '#2E1A0A', chop: false, cook: false, icon: '🧴' },
  bawang: { name: 'Bawang', short: 'BAWANG', color: '#E8DCC8', dark: '#6B5B3E', chop: true,  cook: false, icon: '🧅' },
};

export const INGREDIENT_ORDER = ['nasi', 'mie', 'ayam', 'telur', 'sayur', 'cabai', 'kecap', 'bawang'];

// A recipe component: { ing, prep } where prep is 'raw' | 'chopped' | 'cooked'.
export const RECIPES = [
  { id: 'nasi-goreng', name: 'Nasi Goreng', price: 220, color: '#E76F51', components: [
    { ing: 'nasi', prep: 'cooked' }, { ing: 'ayam', prep: 'cooked' },
    { ing: 'telur', prep: 'cooked' }, { ing: 'kecap', prep: 'raw' } ] },
  { id: 'mie-goreng', name: 'Mie Goreng', price: 200, color: '#F4A261', components: [
    { ing: 'mie', prep: 'cooked' }, { ing: 'ayam', prep: 'cooked' },
    { ing: 'sayur', prep: 'chopped' }, { ing: 'kecap', prep: 'raw' } ] },
  { id: 'sate-ayam', name: 'Sate Ayam', price: 260, color: '#E9C46A', components: [
    { ing: 'ayam', prep: 'cooked' }, { ing: 'kecap', prep: 'raw' },
    { ing: 'cabai', prep: 'chopped' }, { ing: 'bawang', prep: 'chopped' } ] },
  { id: 'gado-gado', name: 'Gado-Gado', price: 180, color: '#7BC96F', components: [
    { ing: 'sayur', prep: 'chopped' }, { ing: 'telur', prep: 'cooked' },
    { ing: 'kecap', prep: 'raw' }, { ing: 'bawang', prep: 'chopped' } ] },
  { id: 'soto-ayam', name: 'Soto Ayam', price: 240, color: '#E9C46A', components: [
    { ing: 'ayam', prep: 'cooked' }, { ing: 'mie', prep: 'cooked' },
    { ing: 'sayur', prep: 'chopped' }, { ing: 'cabai', prep: 'chopped' } ] },
  { id: 'ayam-geprek', name: 'Ayam Geprek', price: 230, color: '#E63946', components: [
    { ing: 'ayam', prep: 'cooked' }, { ing: 'nasi', prep: 'cooked' },
    { ing: 'cabai', prep: 'chopped' }, { ing: 'sayur', prep: 'chopped' } ] },
];

// Kitchen stations along the counter, left to right.
export const STATIONS = [
  { id: 'crate',  name: 'PETI BAHAN',  sub: 'ambil bahan  [1-8]', x: 110, color: '#8D6E63' },
  { id: 'board',  name: 'TALENAN',     sub: 'potong  [E]',      x: 350, color: '#A1887F' },
  { id: 'wok',    name: 'KOMPOR',      sub: 'masak  [E]',      x: 590, color: '#5D4037' },
  { id: 'plate',  name: 'MEJA PLATING', sub: 'rakit  [E]',     x: 820, color: '#6D4C41' },
  { id: 'serve',  name: 'JENDELA SERVE', sub: 'antar  [E]',    x: 1100, color: '#2E7D32' },
];

export const CHEF = { speed: 420, y: 512, radius: 34 };
export const CHOP_TIME = 1.6;   // seconds of chopping (E presses add 0.4 each)
export const COOK_TIME = 5.0;   // seconds on the wok before done
export const BURN_TIME = 9.0;   // seconds on the wok before it burns
export const TIP_FAST = 12;     // serve with >=12s left on the ticket: full tip
export const COMBO_WINDOW = 20; // seconds between serves to keep the combo

export const PALETTE = {
  wall: '#C96F3B', wallDark: '#A8542A', floor: '#7A4A2B', floorLine: '#5D3620',
  counter: '#8D5A2B', counterTop: '#D9A05B', cream: '#FFF6E5', ink: '#2B1A12',
  gold: '#FFD60A', green: '#2E7D32', red: '#E63946', teal: '#0E7C6B',
};
