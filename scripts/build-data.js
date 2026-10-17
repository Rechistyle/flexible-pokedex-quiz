// Genera docs/data/pokemon.json y los sprites de docs/sprites a partir de:
//   - PokéAPI (nombres, traducciones, tipos, nº de Pokédex, generación)
//   - PokéSprite (iconos normal/shiny)            -> .cache/pokesprite
//   - Pack de iconos del usuario (Gen 9 y otros)  -> assets-src/icons-pack.zip
//   - Hojas de megas de Mega Dimension            -> assets-src/mega-dimension-*.png
//   - Listas manuales en data/lists
//
// Uso: npm run build-data   (la primera vez descarga todo; luego usa la caché)

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
const LISTS = path.join(ROOT, 'data', 'lists');
const OUT_DATA = path.join(ROOT, 'docs', 'data');
const OUT_SPRITES = path.join(ROOT, 'docs', 'sprites');
const POKESPRITE = path.join(CACHE, 'pokesprite', 'pokemon-gen8');
const PACK = path.join(CACHE, 'icons');
const API = 'https://pokeapi.co/api/v2';

const SPRITE_W = 68;
const SPRITE_H = 56;

// Idiomas de la web original -> códigos de PokéAPI
const LANGS = {
  ENG: ['en'], ESP: ['es'], ITA: ['it'], FRE: ['fr'], GER: ['de'],
  KOR: ['ko'], JPN: ['ja-hrkt', 'ja'], CHT: ['zh-hant'], CHS: ['zh-hans'],
};

const readList = (name) => JSON.parse(fs.readFileSync(path.join(LISTS, name), 'utf8'));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const log = (...a) => console.log(...a);

// ---------------------------------------------------------------- red + caché

async function fetchJSON(url) {
  const file = path.join(CACHE, 'pokeapi', url.replace(API, '').replace(/[^a-z0-9]+/gi, '_') + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(json));
      return json;
    } catch (err) {
      if (attempt >= 5) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// ---------------------------------------------------------------- fuentes locales

function ensureSources() {
  if (!fs.existsSync(POKESPRITE)) {
    log('Descargando PokéSprite (solo iconos gen8)…');
    fs.mkdirSync(CACHE, { recursive: true });
    execSync('git clone -q --depth 1 --filter=blob:none --sparse https://github.com/msikma/pokesprite.git', { cwd: CACHE });
    execSync('git sparse-checkout set pokemon-gen8', { cwd: path.join(CACHE, 'pokesprite') });
  }
  if (!fs.existsSync(path.join(PACK, 'Icons'))) {
    log('Descomprimiendo pack de iconos…');
    fs.mkdirSync(PACK, { recursive: true });
    execSync(`tar -xf "${path.join(ROOT, 'assets-src', 'icons-pack.zip')}"`, { cwd: PACK });
  }
}

// ---------------------------------------------------------------- imágenes

const readPNG = (file) => PNG.sync.read(fs.readFileSync(file));

function blank(w, h) {
  const png = new PNG({ width: w, height: h });
  png.data.fill(0);
  return png;
}

function crop(src, x0, y0, w, h) {
  const out = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x0 + x, sy = y0 + y;
    if (sx >= src.width || sy >= src.height) continue;
    const si = (sy * src.width + sx) * 4, di = (y * w + x) * 4;
    for (let c = 0; c < 4; c++) out.data[di + c] = src.data[si + c];
  }
  return out;
}

// ¿Cada bloque 2×2 es de un solo color? (arte pixelado ampliado al doble)
function isDoubled(img) {
  const px = (x, y) => img.data.readUInt32BE((y * img.width + x) * 4);
  for (let y = 0; y + 1 < img.height; y += 2) for (let x = 0; x + 1 < img.width; x += 2) {
    const a = px(x, y);
    if (px(x + 1, y) !== a || px(x, y + 1) !== a || px(x + 1, y + 1) !== a) return false;
  }
  return true;
}

function halve(img) {
  const out = blank(img.width >> 1, img.height >> 1);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    img.data.copy(out.data, (y * out.width + x) * 4, ((y * 2) * img.width + x * 2) * 4, ((y * 2) * img.width + x * 2) * 4 + 4);
  }
  return out;
}

function bbox(img) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] === 0) continue;
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Centra el contenido en un lienzo del tamaño de los iconos de PokéSprite
function fitToCanvas(img) {
  const b = bbox(img);
  const out = blank(SPRITE_W, SPRITE_H);
  if (!b) return out;
  const part = crop(img, b.x, b.y, b.w, b.h);
  const ox = Math.max(0, Math.floor((SPRITE_W - b.w) / 2));
  const oy = Math.max(0, Math.floor((SPRITE_H - b.h) / 2));
  PNG.bitblt(part, out, 0, 0, Math.min(b.w, SPRITE_W), Math.min(b.h, SPRITE_H), ox, oy);
  return out;
}

// Icono del pack: 128×64 con dos fotogramas; se usa el primero a tamaño nativo
function loadPackIcon(file) {
  let frame = crop(readPNG(file), 0, 0, 64, 64);
  if (isDoubled(frame)) frame = halve(frame);
  return fitToCanvas(frame);
}

let sheetCache = {};
function loadSheetIcon(variant, index) {
  const file = path.join(ROOT, 'assets-src', `mega-dimension-${variant}.png`);
  sheetCache[file] ??= readPNG(file);
  const cell = 32, cols = sheetCache[file].width / cell;
  return fitToCanvas(crop(sheetCache[file], (index % cols) * cell, Math.floor(index / cols) * cell, cell, cell));
}

// ---------------------------------------------------------------- resolución de sprites

function buildSpriteResolver() {
  const src = readList('sprite-sources.json');
  const psIndex = new Map();
  for (const f of fs.readdirSync(path.join(POKESPRITE, 'regular'))) {
    if (f.endsWith('.png')) psIndex.set(norm(f.slice(0, -4)), f.slice(0, -4));
  }
  const packIndex = new Map();
  for (const f of fs.readdirSync(path.join(PACK, 'Icons'))) {
    if (f.endsWith('.png')) packIndex.set(f.slice(0, -4), f);
  }
  // Si falta la versión shiny en el pack, se usa la normal
  const packFile = (name, shiny) => {
    const f = path.join(PACK, shiny ? 'Icons shiny' : 'Icons', name + '.png');
    return fs.existsSync(f) ? f : path.join(PACK, 'Icons', name + '.png');
  };

  // Devuelve { source, load(shiny) } o null
  return function resolve(id, base) {
    const key = id.toLowerCase();
    if (key in src.sheet) {
      return { source: 'mega-dimension', load: (shiny) => loadSheetIcon(shiny ? 'shiny' : 'normal', src.sheet[key]) };
    }
    if (key in src.pokesprite) {
      const f = src.pokesprite[key];
      return { source: 'pokesprite', load: (shiny) => readPNG(path.join(POKESPRITE, shiny ? 'shiny' : 'regular', f + '.png')) };
    }
    if (key in src.pack) {
      const f = src.pack[key];
      return { source: 'pack', load: (shiny) => loadPackIcon(packFile(f, shiny)) };
    }
    if (src.none.includes(key)) return null;
    const ps = psIndex.get(norm(key));
    if (ps) return { source: 'pokesprite', load: (shiny) => readPNG(path.join(POKESPRITE, shiny ? 'shiny' : 'regular', ps + '.png')) };
    if (base && norm(key) === norm(base)) {
      const f = norm(base).toUpperCase();
      if (packIndex.has(f)) return { source: 'pack', load: (shiny) => loadPackIcon(packFile(f, shiny)) };
    }
    return null;
  };
}

// ---------------------------------------------------------------- PokéAPI

async function loadPokeApi(baseNames, formIds) {
  const overrides = readList('pokeapi-names.json');
  const speciesList = (await fetchJSON(`${API}/pokemon-species?limit=2000`)).results;
  const speciesByNorm = new Map(speciesList.map((s) => [norm(s.name), s.name]));
  const formList = (await fetchJSON(`${API}/pokemon-form?limit=3000`)).results;
  const formByNorm = new Map();
  for (const f of formList) if (!formByNorm.has(norm(f.name))) formByNorm.set(norm(f.name), f.name);

  const missing = [];
  const speciesName = (base) => overrides.species[base] ?? speciesByNorm.get(base);
  const species = {};
  await mapLimit(baseNames, 10, async (base) => {
    const name = speciesName(base);
    const data = name && await fetchJSON(`${API}/pokemon-species/${name}`);
    if (!data) { missing.push('species:' + base); return; }
    const names = {};
    for (const [code, apiLangs] of Object.entries(LANGS)) {
      for (const l of apiLangs) {
        const n = data.names.find((x) => x.language.name === l);
        if (n) { names[code] = n.name; break; }
      }
    }
    species[base] = {
      dex: data.id,
      generation: Number(data.generation.url.match(/(\d+)\/$/)[1]),
      apiName: data.name,
      names,
      defaultPokemon: data.varieties.find((v) => v.is_default).pokemon.name,
    };
  });

  const pokemonList = (await fetchJSON(`${API}/pokemon?limit=3000`)).results;
  const pokemonByNorm = new Map(pokemonList.map((p) => [norm(p.name), p.name]));

  // Tipos: primero el endpoint /pokemon (siempre trae tipos); si el id solo existe
  // como forma cosmética, /pokemon-form (o el Pokémon al que pertenece)
  const formTypes = {};
  await mapLimit(formIds, 10, async ([id, base]) => {
    if (id in overrides.types) { formTypes[id] = overrides.types[id]; return; }
    const name = overrides.forms[id]
      ?? (id === base ? species[base]?.defaultPokemon : pokemonByNorm.get(id) ?? formByNorm.get(id));
    let types = null;
    const pk = name && await fetchJSON(`${API}/pokemon/${name}`);
    if (pk) types = pk.types;
    else if (name) {
      const form = await fetchJSON(`${API}/pokemon-form/${name}`);
      if (form?.types?.length) types = form.types;
      else if (form) types = (await fetchJSON(form.pokemon.url.replace(/\/$/, ''))).types;
    }
    if (!types) { missing.push('form:' + id); return; }
    formTypes[id] = types.sort((x, y) => x.slot - y.slot).map((t) => t.type.name);
  });
  return { species, formTypes, missing };
}

// ---------------------------------------------------------------- principal

async function main() {
  ensureSources();
  const { sections } = readList('sections.json');
  const { generations } = readList('generations.json');
  const { categories, exceptions } = readList('categories.json');
  const { cycles } = readList('cycles.json');
  const { uniqueForms } = readList('aliases.json');
  const formLabels = readList('form-labels.json');

  const entries = [];
  for (const s of sections) {
    const gen = Number(Object.keys(generations).find((g) => generations[g].includes(s.key)));
    for (const e of s.entries) {
      const [id, base = id] = e.split(':');
      entries.push({ id, base, section: s.key, generation: gen });
    }
  }
  const baseNames = [...new Set(entries.map((e) => e.base))];

  log(`Entradas: ${entries.length}, especies: ${baseNames.length}`);
  log('Consultando PokéAPI…');
  const api = await loadPokeApi(baseNames, entries.map((e) => [e.id, e.base]));
  if (api.missing.length) {
    log('\n⚠ Sin datos en PokéAPI (añadir a data/lists/pokeapi-names.json):\n  ' + api.missing.join('\n  '));
  }

  // --- sprites
  log('Generando sprites…');
  const resolve = buildSpriteResolver();
  for (const d of ['normal', 'shiny']) {
    fs.rmSync(path.join(OUT_SPRITES, d), { recursive: true, force: true });
    fs.mkdirSync(path.join(OUT_SPRITES, d), { recursive: true });
  }
  // Casilla vacía (Poké Ball) y marcador genérico para formas sin sprite
  fs.copyFileSync(path.join(POKESPRITE, 'unknown.png'), path.join(OUT_SPRITES, 'unknown.png'));
  fs.copyFileSync(path.join(POKESPRITE, 'unknown-gen5.png'), path.join(OUT_SPRITES, 'missing.png'));
  const spriteReport = { pokesprite: 0, pack: 0, 'mega-dimension': 0, missing: [] };
  const writeSprite = (id, base) => {
    const r = resolve(id, base);
    if (!r) return null;
    const file = id.toLowerCase() + '.png';
    for (const shiny of [false, true]) {
      fs.writeFileSync(path.join(OUT_SPRITES, shiny ? 'shiny' : 'normal', file), PNG.sync.write(r.load(shiny)));
    }
    spriteReport[r.source]++;
    return file;
  };

  const categoryOf = (e) => {
    if (exceptions.includes(e.id)) return null;
    return Object.keys(categories).find((c) => categories[c].includes(e.base)) ?? null;
  };

  const out = [];
  for (const e of entries) {
    const sp = api.species[e.base];
    const sprite = writeSprite(e.id, e.base);
    if (!sprite) spriteReport.missing.push(e.id);
    const cat = categoryOf(e);
    const cycleKey = Object.keys(cycles).find((k) => norm(k) === norm(e.id));
    let cycle;
    if (cycleKey) {
      cycle = cycles[cycleKey]
        .map((c, i) => (i === 0 ? sprite : writeSprite(c, e.base)))
        .filter(Boolean);
      cycle = [...new Set(cycle)];
      if (cycle.length < 2) cycle = undefined;
    }
    out.push({
      id: e.id,
      base: e.base,
      dexNumber: sp?.dex ?? null,
      name: sp?.names.ENG ?? e.base,
      generation: e.generation,
      speciesGeneration: sp?.generation ?? null,
      hisui: e.section === 'hisui',
      section: e.section,
      types: api.formTypes[e.id] ?? [],
      legendary: cat === 'legendary',
      subLegendary: cat === 'sub-legendary',
      mythical: cat === 'mythical',
      ultraBeast: cat === 'ultrabeast',
      paradox: cat === 'paradox',
      sprite,
      ...(cycle ? { cycle } : {}),
    });
  }

  const species = {};
  for (const base of baseNames) {
    const sp = api.species[base];
    species[base] = {
      dexNumber: sp?.dex ?? null,
      name: sp?.names.ENG ?? base,
      names: sp?.names ?? {},
      aliases: Object.keys(uniqueForms).filter((k) => uniqueForms[k].base === base),
    };
  }

  fs.mkdirSync(OUT_DATA, { recursive: true });
  fs.writeFileSync(path.join(OUT_DATA, 'pokemon.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    languages: Object.keys(LANGS),
    sections: sections.map(({ key, title, column }) => ({ key, title, column })),
    generations,
    formLabels: { byBase: formLabels.byBase, bySuffix: formLabels.bySuffix },
    species,
    uniqueForms,
    entries: out,
  }));

  // --- informe
  log('\n=== Informe ===');
  log(`Entradas: ${out.length} · Especies: ${baseNames.length}`);
  const bySection = {};
  for (const e of out) bySection[e.section] = (bySection[e.section] ?? 0) + 1;
  log('Por sección:', bySection);
  const byGen = {};
  for (const e of out) {
    byGen[e.generation] ??= { casillas: 0, especies: new Set() };
    byGen[e.generation].casillas++;
    byGen[e.generation].especies.add(e.base);
  }
  log('Por generación:', Object.fromEntries(Object.entries(byGen).map(([g, v]) => [g, `${v.casillas} casillas / ${v.especies.size} especies`])));
  log('Sprites por fuente:', { pokesprite: spriteReport.pokesprite, pack: spriteReport.pack, 'mega-dimension': spriteReport['mega-dimension'] });
  log(`Casillas sin sprite (${spriteReport.missing.length}):`, spriteReport.missing.join(', ') || '—');
  const noTypes = out.filter((e) => !e.types.length).map((e) => e.id);
  log(`Casillas sin tipos (${noTypes.length}):`, noTypes.join(', ') || '—');
}

main().catch((err) => { console.error(err); process.exit(1); });
