// Interfaz: conecta la lógica del quiz (quiz.js) con la página.
import { Quiz } from './quiz.js';

const $ = (id) => document.getElementById(id);
const input = $('pokemon');
const UNKNOWN = 'sprites/unknown.png';
const CYCLE_MS = 2000;

// Botones de idioma de respuesta (ENG/ESP/ITA van juntos porque casi todos los nombres coinciden)
const LANG_GROUPS = [['ENG', 'ESP', 'ITA'], ['FRE'], ['GER'], ['KOR'], ['JPN'], ['CHT'], ['CHS']];
const MISSED_LANGS = ['ENG', 'FRE', 'GER', 'ESP', 'ITA', 'KOR', 'JPN', 'CHT', 'CHS'];

// Orden del selector de tipos (3 columnas, como la original) y abreviaturas para móvil
const TYPE_MENU = ['normal', 'ground', 'bug', 'water', 'flying', 'rock', 'grass', 'fighting', 'ghost',
  'fire', 'poison', 'steel', 'electric', 'psychic', 'dragon', 'ice', 'dark', 'fairy'];
const TYPE_ABBR = { normal: 'NRM', ground: 'GRD', bug: 'BUG', water: 'WTR', flying: 'FLY', rock: 'RCK', grass: 'GRS',
  fighting: 'FGT', ghost: 'GHT', fire: 'FIR', poison: 'PSN', steel: 'STL', electric: 'ELC', psychic: 'PSY',
  dragon: 'DRG', ice: 'ICE', dark: 'DRK', fairy: 'FRY' };
// Iconos que rotan en los botones de cada generación
const STARTERS = [['bulbasaur', 'charmander', 'squirtle'], ['cyndaquil', 'totodile', 'chikorita'],
  ['mudkip', 'treecko', 'torchic'], ['turtwig', 'chimchar', 'piplup'], ['tepig', 'oshawott', 'snivy'],
  ['froakie', 'chespin', 'fennekin'], ['rowlet', 'litten', 'popplio'], ['scorbunny', 'sobble', 'grookey'],
  ['quaxly', 'sprigatito', 'fuecoco']];
const SPECIAL_BOXES = [
  { key: 'sub-legendary', title: 'Sub-Legendary', column: 1, flag: 'subLegendary' },
  { key: 'legendary', title: 'Legendary', column: 1, flag: 'legendary' },
  { key: 'mythical', title: 'Mythical', column: 1, flag: 'mythical' },
  { key: 'ultrabeast', title: 'Ultra Beast', column: 2, flag: 'ultraBeast' },
  { key: 'paradox', title: 'Paradox', column: 2, flag: 'paradox' },
];

let data, quiz;
// Una casilla por especie y caja: sus formas comparten casilla y van rotando
// { box, base, frames: [{ src, id }], img, state: null | 'named' | 'revealed', item }
let slots = [];
let slotsByBase = new Map();
const sectionEl = new Map(); // caja -> elemento
const selectedGens = new Set();
const state = { started: false, over: false, timer: null, startTime: 0, elapsed: 0, tick: 0, missingno: false };
let revealTimeouts = [];

const spriteSrc = (file) => `sprites/normal/${file}`;

// ------------------------------------------------------------ arranque

async function init() {
  data = await (await fetch('data/pokemon.json')).json();
  quiz = new Quiz(data);
  buildLanguageButtons();
  buildMenus();
  bindEvents();
  setInterval(cycleSprites, CYCLE_MS);
  $('loading').hidden = true;
  $('menu').hidden = false;
}

// layout: 'full' (5 columnas), 'gens' (cajas a lo ancho), 'types' o 'special' (cajas por categoría)
function buildBoard(entries, layout) {
  const columns = [];
  slots = [];
  slotsByBase = new Map();
  sectionEl.clear();
  const boxes = layout === 'special' ? SPECIAL_BOXES : data.sections;
  const boxOf = layout === 'special'
    ? (e) => SPECIAL_BOXES.find((b) => e[b.flag])?.key
    : (e) => e.section;
  for (const s of boxes) {
    const inSection = entries.filter((e) => boxOf(e) === s.key);
    if (!inSection.length) continue;
    const column = layout === 'gens' ? 1 : s.column;
    columns[column] ??= Object.assign(document.createElement('div'), { className: 'column' });
    const box = document.createElement('div');
    box.className = 'box section';
    box.dataset.key = s.key;
    box.innerHTML = `<h3>${s.title}</h3><div class="slots"></div>`;

    const groups = new Map();
    for (const e of inSection) {
      if (!groups.has(e.base)) groups.set(e.base, []);
      groups.get(e.base).push(e);
    }
    for (const [base, group] of groups) {
      const allFrames = group.length > 1
        ? group.map((e) => ({ src: spriteSrc(e.sprite), id: e.id }))
        : (group[0].cycle ?? [group[0].sprite]).map((f) => ({ src: spriteSrc(f), id: group[0].id }));
      const frames = [...new Map(allFrames.map((f) => [f.src, f])).values()]; // sin dibujos repetidos
      const el = document.createElement('span');
      el.className = 'slot';
      const img = new Image();
      img.alt = '';
      el.append(img);
      box.lastChild.append(el);
      const slot = { box: s.key, base, frames, img, state: null, item: null };
      renderSlot(slot);
      slots.push(slot);
      if (!slotsByBase.has(base)) slotsByBase.set(base, []);
      slotsByBase.get(base).push(slot);
    }
    sectionEl.set(s.key, box);
    columns[column].append(box);
  }
  $('boxes').replaceChildren(...columns.filter(Boolean));
}

function buildLanguageButtons() {
  const enabled = new Set(['ENG', 'ESP', 'ITA']);
  // Como la original: se añade el idioma del navegador
  const nav = navigator.language.toLowerCase();
  const extra = nav.startsWith('de') ? 'GER' : nav.startsWith('fr') ? 'FRE' : nav.startsWith('ko') ? 'KOR'
    : nav.startsWith('ja') ? 'JPN' : /^zh-(tw|hk|hant)/.test(nav) ? 'CHT' : nav.startsWith('zh') ? 'CHS' : null;
  if (extra) enabled.add(extra);

  for (const group of LANG_GROUPS) {
    const b = document.createElement('button');
    b.className = 'lang';
    b.textContent = group.join(' / ');
    b.classList.toggle('active', group.every((l) => enabled.has(l)));
    b.onclick = () => {
      const on = !b.classList.contains('active');
      const next = new Set(quiz.languages);
      for (const l of group) on ? next.add(l) : next.delete(l);
      if (!next.size) return; // siempre al menos un idioma
      b.classList.toggle('active', on);
      quiz.setLanguages(LANG_GROUPS.flat().filter((l) => next.has(l)));
      renderMissedLang();
      input.focus();
    };
    $('langs').append(b);
  }
  quiz.setLanguages(LANG_GROUPS.flat().filter((l) => enabled.has(l)));

  for (const lang of MISSED_LANGS) {
    const b = document.createElement('button');
    b.className = 'lang';
    b.textContent = lang;
    b.dataset.lang = lang;
    b.onclick = () => { quiz.currentLang = lang; renderMissedLang(); };
    $('missed-langs').append(b);
  }
}

// ------------------------------------------------------------ menús de quiz

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function buildMenus() {
  // Generaciones: selección múltiple (el único cambio respecto a la original)
  STARTERS.forEach((_, i) => {
    const gen = i + 1;
    const b = document.createElement('button');
    b.className = 'genbtn';
    b.dataset.gen = gen;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="mhide">Gen ${gen}</span><span class="mshow">${gen}</span><img alt="">`;
    b.onclick = () => {
      selectedGens.has(gen) ? selectedGens.delete(gen) : selectedGens.add(gen);
      renderGenSelection();
    };
    $('gen-grid').append(b);
  });

  for (const type of TYPE_MENU) {
    const b = document.createElement('button');
    b.className = 'typebtn';
    b.dataset.theme = type;
    b.innerHTML = `<img src="images/types/${type}.svg" alt=""><span class="mhide">${cap(type)}</span><span class="mshow">${TYPE_ABBR[type]}</span>`;
    b.onclick = () => requestQuiz(() => startType(type));
    $('type-grid').append(b);
  }
  renderMenuIcons();
}

function renderGenSelection() {
  for (const b of $('gen-grid').children) {
    b.setAttribute('aria-pressed', String(selectedGens.has(Number(b.dataset.gen))));
  }
  $('start-gens').disabled = selectedGens.size === 0;
}

// Los botones de generación muestran sus iniciales y el de tipos va cambiando de tipo
function renderMenuIcons() {
  [...$('gen-grid').children].forEach((b, i) => {
    const starters = STARTERS[i];
    const e = quiz.entriesByBase.get(starters[state.tick % starters.length])[0];
    b.querySelector('img').src = spriteSrc(e.sprite);
  });
  const type = TYPE_MENU[state.tick % TYPE_MENU.length];
  $('types-icon').src = `images/types/${type}.svg`;
  $('open-types').dataset.theme = type;
}

function closeMenus() {
  $('start').hidden = true;
  $('types').hidden = true;
}

function startFull() {
  startQuiz('Full', data.entries, 'full');
}

function startGens() {
  const gens = [...selectedGens].sort((a, b) => a - b);
  const name = gens.length === 1 ? `Generation ${gens[0]}` : `Gen ${gens.join(' · ')}`;
  startQuiz(name, data.entries.filter((e) => selectedGens.has(e.generation)), 'gens');
}

function startType(type) {
  startQuiz(`${cap(type)} type`, data.entries.filter((e) => e.types.includes(type)), 'types', type);
}

function startSpecial() {
  const entries = data.entries.filter((e) => SPECIAL_BOXES.some((b) => e[b.flag]));
  startQuiz('Special', entries, 'special', 'special');
}

// ------------------------------------------------------------ casillas

const frameOf = (slot) => slot.frames[state.tick % slot.frames.length];

function renderSlot(slot) {
  if (slot.state) {
    slot.img.src = frameOf(slot).src;
  } else {
    slot.img.src = UNKNOWN;
    slot.img.className = 'empty';
  }
}

function showSlot(slot, newState, cls) {
  slot.state = newState;
  slot.img.className = cls;
  renderSlot(slot);
  const inBox = slots.filter((s) => s.box === slot.box);
  if (inBox.every((s) => s.state)) sectionEl.get(slot.box).classList.add('outline');
}

// Cada 2 s, las casillas con varias formas pasan a la siguiente (y su nombre en "Missed names")
function cycleSprites() {
  state.tick++;
  renderMenuIcons();
  for (const slot of slots) {
    if (slot.frames.length < 2) continue;
    if (slot.state) slot.img.src = frameOf(slot).src;
    if (slot.item) renderMissedItem(slot);
  }
}

// ------------------------------------------------------------ quiz

// Cambiar de quiz con aciertos pide confirmación ("Switch Quiz?"), como la original
function requestQuiz(start) {
  closeMenus();
  if (quiz.score === 0) return start();
  $('switch').hidden = false;
  $('switch-yes').onclick = () => { $('switch').hidden = true; start(); };
}

function startQuiz(name, entries, layout, theme = '') {
  quiz.setQuiz(name, entries);
  document.body.dataset.layout = layout;
  document.body.dataset.theme = theme;
  $('bgicon').style.maskImage = `url(images/types/${theme}.svg)`;
  $('bgicon').hidden = !theme || theme === 'special';
  $('quizname').textContent = name;
  $('quizname').hidden = layout !== 'gens';
  buildBoard(entries, layout);
  resetBoard();
  closeMenus();
  $('inputbox').classList.remove('shake');
  void $('inputbox').offsetWidth;
  $('inputbox').classList.add('shake');
  input.focus();
}

function resetBoard() {
  quiz.reset();
  stopTimer();
  state.started = false;
  state.over = false;
  state.elapsed = 0;
  state.missingno = false;
  for (const timeout of revealTimeouts) clearTimeout(timeout);
  revealTimeouts = [];
  for (const slot of slots) {
    slot.state = null;
    slot.item = null;
    renderSlot(slot);
  }
  for (const el of sectionEl.values()) el.classList.remove('outline');
  $('missednames').hidden = true;
  $('panel').innerHTML = '';
  $('recentsprite').removeAttribute('src');
  input.disabled = false;
  input.value = '';
  renderTimer();
  renderScore();
  input.focus();
}

function renderScore() {
  $('counter').textContent = quiz.score;
  $('total').textContent = quiz.maxScore;
}

function onInput() {
  const value = input.value;
  if (!value.length || state.over) return;
  if (['missingno', 'けつばん'].includes(value.toLowerCase()) && !state.missingno) {
    input.value = '';
    state.missingno = true;
    missingnoGlitch();
    return;
  }
  const result = quiz.guess(value);
  if (result.ok) {
    input.value = '';
    const baseSlots = slotsByBase.get(result.base);
    for (const slot of baseSlots) showSlot(slot, 'named', 'zoom');
    $('recentsprite').src = frameOf(baseSlots[0]).src;
    if (!state.started) startTimer();
    renderScore();
    if (quiz.complete) finish();
  } else if (result.message) {
    input.value = '';
    showMessage(result.message);
  }
}

// ------------------------------------------------------------ easter egg: MissingNo.

// Mientras dure la partida, casillas al azar se convierten un momento en MissingNo.
function missingnoGlitch() {
  if (!state.missingno) return;
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const roll = Math.random() * 100;
  const cls = slot.img.className;
  slot.img.className = '';
  slot.img.src = `sprites/missingno${roll < 70 ? 1 : roll < 90 ? 2 : 3}.png`;
  setTimeout(() => {
    if (!slot.img.className) slot.img.className = cls; // si se acertó entretanto, ya tiene su clase
    renderSlot(slot);
    missingnoGlitch();
  }, 300 + Math.random() * 2700);
}

// ------------------------------------------------------------ temporizador

function startTimer() {
  state.started = true;
  state.startTime = Date.now();
  state.timer = setInterval(renderTimer, 250);
}

function stopTimer() {
  if (state.timer) {
    state.elapsed = Date.now() - state.startTime;
    clearInterval(state.timer);
  }
  state.timer = null;
}

const elapsed = () => (state.timer ? Date.now() - state.startTime : state.elapsed);

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

function renderTimer() {
  $('timer').textContent = formatTime(elapsed());
}

// ------------------------------------------------------------ final

function giveUp() {
  if (state.over) return;
  state.over = true;
  stopTimer();
  renderTimer();
  input.disabled = true;
  slots.filter((s) => !s.state).forEach((slot, i) => {
    revealTimeouts.push(setTimeout(() => showSlot(slot, 'revealed', 'revealed'), 35 * (i + 1)));
  });
  renderMissed();
}

function finish() {
  state.over = true;
  stopTimer();
  renderTimer();
  input.disabled = true;
  $('congrats-count').textContent = quiz.name === 'Full' ? quiz.score : `${quiz.score} ${quiz.name}`;
  $('congrats-time').textContent = formatTime(elapsed());
  $('congrats-mode').textContent = '!';
  $('congrats-shadows').hidden = true;
  $('congrats-bonus').hidden = quiz.uniqueNamed.size !== Object.keys(data.uniqueForms).length;
  $('congrats').hidden = false;
}

// Lista de nombres fallados, agrupada por sección como el tablero
function renderMissed() {
  const panel = $('panel');
  panel.innerHTML = '';
  for (const key of sectionEl.keys()) {
    const missed = slots.filter((s) => s.box === key && !s.state);
    if (!missed.length) continue;
    const group = document.createElement('div');
    group.className = 'box group';
    for (const slot of missed) {
      const item = document.createElement('div');
      item.className = 'missed';
      const img = new Image();
      img.alt = '';
      item.append(img, document.createTextNode(''));
      group.append(item);
      slot.item = item;
      renderMissedItem(slot);
    }
    panel.append(group);
  }
  $('missednames').hidden = false;
  $('accordion').setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  renderMissedLang();
}

function renderMissedItem(slot) {
  const frame = frameOf(slot);
  slot.item.firstChild.src = frame.src;
  slot.item.lastChild.nodeValue = quiz.displayName(frame.id);
}

function renderMissedLang() {
  for (const b of $('missed-langs').children) b.classList.toggle('active', b.dataset.lang === quiz.currentLang);
  for (const slot of slots) if (slot.item) renderMissedItem(slot);
}

// ------------------------------------------------------------ avisos

let messageTimeout;
function showMessage(text) {
  const bar = $('snackbar');
  bar.textContent = text;
  bar.classList.remove('show');
  void bar.offsetWidth; // reinicia la animación
  bar.classList.add('show');
  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => bar.classList.remove('show'), 3000);
}

// ------------------------------------------------------------ eventos

function bindEvents() {
  input.addEventListener('input', onInput);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') input.value = '';
    if (document.activeElement?.tagName !== 'INPUT') input.focus();
  });
  $('start-full').onclick = () => requestQuiz(startFull);
  $('fullquiz').onclick = () => requestQuiz(startFull);
  $('start-gens').onclick = () => requestQuiz(startGens);
  $('gens-all').onclick = () => { STARTERS.forEach((_, i) => selectedGens.add(i + 1)); renderGenSelection(); };
  $('gens-none').onclick = () => { selectedGens.clear(); renderGenSelection(); };
  $('open-gens').onclick = () => { $('start').hidden = false; };
  $('open-types').onclick = () => { $('start').hidden = true; $('types').hidden = false; };
  $('open-types-bar').onclick = () => { $('types').hidden = false; };
  $('special').onclick = () => requestQuiz(startSpecial);
  $('switch-no').onclick = () => { $('switch').hidden = true; };
  // Clic fuera de un menú lo cierra (si ya hay un quiz en marcha)
  for (const id of ['start', 'types', 'switch']) {
    $(id).addEventListener('click', (ev) => {
      if (ev.target === $(id) && quiz.name) $(id).hidden = true;
    });
  }
  $('giveup').onclick = giveUp;
  $('reset').onclick = resetBoard;
  $('congrats').onclick = () => { $('congrats').hidden = true; };
  $('accordion').onclick = () => {
    const open = $('accordion').getAttribute('aria-expanded') !== 'true';
    $('accordion').setAttribute('aria-expanded', String(open));
    $('panel').hidden = !open;
  };
}

init();
