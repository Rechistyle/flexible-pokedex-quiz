# Decisiones que modifican o concretan el SPEC

Acordadas con el usuario. Donde choquen con `SPEC.md`, manda este archivo.

## Sprites
- Fuente principal: **PokéSprite** (iconos de caja, normal y shiny).
- **Gen 9** (y formas que PokéSprite no tenga): iconos del pack que aportó el usuario (`Icons gen 9.zip`, formato 128×64 con 2 fotogramas; se usa el primero).
- **Megas de Mega Dimensions (Hyperspace)**: recortes de las dos hojas de 160×160 (cuadrícula de 32×32, 22 megas; una normal y otra shiny) que aportó el usuario.
- Lo que no esté en ninguna de las fuentes: **marcador genérico**.

## Despliegue y multijugador (sustituye a las secciones 1 y 6 del SPEC en lo relativo al backend)
- Sin servidor Node. La web es 100 % estática y se publica con **GitHub Pages** (repositorio público).
- Multijugador **P2P con WebRTC (PeerJS)**: el navegador del anfitrión es el árbitro autoritativo (valida aciertos, evita dobles, gestiona desconexiones/reconexiones y sincroniza la configuración). La librería PeerJS se incluye en local; solo se usa el servidor de emparejamiento público y gratuito de PeerJS para que los jugadores se encuentren.
- Si el anfitrión cierra la pestaña, termina la partida.
- Nada que instalar ni pagar para jugar.

## Estructura (adaptada a GitHub Pages)
- La web completa vive en `docs/` (GitHub Pages sirve `main` → `/docs`): `docs/index.html`, `docs/css`, `docs/js`, `docs/data/pokemon.json`, `docs/sprites/{normal,shiny}`.
- Fuera de `docs/`: `scripts/build-data.js`, listas manuales en `data/lists/`, recursos originales en `assets-src/`. `.cache/` (PokéAPI, PokéSprite, pack descomprimido) no se sube.

## Hallazgos al revisar pkmnquiz.com (mandan sobre el SPEC)
- El selector de generaciones muestra **Gen 1–9, sin botón Hisui**: Hisui va dentro de Gen 8 (Gen 6 incluye las megas Kalos/Hoenn, Gen 7 incluye "Unknown", Gen 9 incluye las megas Lumiose/Hyperspace). Ver `data/lists/generations.json`.
- Idiomas de respuesta: ENG/ESP/ITA, FRE, GER, KOR, JPN, CHT, CHS. Se incluyen las traducciones en los datos.
- El marcador cuenta **especies** (1025 en el Full Quiz), no casillas: escribir una especie revela todas sus formas del quiz activo.
- Se replican tal cual las rarezas de categoría de la original (p. ej. Magearna Original Color y Miraidon Low-Power no cuentan como legendario/mítico).
- Formas sin icono en ninguna fuente (Rotom "Stereo", Marshadow Zenith, Koraidon Limited Build, Miraidon Low-Power Mode, Pecharunt "Shell"): usan el sprite de su forma normal (decidido con el usuario).

## Repositorio
- Carpeta y repositorio: `Flexible Pokedex Quiz` (en `Documents\GitHub`), publicado desde GitHub Desktop.

## Diferencias que quedan con pkmnquiz.com (repaso final, fase 8)
Todo lo de la original está implementado salvo la entrada por chat de Twitch (excluida por el SPEC,
junto con sus easter eggs exclusivos del chat). Diferencias conscientes:
- **Selector de generaciones múltiple** (el cambio pedido): los botones Gen 1–9 se marcan y se pulsa Start; en la original, un clic empieza esa generación.
- **Sprites**: PokéSprite + pack de iconos de la comunidad en vez de los sprites propios de la original; algunas formas sin icono propio comparten el de su forma normal (Rotom Stereo, Marshadow Zenith, Koraidon/Miraidon alternativos, Pecharunt Shell, Kyurem Black/White Active, Urshifu Rapid Strike) y Mimikyu Busted no rota. Las formas únicas (Peakychu, etc.) se aceptan y dan la insignia, pero se muestran con el sprite de su especie.
- **Sonidos** sintetizados en el navegador (no se pueden copiar los de la original).
- **Iconos de tipos** de duiker101/pokemon-type-svg-icons; sin logo propio de la original.
- **Guardar/cargar**: archivo JSON legible (`.json`); acepta también `.quiz`.
- **Nidoran♀/♂** se muestra con el símbolo y se acepta escribirlo (la original lo ignora).
- **Spelling Help** muestra el nombre con su formato normal (la original, normalizado en minúsculas) y usa lo último escrito si el cuadro se vació.
- **I'm scared!**: activo del 25 al 31 de octubre (en la original es un modo de Halloween que ahora está desactivado).
- **Multijugador** P2P (ver arriba); los invitados no pueden usar sombras ni cambiar opciones de juego. No se envían estadísticas a ningún servidor.
