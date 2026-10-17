// Normalización de nombres para comparar lo que se escribe con los nombres de los Pokémon.
// Mismas reglas que pkmnquiz.com: sin mayúsculas, sin espacios/guiones, letras con
// diacríticos -> letra base, números de ancho completo y romanos -> ASCII, y fuera
// todo lo que no sea letra latina, kana, hangul, ideograma o número.

const FOLD = [
  [/[éèêëěęėē]/g, 'e'], [/[üùúûűũųůū]/g, 'u'], [/[äàáâãåǎąăæā]/g, 'a'],
  [/[öòóôõőøœ]/g, 'o'], [/[đďð]/g, 'd'], [/[ĝģğ]/g, 'g'], [/ĵ/g, 'j'], [/ķ/g, 'k'],
  [/ĥ/g, 'h'], [/ß/g, 'ss'], [/ŵ/g, 'w'], [/[çćĉč]/g, 'c'], [/[ïìíîıīį]/g, 'i'],
  [/[ĺļłľŀ]/g, 'l'], [/[ñńňņ]/g, 'n'], [/[ŕř]/g, 'r'], [/[śŝşšș]/g, 's'],
  [/[ťţþț]/g, 't'], [/[ýÿŷ]/g, 'y'], [/[źžż乙]/g, 'z'],
];
const ROMAN = { 'Ⅰ': 'i', 'Ⅱ': 'ii', 'Ⅲ': 'iii', 'Ⅳ': 'iv', 'Ⅴ': 'v', 'Ⅵ': 'vi', 'Ⅶ': 'vii', 'Ⅷ': 'viii', 'Ⅸ': 'ix', 'Ⅹ': 'x', 'Ⅺ': 'xi', 'Ⅻ': 'xii', 'Ⅼ': 'l', 'Ⅽ': 'c', 'Ⅾ': 'd', 'Ⅿ': 'm' };

export function standardize(s) {
  s = s.replace(/[\s-]/g, '').toLowerCase().normalize('NFKC');
  for (const [re, to] of FOLD) s = s.replace(re, to);
  s = s.replace(/[ａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  s = s.replace(/[Ⅰ-Ⅿ]/g, (c) => ROMAN[c] ?? c);
  return s
    .replace(/[^ぁ-んァ-ン가-힣a-z0-9_ー一-龥蘭朗]/g, '')
    .replace(/艷/g, '豔');
}

// Nombre de una especie listo para indexar: Nidoran♀/♂ se distinguen con f/m
export const nameKey = (name) => standardize(name.replace(/♀/g, 'f').replace(/♂/g, 'm'));
