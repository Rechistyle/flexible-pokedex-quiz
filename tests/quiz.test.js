// Comprobaciones de la lógica de acierto. Uso: npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Quiz } from '../docs/js/quiz.js';
import { standardize } from '../docs/js/names.js';

const data = JSON.parse(fs.readFileSync(new URL('../docs/data/pokemon.json', import.meta.url)));
const quiz = new Quiz(data);
quiz.setQuiz('Full', data.entries);

assert.equal(quiz.maxScore, 1025);
assert.equal(standardize('Farfetch’d'), 'farfetchd');
assert.equal(standardize('Flabébé'), 'flabebe');

// Mayúsculas indiferentes y sin Enter
for (const [input, base] of [
  ['pikachu', 'pikachu'], ['mr mime', 'mrmime'], ['farfetchd', 'farfetchd'], ['flabebe', 'flabebe'],
  ['type null', 'typenull'], ['Mr. Rime', 'mrrime'], ['mime jr', 'mimejr'], ['porygon-z', 'porygonz'],
  ['ho oh', 'hooh'], ['jangmo-o', 'jangmoo'], ['TAPU KOKO', 'tapukoko'], ["sirfetch'd", 'sirfetchd'],
  ['iron valiant', 'ironvaliant'], ['nidoran f', 'nidoranf'], ['Nidoran♂', 'nidoranm'],
]) {
  const r = quiz.guess(input);
  assert.ok(r.ok, `${input} debería acertar`);
  assert.equal(r.base, base);
}

// Repetir avisa; un prefijo de otro nombre no avisa (se sigue escribiendo)
assert.equal(quiz.guess('PIKACHU').message, 'Pikachu already named');
assert.equal(quiz.guess('pikachu').ok, false);

// "Nidoran" a secas: la que falte de las dos
const q2 = new Quiz(data);
q2.setQuiz('Full', data.entries);
assert.equal(q2.guess('nidoran').base, 'nidoranf');
assert.equal(q2.guess('nidoran').base, 'nidoranm');

// Una especie revela todas sus formas del quiz
assert.deepEqual(q2.guess('charizard').ids, ['charizard', 'charizardmegax', 'charizardmegay', 'charizardgmax']);

// Otros idiomas solo si están activos
assert.equal(q2.guess('glurak').ok, false);
q2.setLanguages(['ENG', 'ESP', 'ITA', 'GER']);
assert.equal(q2.guess('glurak').ok, false); // Glurak = Charizard, ya acertado
assert.equal(q2.guess('bisasam').base, 'bulbasaur');

// Formas únicas
assert.equal(q2.guess('peakychu').base, 'pikachu');
assert.equal(q2.guess('peakychu').message, 'Peakychu already named');

// Fuera del quiz activo no cuenta
const q3 = new Quiz(data);
q3.setQuiz('Gen 1', data.entries.filter((e) => e.generation === 1));
assert.equal(q3.guess('chikorita').message, 'Chikorita is not part of this quiz');
assert.equal(q3.guess('mew').ok, true);

// Varias generaciones a la vez: exactamente las especies de Gen 1, 2 y 5
const q4 = new Quiz(data);
const gens = new Set([1, 2, 5]);
q4.setQuiz('Gen 1 · 2 · 5', data.entries.filter((e) => gens.has(e.generation)));
assert.equal(q4.maxScore, 151 + 100 + 156);
assert.equal(q4.guess('snivy').ok, true);
assert.equal(q4.guess('treecko').message, 'Treecko is not part of this quiz');

// Mismos totales que pkmnquiz.com
const total = (entries) => new Set(entries.map((e) => e.base)).size;
assert.equal(total(data.entries.filter((e) => e.generation === 6)), 119);
assert.equal(total(data.entries.filter((e) => e.types.includes('fire'))), 89);
assert.equal(total(data.entries.filter((e) => e.legendary || e.subLegendary || e.mythical || e.ultraBeast || e.paradox)), 125);

// Dex Order: solo vale el siguiente; en Gen 6 quedan las 72 especies de Kalos
const q5 = new Quiz(data);
q5.setQuiz('Full', data.entries, 'order');
assert.equal(q5.maxScore, 1025);
assert.equal(q5.guess('ivysaur').message, 'Ivysaur is not the next Pokémon');
assert.equal(q5.guess('bulbasaur').ok, true);
assert.equal(q5.guess('ivysaur').ok, true);
assert.deepEqual(q5.guess('venusaur').ids, ['venusaur', 'venusaurmega']); // sin Gigamax
q5.setQuiz('Generation 6', data.entries.filter((e) => e.generation === 6), 'order');
assert.equal(q5.maxScore, 72);
assert.equal(q5.guess('chespin').ok, true);

// Spelling Help
const q6 = new Quiz(data);
q6.setQuiz('Full', data.entries);
assert.equal(q6.suggest('pikahcu'), 'Pikachu');
assert.equal(q6.suggest('charmandr'), 'Charmander');
assert.equal(q6.suggest('xyz'), null);
assert.equal(q6.suggest('qqqqqqq'), null);

// Type-Shuffle: solo vale el tipo del momento, que cambia tras cada acierto
q6.setShuffle(true);
for (let i = 0; i < 5; i++) {
  const type = q6.currentType;
  const ok = q6.entries.find((e) => !q6.named.has(e.base) && e.types.includes(type));
  const wrong = q6.entries.find((e) => !q6.named.has(e.base) && !q6.entriesOf(e.base).some((x) => x.types.includes(type)));
  assert.match(q6.guess(data.species[wrong.base].name).message ?? '', / is not /);
  assert.equal(q6.guess(data.species[ok.base].name).ok, true);
}

console.log('OK');
