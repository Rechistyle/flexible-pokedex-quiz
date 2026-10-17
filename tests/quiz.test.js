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

console.log('OK');
