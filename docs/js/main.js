// Interfaz: conecta la lógica del quiz (quiz.js) con la página.
import { Quiz } from './quiz.js';

const $ = (id) => document.getElementById(id);
const input = $('pokemon');
const UNKNOWN = 'sprites/unknown.png';

// Botones de idioma de respuesta (ENG/ESP/ITA van juntos porque casi todos los nombres coinciden)
const LANG_GROUPS = [['ENG', 'ESP', 'ITA'], ['FRE'], ['GER'], ['KOR'], ['JPN'], ['CHT'], ['CHS']];
const MISSED_LANGS = ['ENG', 'FRE', 'GER', 'ESP', 'ITA', 'KOR', 'JPN', 'CHT', 'CHS'];

let data, quiz;
const slotImg = new Map(); // id de casilla -> <img>
const sectionEl = new Map(); // sección -> elemento
const state = { started: false, over: false, timer: null, startTime: 0, elapsed: 0 };
let revealTimeouts = [];

const spriteSrc = (entry) => `sprites/normal/${entry.sprite}`;

// ------------------------------------------------------------ arranque

async function init() {
  data = await (await fetch('data/pokemon.json')).json();
  quiz = new Quiz(data);
  buildBoxes();
  buildLanguageButtons();
  bindEvents();
  $('loading').hidden = true;
  $('menu').hidden = false;
}

function buildBoxes() {
  const columns = [];
  for (const s of data.sections) {
    columns[s.column] ??= Object.assign(document.createElement('div'), { className: 'column' });
    const box = document.createElement('div');
    box.className = 'box section';
    box.innerHTML = `<h3>${s.title}</h3><div class="slots"></div>`;
    const slots = box.lastChild;
    for (const e of data.entries.filter((x) => x.section === s.key)) {
      const slot = document.createElement('span');
      slot.className = 'slot';
      const img = new Image();
      img.alt = '';
      img.src = UNKNOWN;
      img.className = 'empty';
      slot.append(img);
      slots.append(slot);
      slotImg.set(e.id, img);
    }
    sectionEl.set(s.key, box);
    columns[s.column].append(box);
  }
  $('boxes').append(...columns.filter(Boolean));
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

// ------------------------------------------------------------ quiz

function startQuiz(name, entries) {
  quiz.setQuiz(name, entries);
  const ids = new Set(entries.map((e) => e.id));
  for (const [id, img] of slotImg) img.parentElement.hidden = !ids.has(id);
  for (const [key, el] of sectionEl) el.hidden = !entries.some((e) => e.section === key);
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
  for (const timeout of revealTimeouts) clearTimeout(timeout);
  revealTimeouts = [];
  for (const img of slotImg.values()) {
    img.src = UNKNOWN;
    img.className = 'empty';
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

function showSprite(id, cls) {
  const img = slotImg.get(id);
  img.src = spriteSrc(quiz.entryById.get(id));
  img.className = cls;
  const section = sectionEl.get(quiz.entryById.get(id).section);
  const shown = [...section.querySelectorAll('.slot:not([hidden]) img')];
  if (shown.every((i) => !i.src.endsWith(UNKNOWN))) section.classList.add('outline');
}

function onInput() {
  const value = input.value;
  if (!value.length || state.over) return;
  const result = quiz.guess(value);
  if (result.ok) {
    input.value = '';
    for (const id of result.ids) showSprite(id, 'zoom');
    $('recentsprite').src = spriteSrc(quiz.entryById.get(result.ids[0]));
    if (!state.started) startTimer();
    renderScore();
    if (quiz.complete) finish();
  } else if (result.message) {
    input.value = '';
    showMessage(result.message);
  }
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
  quiz.missed().forEach((e, i) => {
    revealTimeouts.push(setTimeout(() => showSprite(e.id, 'revealed'), 35 * (i + 1)));
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
  for (const s of data.sections) {
    const missed = quiz.missed().filter((e) => e.section === s.key);
    if (!missed.length) continue;
    const group = document.createElement('div');
    group.className = 'box group';
    for (const e of missed) {
      const item = document.createElement('div');
      item.className = 'missed';
      item.dataset.id = e.id;
      const img = new Image();
      img.alt = '';
      img.src = spriteSrc(e);
      item.append(img, document.createTextNode(''));
      group.append(item);
    }
    panel.append(group);
  }
  $('missednames').hidden = false;
  $('accordion').setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  renderMissedLang();
}

function renderMissedLang() {
  for (const b of $('missed-langs').children) b.classList.toggle('active', b.dataset.lang === quiz.currentLang);
  for (const item of $('panel').querySelectorAll('.missed')) {
    item.lastChild.nodeValue = quiz.displayName(item.dataset.id);
  }
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
