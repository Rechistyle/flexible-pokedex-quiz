// Interfaz: conecta la lógica del quiz (quiz.js) con la página.
import { Quiz } from './quiz.js';
import { play, sound } from './sound.js';

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
// { box, base, frames: [{ file, id }], img, el, state: null | 'named' | 'revealed', shadow, item }
let slots = [];
let slotsByBase = new Map();
const sectionEl = new Map(); // caja -> elemento
const selectedGens = new Set();
const state = {
  started: false, over: false, timer: null, startTime: 0, elapsed: 0, tick: 0, missingno: false, mode: 'regular',
  minutes: 0, // 0 = cronómetro (∞); si no, cuenta atrás
  shiny: false, cycle: true, spelling: false, hotkey: false, auto: null, autoWarn: null, spooky: false,
};
let current = null; // quiz activo: { name, entries, layout, theme }
let revealTimeouts = [];

const spriteSrc = (file) => `sprites/${state.shiny ? 'shiny' : 'normal'}/${file}`;

// ------------------------------------------------------------ arranque

async function init() {
  data = await (await fetch('data/pokemon.json')).json();
  quiz = new Quiz(data);
  buildLanguageButtons();
  buildMenus();
  bindEvents();
  setInterval(cycleSprites, CYCLE_MS);
  setDark(matchMedia('(prefers-color-scheme: dark)').matches);
  const today = new Date();
  state.spooky = today.getMonth() === 9 && today.getDate() >= 25; // del 25 al 31 de octubre
  startSpooky();
  $('loading').hidden = true;
  $('menu').hidden = false;
}

// layout: 'full' (5 columnas), 'gens' (cajas a lo ancho), 'types' o 'special' (cajas por categoría)
function buildBoard(entries, layout, mode) {
  const columns = [];
  slots = [];
  slotsByBase = new Map();
  sectionEl.clear();
  // Chaos y Dex Order: una sola caja, una casilla por especie con todas sus formas
  const boxes = mode !== 'regular' ? [{ key: 'big', title: '', column: 1 }]
    : layout === 'special' ? SPECIAL_BOXES : data.sections;
  const boxOf = mode !== 'regular' ? () => 'big'
    : layout === 'special' ? (e) => SPECIAL_BOXES.find((b) => e[b.flag])?.key
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
        ? group.map((e) => ({ file: e.sprite, id: e.id }))
        : (group[0].cycle ?? [group[0].sprite]).map((f) => ({ file: f, id: group[0].id }));
      const frames = [...new Map(allFrames.map((f) => [f.file, f])).values()]; // sin dibujos repetidos
      const el = document.createElement('span');
      el.className = 'slot';
      const img = new Image();
      img.alt = '';
      el.append(img);
      box.lastChild.append(el);
      const slot = { box: s.key, base, frames, img, el, state: null, shadow: false, item: null };
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

// Con "Cycle sprites: off" se queda siempre la primera forma
const frameOf = (slot) => slot.frames[state.cycle ? state.tick % slot.frames.length : 0];

function renderSlot(slot) {
  if (slot.state) {
    slot.img.src = spriteSrc(frameOf(slot).file);
  } else if (slot.shadow) {
    slot.img.src = spriteSrc(frameOf(slot).file);
    slot.img.className = 'shadow';
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
  if (!state.cycle) return;
  for (const slot of slots) {
    if (slot.frames.length < 2) continue;
    if (slot.state || slot.shadow) slot.img.src = spriteSrc(frameOf(slot).file);
    if (slot.item) renderMissedItem(slot);
  }
}

function renderAllSprites() {
  for (const slot of slots) {
    if (slot.state || slot.shadow) renderSlot(slot);
    if (slot.item) renderMissedItem(slot);
  }
  renderMenuIcons();
}

// ------------------------------------------------------------ quiz

// Cambiar de quiz con aciertos pide confirmación ("Switch Quiz?"), como la original
function requestQuiz(start) {
  closeMenus();
  if (quiz.score === 0) return start();
  confirmDialog('Switch Quiz?', 'Switch', start);
}

function confirmDialog(title, yes, action, text = 'Quiz and timer will reset') {
  $('confirm-title').textContent = title;
  $('confirm-text').textContent = text;
  $('confirm-yes').textContent = yes;
  $('confirm-yes').onclick = () => { $('confirm').hidden = true; action(); };
  $('confirm').hidden = false;
}

// Botones de modo; cada cambio pide confirmación y reinicia el quiz actual
function requestMode(mode) {
  if (mode === state.mode) return;
  if (mode === 'chaos') return confirmDialog('Enable guessing without predetermined placements', 'Enable', () => setMode('chaos'));
  if (mode === 'regular') return confirmDialog('Switch to regular quiz with Region Layout', 'Switch', () => setMode('regular'));
  if (current && ['types', 'special'].includes(current.layout)) return showMessage('Order mode does not work with the current quiz');
  confirmDialog('Enforce guessing in Pokédex order', 'Enable', () => { setShuffle(false, true); setMode('order'); });
}

function setMode(mode) {
  state.mode = mode;
  renderModeButtons();
  if (current) startQuiz(current.name, current.entries, current.layout, current.theme);
}

function renderModeButtons() {
  for (const b of $('modes').children) b.classList.toggle('active', b.dataset.mode === state.mode);
}

function startQuiz(name, entries, layout, theme = '') {
  current = { name, entries, layout, theme };
  if (state.mode === 'order' && ['types', 'special'].includes(layout)) {
    state.mode = 'regular'; // la original lo desactiva al pasar a Types/Special
    renderModeButtons();
    showMessage('Order mode disabled');
  }
  quiz.setQuiz(name, entries, state.mode);
  document.body.dataset.mode = state.mode;
  document.body.dataset.layout = layout;
  if (quiz.shuffle && layout === 'types') setShuffle(false, true);
  $('quizname').textContent = name;
  $('quizname').hidden = layout !== 'gens';
  resetBoard();
  closeMenus();
  $('inputbox').classList.remove('shake');
  void $('inputbox').offsetWidth;
  $('inputbox').classList.add('shake');
  input.focus();
}

function resetBoard() {
  quiz.reset();
  buildBoard(quiz.entries, current.layout, state.mode);
  renderTheme();
  hideHint();
  stopTimer();
  state.started = false;
  state.over = false;
  state.elapsed = 0;
  state.missingno = false;
  for (const timeout of revealTimeouts) clearTimeout(timeout);
  revealTimeouts = [];
  $('missednames').hidden = true;
  $('panel').innerHTML = '';
  $('recentsprite').removeAttribute('src');
  input.disabled = false;
  input.value = '';
  renderTimer();
  renderScore();
  input.focus();
}

// Color del quiz: el del tipo (Types), dorado (Special) o el del tipo del momento (Type-Shuffle)
function renderTheme() {
  const theme = quiz.currentType ?? current?.theme ?? '';
  document.body.dataset.theme = theme;
  $('bgicon').style.maskImage = `url(images/types/${theme}.svg)`;
  $('bgicon').hidden = !theme || theme === 'special';
}

function renderScore() {
  $('counter').textContent = quiz.score;
  $('total').textContent = quiz.maxScore;
}

function onInput() {
  const value = input.value;
  if (!value.length || state.over) return;
  // "?" muestra la pista de Spelling Help y "," revela la siguiente sombra
  if (value.endsWith('?')) {
    input.value = value.slice(0, -1);
    if (state.spelling) revealHint();
    return;
  }
  if (value.endsWith(',')) {
    input.value = value.slice(0, -1);
    if (state.hotkey) revealNextShadow();
    else showMessage('Shadow hotkey is not enabled');
    return;
  }
  if (['missingno', 'けつばん'].includes(value.toLowerCase()) && !state.missingno) {
    input.value = '';
    state.missingno = true;
    play('glitch');
    missingnoGlitch();
    return;
  }
  const result = quiz.guess(value);
  if (result.ok) {
    input.value = '';
    const baseSlots = slotsByBase.get(result.base);
    for (const slot of baseSlots) {
      // Chaos: los aciertos ocupan las casillas en el orden en que se dicen
      if (state.mode === 'chaos') slot.el.parentElement.insertBefore(slot.el, slot.el.parentElement.children[quiz.score - 1]);
      showSlot(slot, 'named', 'zoom');
    }
    $('recentsprite').src = spriteSrc(frameOf(baseSlots[0]).file);
    hideHint();
    play('correct');
    if (!state.started) startTimer();
    renderScore();
    renderTheme();
    if (quiz.complete) finish();
  } else if (result.message) {
    input.value = '';
    if (result.message.includes('not the next')) play('wrong');
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
  state.timer = setInterval(() => {
    renderTimer();
    if (state.minutes && remaining() <= 0) giveUp(); // se acabó el tiempo
  }, 250);
}

const remaining = () => Math.max(0, state.minutes * 60000 - elapsed());

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
  $('timer').textContent = formatTime(state.minutes ? remaining() : elapsed());
}

// Cambiar el temporizador reinicia el quiz (pide confirmación si ya está corriendo)
function requestTimer(minutes) {
  const apply = () => {
    state.minutes = minutes;
    $('timer-inf').classList.toggle('active', !minutes);
    $('timer-set').classList.toggle('active', !!minutes);
    if (current) resetBoard(); else renderTimer();
    showMessage(minutes ? `Timer set to ${formatTime(minutes * 60000)}` : 'Timer set to stopwatch');
  };
  if (state.timer) confirmDialog('Change timer?', 'Switch', apply);
  else apply();
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
  play('fanfare');
  $('congrats-count').textContent = quiz.name === 'Full' ? quiz.score : `${quiz.score} ${quiz.name}`;
  $('congrats-time').textContent = formatTime(elapsed());
  $('congrats-mode').textContent = { order: ' in Pokédex order!', chaos: ' in Chaos mode!' }[state.mode] ?? '!';
  const shadows = slots.filter((s) => s.shadow).length;
  $('shadow-count').textContent = shadows;
  $('congrats-shadows').hidden = shadows === 0;
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
  slot.item.firstChild.src = spriteSrc(frame.file);
  slot.item.lastChild.nodeValue = quiz.displayName(frame.id);
}

function renderMissedLang() {
  for (const b of $('missed-langs').children) b.classList.toggle('active', b.dataset.lang === quiz.currentLang);
  for (const slot of slots) if (slot.item) renderMissedItem(slot);
}

// ------------------------------------------------------------ sombras

function revealShadow(slot) {
  slot.shadow = true;
  renderSlot(slot);
}

// Todas las sombras a la vez ("Reveal shadows?")
function revealAllShadows() {
  for (const slot of slots) if (!slot.state && !slot.shadow) revealShadow(slot);
}

// Una sombra: la siguiente en Dex Order, una del tipo del momento con Type-Shuffle, si no al azar
function revealNextShadow() {
  if (state.over) return;
  let pick;
  if (state.mode === 'order') pick = slots.find((s) => !s.state);
  else {
    const left = slots.filter((s) => !s.state && !s.shadow);
    const pool = quiz.currentType ? left.filter((s) => quiz.hasCurrentType(s.base)) : left;
    pick = pool[Math.floor(Math.random() * pool.length)];
  }
  if (pick) revealShadow(pick);
}

const allShadowsShown = () => slots.every((s) => s.state || s.shadow);

// AUTO 20s: cada 20 s se revela una sombra (aviso 3 s antes)
function toggleAutoShadow() {
  if (state.auto) {
    clearTimeout(state.auto);
    clearTimeout(state.autoWarn);
    state.auto = null;
    $('shadowauto').setAttribute('aria-pressed', 'false');
    return showMessage('Disabled auto-reveal of shadows');
  }
  $('shadowauto').setAttribute('aria-pressed', 'true');
  showMessage(state.mode === 'order' ? 'Activated auto-reveal of next shadow every 20 seconds'
    : 'Activated auto-reveal of random shadow every 20 seconds');
  const active = () => !state.over && quiz.score > 0 && !quiz.complete && !allShadowsShown();
  const loop = () => {
    state.autoWarn = setTimeout(() => { if (active()) showMessage('Revealing a shadow in 3 seconds ...'); }, 17000);
    state.auto = setTimeout(() => { if (active()) revealNextShadow(); loop(); }, 20000);
  };
  loop();
}

// ------------------------------------------------------------ Spelling Help

function revealHint() {
  $('clicktype').hidden = true;
  $('hint').hidden = false;
  $('hint').textContent = (input.value && quiz.suggest(input.value)) ?? 'not found';
  input.focus();
}

function hideHint() {
  $('clicktype').hidden = false;
  $('hint').hidden = true;
  $('hint').textContent = '';
}

// ------------------------------------------------------------ Type-Shuffle

function setShuffle(on, silent = false) {
  if (on && current?.layout === 'types') return showMessage('Type shuffle mode does not work with type quizzes');
  if (on && state.mode === 'order') return showMessage('Type shuffle mode does not work with dex order mode');
  if (on === quiz.shuffle) return;
  quiz.setShuffle(on);
  for (const b of $('shuffle').children) b.classList.toggle('active', (b.dataset.on === '1') === on);
  if (current) renderTheme();
  if (!silent) showMessage(on ? 'Enabled type shuffle mode.' : 'Disabled type shuffle mode.');
}

// ------------------------------------------------------------ I'm scared! (Halloween)

// Como la original en Halloween: de vez en cuando un Duskull se asoma en una casilla.
// Está activo la última semana de octubre; el botón "I'm scared!" lo apaga.
function startSpooky() {
  if (!state.spooky) return;
  setTimeout(() => {
    if (!state.spooky) return;
    if (!slots.length) return startSpooky();
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const cls = slot.img.className;
    slot.img.className = 'spooky';
    slot.img.src = 'images/duskull.gif';
    play('spooky');
    setTimeout(() => {
      slot.img.className = cls;
      renderSlot(slot);
      $('spooky').hidden = !state.spooky;
      startSpooky();
    }, 3500 + Math.random() * 1000);
  }, 10000 + Math.random() * 15000);
}

// ------------------------------------------------------------ modo oscuro

function setDark(on) {
  document.documentElement.dataset.dark = on ? '1' : '';
  $('darkmode').textContent = on ? '☀' : '☾';
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
  $('confirm-no').onclick = () => { $('confirm').hidden = true; };
  for (const b of $('modes').children) b.onclick = () => requestMode(b.dataset.mode);
  // Clic fuera de un menú lo cierra (si ya hay un quiz en marcha)
  for (const id of ['start', 'types', 'confirm']) {
    $(id).addEventListener('click', (ev) => {
      if (ev.target === $(id) && quiz.name) $(id).hidden = true;
    });
  }
  $('giveup').onclick = giveUp;
  $('timer-inf').onclick = () => requestTimer(0);
  $('timer-set').onclick = () => requestTimer(Math.abs(Number($('timer-min').value)) || 1);
  for (const b of $('shuffle').children) b.onclick = () => setShuffle(b.dataset.on === '1');
  $('shiny').onclick = () => {
    state.shiny = !state.shiny;
    $('shiny').setAttribute('aria-pressed', String(state.shiny));
    renderAllSprites();
  };
  for (const b of $('cycle').children) b.onclick = () => {
    state.cycle = b.dataset.on === '1';
    for (const x of $('cycle').children) x.classList.toggle('active', x === b);
    renderAllSprites();
  };
  for (const b of $('soundopt').children) b.onclick = () => {
    sound.enabled = b.dataset.on === '1';
    for (const x of $('soundopt').children) x.classList.toggle('active', x === b);
  };
  $('spellbtn').onclick = () => {
    state.spelling = !state.spelling;
    $('spellbtn').setAttribute('aria-pressed', String(state.spelling));
    $('spelling').hidden = !state.spelling;
    hideHint();
    if (state.spelling) showMessage("You can also type '?' to reveal");
    input.focus();
  };
  $('hintbox').onclick = revealHint;
  $('shadows').onclick = () => {
    if (current && !allShadowsShown()) confirmDialog('Reveal shadows?', 'Reveal', revealAllShadows, 'Cannot be undone without reset');
  };
  $('shadownext').onclick = () => {
    state.hotkey = !state.hotkey;
    $('shadownext').setAttribute('aria-pressed', String(state.hotkey));
    showMessage(state.hotkey ? 'Shadow hotkey enabled' : 'Shadow hotkey disabled');
  };
  $('shadowauto').onclick = toggleAutoShadow;
  $('spooky').onclick = () => { state.spooky = false; $('spooky').hidden = true; };
  $('darkmode').onclick = () => setDark(!document.documentElement.dataset.dark);
  $('reset').onclick = resetBoard;
  $('congrats').onclick = () => { $('congrats').hidden = true; };
  $('accordion').onclick = () => {
    const open = $('accordion').getAttribute('aria-expanded') !== 'true';
    $('accordion').setAttribute('aria-expanded', String(open));
    $('panel').hidden = !open;
  };
}

init();
