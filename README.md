# Flexible Pokédex Quiz

## ▶ Jugar: **<https://rechistyle.github.io/flexible-pokedex-quiz/>**

Funciona en el ordenador y en el móvil, sin instalar nada. Para jugar con amigos, pulsa
**Multiplayer Invite** y pásales el enlace que se copia.

---

Quiz para nombrar a todos los Pokémon, inspirado en [pkmnquiz.com](https://pkmnquiz.com/).
Tiene las mismas opciones que la original, con un cambio: en el quiz por generaciones
se pueden elegir **varias generaciones a la vez** (por ejemplo Gen 1 + Gen 2 + Gen 5).

Proyecto no oficial, para uso personal.

## Jugar en tu ordenador

Necesitas tener [Node.js](https://nodejs.org/) instalado (cualquier versión reciente).

- **Windows:** doble clic en `Jugar en local.bat`. Se abre una ventana negra y el juego en el navegador.
  No cierres la ventana negra mientras juegas.
- **Cualquier sistema:** abre una terminal en esta carpeta y escribe `npm start`. Luego entra en
  <http://localhost:3000>.

## Publicación en internet (GitHub Pages, gratis)

La web ya está publicada en <https://rechistyle.github.io/flexible-pokedex-quiz/> con GitHub Pages
(Settings → Pages → rama **main**, carpeta **/docs**). Cada vez que subes cambios a GitHub
(GitHub Desktop: **Push origin**), la web se actualiza sola en uno o dos minutos.

Es gratis mientras el repositorio sea público y no hay que renovar ni mantener nada.

## Jugar con amigos (multijugador)

No hace falta instalar nada ni pagar nada:

1. Abre el juego desde **<https://rechistyle.github.io/flexible-pokedex-quiz/>** (un enlace de `localhost` solo funciona en tu ordenador).
2. Pulsa **Multiplayer Invite**, escribe un nombre y se copia el enlace de invitación
   (también puedes pulsar **Copy Invite Link** cuando quieras).
3. Pásales el enlace a tus amigos. Al abrirlo eligen su nombre y entran.
4. Tú eliges el quiz, las generaciones, el modo, el temporizador y las opciones; a ellos se les aplica solo.
   Cada acierto cuenta para quien lo dice primero, y arriba aparece el **Top 3**. Al terminar sale el **Leaderboard**.

Cómo funciona por dentro: tu navegador hace de árbitro y tus amigos se conectan directamente contigo
(WebRTC, con la librería [PeerJS](https://peerjs.com/)). Para que se encuentren se usa el servidor público
y gratuito de PeerJS. Por eso:

- **Si cierras tu pestaña, la partida se acaba** para todos ("The host has disbanded the room").
- Si un amigo recarga la página o se le corta la conexión, puede volver con el mismo nombre y conserva sus puntos.
- En algunas redes muy cerradas (universidades, empresas) la conexión directa puede fallar.

Para probarlo tú solo: abre el enlace de invitación en otra pestaña.

## Para desarrolladores

- `npm run build-data`: regenera `docs/data/pokemon.json` y los sprites desde PokéAPI, PokéSprite y `assets-src/`
  (la primera vez descarga todo en `.cache/`).
- `npm test`: comprueba la lógica (nombres, generaciones, modos, pistas…).
- La web está en `docs/` (HTML + CSS + JavaScript sin frameworks). Las listas manuales están en `data/lists/`.
- Las decisiones tomadas respecto al SPEC original están en `DECISIONES.md`.

## Créditos

- Datos: [PokéAPI](https://pokeapi.co/).
- Sprites: [PokéSprite](https://msikma.github.io/pokesprite/), iconos de la comunidad (Gen 9 y megas de Leyendas Z-A),
  MissingNo. de [Bulbagarden Archives](https://archives.bulbagarden.net/), Duskull de PokéAPI.
- Iconos de tipos: [duiker101/pokemon-type-svg-icons](https://github.com/duiker101/pokemon-type-svg-icons).
- Multijugador: [PeerJS](https://peerjs.com/) (MIT).

Pokémon y los nombres de los Pokémon son marcas de Nintendo, Creatures Inc. y GAME FREAK Inc.
Este es un proyecto no oficial sin ánimo de lucro.
