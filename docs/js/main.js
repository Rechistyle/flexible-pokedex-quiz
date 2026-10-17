// Interfaz: conecta la lógica del quiz (quiz.js) con la página.
import { Quiz } from './quiz.js';

const $ = (id) => document.getElementById(id);
const input = $('pokemon');
const UNKNOWN = 'sprites/unknown.png';
const CYCLE_MS = 2000;

// Botones de idioma de respuesta (ENG/ESP/ITA van juntos porque casi todos los nombres coinciden)
const LANG_GROUPS = [['ENG', 'ESP', 'ITA'], ['FRE'], ['GER'], ['KOR'], ['JPN'], ['CHT'], ['CHS']];
const MISSED_LANGS = ['ENG', 'FRE', 'GER', 'ESP', 'ITA', 'KOR', 'JPN', 'CHT', 'CHS'];

let data, quiz;
// Una casilla por especie y sección: sus formas comparten casilla y van rotando
// { section, base, frames: [{ src, id }], img, state: null | 'named' | 'revealed', item }
let slots = [];
let slotsByBase = new Map();
const sectionEl = new Map();
const state = { started: false, over: false, timer: null, startTime: 0, elapsed: 0, tick: 0, missingno: false };
let revealTimeouts = [];

const spriteSrc = (file) => `sprites/normal/${file}`;

// ------------------------------------------------------------ arranque

async function init() {
  data = await (await fetch('data/pokemon.json')).json();
  quiz = new Quiz(data);
  buildLanguageButtons();
  bindEvents();
  setInterval(cycleSprites, CYCLE_MS);
  $('loading').hidden = true;
  $('menu').hidden = false;
}

function buildBoard(entries) {
  const columns = [];
  slots = [];
  slotsByBase = new Map();
  sectionEl.clear();
  for (const s of data.sections) {
    const inSection = entries.filter((e) => e.section === s.key);
    if (!inSection.length) continue;
    columns[s.column] ??= Object.assign(document.createElement('div'), { className: 'column' });
    const box = document.createElement('div');
    box.className = 'box section';
    box.innerHTML = `<h3>${s.title}</h3><div class="slots"></div>`;

    const groups = new Map();
    for (const e of inSection) {
      if (!groups.has(e.base)) groups.set(e.base, []);
      groups.get(e.base).push(e);
    }
    for (const [base, group] of groups) {
      const frames = group.length > 1
        ? group.map((e) => ({ src: spriteSrc(e.sprite), id: e.id }))
        : (group[0].cycle ?? [group[0].sprite]).map((f) => ({ src: spriteSrc(f), id: group[0].id }));
      const el = document.createElement('span');
      el.className = 'slot';
      const img = new Image();
      img.alt = '';
      el.append(img);
      box.lastChild.append(el);
      const slot = { section: s.key, base, frames, img, state: null, item: null };
      renderSlot(slot);
      slots.push(slot);
      if (!slotsByBase.has(base)) slotsByBase.set(base, []);
      slotsByBase.get(base).push(slot);
    }
    sectionEl.set(s.key, box);
    columns[s.column].append(box);
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
  const inSection = slots.filter((s) => s.section === slot.section);
  if (inSection.every((s) => s.state)) sectionEl.get(slot.section).classList.add('outline');
}

// Cada 2 s, las casillas con varias formas pasan a la siguiente (y su nombre en "Missed names")
function cycleSprites() {
  state.tick++;
  for (const slot of slots) {
    if (slot.frames.length < 2) continue;
    if (slot.state) slot.img.src = frameOf(slot).src;
    if (slot.item) renderMissedItem(slot);
  }
}

// ------------------------------------------------------------ quiz

function startQuiz(name, entries) {
  quiz.setQuiz(name, entries);
  buildBoard(entries);
  resetBoard();
  $('start').hidden = true;
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
  $('congrats-count').textContent = quiz.score;
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
    const missed = slots.filter((s) => s.section === key && !s.state);
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
  $('start-full').onclick = () => startQuiz('Full', data.entries);
  $('fullquiz').onclick = () => { $('start').hidden = false; };
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
