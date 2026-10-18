// Estado y reglas del quiz, sin nada de HTML (se puede probar con Node).
import { standardize, nameKey } from './names.js';

const NIDORAN = ['nidoran', 'ニドラン', '니드런'];

export class Quiz {
  constructor(data) {
    this.data = data;
    this.entryById = new Map(data.entries.map((e) => [e.id, e]));
    this.entriesByBase = new Map();
    for (const e of data.entries) {
      if (!this.entriesByBase.has(e.base)) this.entriesByBase.set(e.base, []);
      this.entriesByBase.get(e.base).push(e);
    }
    this.entries = [];
    this.bases = new Set();
    this.setLanguages(['ENG', 'ESP', 'ITA']);
    this.reset();
  }

  // ------------------------------------------------------------ nombres

  // Nombre visible de una casilla: especie (en el idioma pedido) + sufijo de forma
  displayName(id, lang = this.currentLang) {
    const e = this.entryById.get(id);
    const sp = this.data.species[e.base];
    return (sp.names[lang] ?? sp.name) + this.formLabel(id);
  }

  formLabel(id) {
    const { byBase, bySuffix } = this.data.formLabels;
    if (id in byBase) return byBase[id];
    for (const suffix in bySuffix) {
      if (id.endsWith(suffix) && id.slice(0, -suffix.length) in this.data.species) return bySuffix[suffix];
    }
    return '';
  }

  speciesName(base, lang = this.currentLang) {
    return this.displayName(this.entriesByBase.get(base)[0].id, lang);
  }

  uniqueName(id, lang = this.currentLang) {
    const names = this.data.uniqueForms[id].names;
    return names[lang] ?? names.ENG;
  }

  // Idiomas en los que se aceptan respuestas
  setLanguages(langs) {
    this.languages = langs;
    this.nameDict = new Map();   // nombre normalizado -> especie
    this.uniqueDict = new Map(); // nombre normalizado -> forma única
    this.langOf = new Map();     // nombre normalizado -> idioma que lo aporta
    for (const [base, sp] of Object.entries(this.data.species)) {
      for (const lang of langs) {
        if (!sp.names[lang]) continue;
        const key = nameKey(sp.names[lang]);
        this.nameDict.set(key, base);
        if (!this.langOf.has(key)) this.langOf.set(key, key === nameKey(sp.names.ENG) ? 'ENG' : lang);
      }
    }
    for (const [id, u] of Object.entries(this.data.uniqueForms)) {
      for (const lang of langs) {
        if (!u.names[lang]) continue;
        const key = standardize(u.names[lang]);
        this.uniqueDict.set(key, id);
        if (!this.langOf.has(key)) this.langOf.set(key, lang);
      }
    }
    this.updateQuizNames();
    this.langCounts ??= {};
    this.pickLanguage();
  }

  updateQuizNames() {
    this.quizNames = [];
    for (const [key, base] of this.nameDict) if (this.bases.has(base)) this.quizNames.push(key);
  }

  // Idioma de los nombres fallados: el que más se ha usado (ENG si está activo y empatan)
  pickLanguage() {
    let best = this.languages.includes('ENG') ? 'ENG' : this.languages[0];
    let max = 0;
    for (const lang of this.languages) {
      if ((this.langCounts[lang] ?? 0) > max) { max = this.langCounts[lang]; best = lang; }
    }
    this.currentLang = best;
  }

  // ------------------------------------------------------------ quiz activo

  // mode: 'regular' | 'chaos' | 'order'
  setQuiz(name, entries, mode = 'regular') {
    this.name = name;
    this.mode = mode;
    if (mode === 'order') {
      // Orden de Pokédex: solo especies cuya forma principal está en el quiz (sin Gigamax),
      // con sus otras formas como variantes de la misma casilla
      const canon = new Set(entries.filter((e) => e.id === e.base).map((e) => e.base));
      entries = entries.filter((e) => canon.has(e.base) && e.section !== 'gmax')
        .sort((a, b) => a.dexNumber - b.dexNumber);
      this.orderList = [...new Set(entries.map((e) => e.base))];
    }
    this.entries = entries;
    this.bases = new Set(entries.map((e) => e.base));
    this.updateQuizNames();
    this.reset();
  }

  reset() {
    this.named = new Set();
    this.uniqueNamed = new Set();
    this.langCounts = {};
    this.pickLanguage();
  }

  get score() { return this.named.size; }
  get maxScore() { return this.bases.size; }
  get complete() { return this.maxScore > 0 && this.score === this.maxScore; }

  entriesOf(base) {
    return this.entries.filter((e) => e.base === base);
  }

  // ¿Hay otro nombre que empiece por lo escrito? Entonces se sigue esperando teclas.
  isPrefix(key, names) {
    const k = key.normalize('NFD');
    for (const n of names) if (n !== key && n.normalize('NFD').startsWith(k)) return true;
    return false;
  }

  // Comprueba lo escrito. Devuelve { ok, base, ids, message }.
  guess(raw) {
    let candidates = [];
    if (NIDORAN.includes(raw.toLowerCase())) {
      // "Nidoran" a secas: primero la hembra y, si ya está, el macho
      candidates = ['nidoranf', 'ニドランf', '니드런f', 'nidoranm', 'ニドランm', '니드런m'];
    } else {
      const std = nameKey(raw); // ♀/♂ -> f/m (la original los ignora)
      // Alemán escrito sin diéresis: "ae" -> "ä", etc.
      const alt = standardize(std.replace('ae', 'ä').replace('oe', 'ö').replace('ue', 'ü').replace('ss', 'ß'));
      if (alt !== std) candidates.push(alt);
      candidates.push(std);
    }

    let message = null;
    for (const key of candidates) {
      const uniqueId = this.uniqueDict.get(key);
      if (uniqueId) {
        const base = this.data.uniqueForms[uniqueId].base;
        if (this.uniqueNamed.has(uniqueId)) {
          if (!this.isPrefix(key, this.nameDict.keys())) message = `${this.uniqueName(uniqueId)} already named`;
          continue;
        }
        if (!this.bases.has(base)) {
          if (!this.isPrefix(key, this.quizNames)) message = `${this.uniqueName(uniqueId)} is not part of this quiz`;
          continue;
        }
        if (this.named.has(base)) {
          this.uniqueNamed.add(uniqueId);
          this.countLang(key);
          return { ok: false, base, ids: [], message: `${this.uniqueName(uniqueId)} revealed!` };
        }
        if (!this.isNext(base)) {
          if (!this.isPrefix(key, this.nameDict.keys())) message = `${this.uniqueName(uniqueId)} is not the next Pokémon`;
          continue;
        }
        this.uniqueNamed.add(uniqueId);
        this.countLang(key);
        return this.add(base);
      }

      const base = this.nameDict.get(key);
      if (!base) continue;
      if (this.named.has(base)) {
        if (!this.isPrefix(key, this.nameDict.keys())) message = `${this.speciesName(base)} already named`;
        continue;
      }
      if (!this.bases.has(base)) {
        if (!this.isPrefix(key, this.quizNames)) message = `${this.speciesName(base)} is not part of this quiz`;
        continue;
      }
      if (!this.isNext(base)) {
        if (!this.isPrefix(key, this.nameDict.keys())) message = `${this.speciesName(base)} is not the next Pokémon`;
        continue;
      }
      this.countLang(key);
      return this.add(base);
    }
    return { ok: false, base: null, ids: [], message };
  }

  // En Dex Order solo vale el siguiente al último acertado
  isNext(base) {
    if (this.mode !== 'order') return true;
    let last = -1;
    this.orderList.forEach((b, i) => { if (this.named.has(b)) last = i; });
    return this.orderList[last + 1] === base;
  }

  countLang(key) {
    const lang = this.langOf.get(key);
    if (lang) this.langCounts[lang] = (this.langCounts[lang] ?? 0) + 1;
    this.pickLanguage();
  }

  add(base) {
    this.named.add(base);
    return { ok: true, base, ids: this.entriesOf(base).map((e) => e.id), message: null };
  }

  // Casillas sin acertar (para rendirse y la lista de nombres fallados)
  missed() {
    return this.entries.filter((e) => !this.named.has(e.base));
  }
}
