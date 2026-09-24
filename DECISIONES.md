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
- Formas sin sprite en ninguna fuente (marcador genérico): Rotom "Stereo", Marshadow Zenith, Koraidon Limited Build, Miraidon Low-Power Mode, Pecharunt "Shell".

## Repositorio
- Carpeta y repositorio: `Flexible Pokedex Quiz` (en `Documents\GitHub`), publicado desde GitHub Desktop.
