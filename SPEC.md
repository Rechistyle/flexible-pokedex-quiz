# SPEC — Pokémon Quiz (clon de pkmnquiz.com con selector multi-generación)

## 0. Objetivo y regla principal

Construir una web que replique **todas** las funcionalidades de https://pkmnquiz.com/ con **un único cambio**: en el quiz por generaciones se pueden seleccionar **varias generaciones a la vez** (por ejemplo, Gen 1 + Gen 2 + Gen 5) sin tener que elegir todas.

- Nada más debe cambiar: mismas opciones, mismos modos, mismo comportamiento, misma lógica de confirmaciones.
- **Única exclusión permitida:** la entrada por chat de Twitch ("Twitch-chat input"). No implementarla.
- **Antes de implementar cada funcionalidad, visita pkmnquiz.com y comprueba su comportamiento exacto.** Si algo de esta spec contradice lo que hace la web original, **manda la web original**. Si hay una duda que no se pueda resolver mirando la web, pregúntame antes de inventar.
- No copiar código ni recursos propios de pkmnquiz.com (su JS, sus sprites personalizados, su logo). Usar las mismas fuentes públicas que ellos: **PokéAPI** para datos y **PokéSprite** para sprites.

---

## 1. Stack y estructura

- Frontend: HTML + CSS + JavaScript vanilla (módulos ES). Sin frameworks salvo que haya una razón clara.
- Backend (solo para multijugador): Node.js + `ws` (WebSockets). Un único servidor que también sirve los archivos estáticos.
- Todos los datos y sprites se guardan **en local** dentro del proyecto (nada se carga de internet en tiempo de juego).

Estructura sugerida:

```
/data/pokemon.json        # generado por el script de datos
/data/lists/              # listas manuales (ultraentes, paradoja, megas, gigamax…)
/sprites/normal/          # sprites normales
/sprites/shiny/           # sprites shiny
/scripts/build-data.js    # descarga y genera datos y sprites
/server/index.js          # servidor estático + WebSocket
/public/index.html
/public/css/
/public/js/               # quiz.js, matching.js, ui.js, multiplayer.js, state.js…
/public/sounds/
```

---

## 2. Datos

Script `scripts/build-data.js` que se ejecuta una vez y genera `data/pokemon.json`.

Por cada entrada del quiz:
- `id` único (especie o forma), `dexNumber`, `name` (nombre oficial en inglés, como en la web original), `aliases` (formas alternativas de escribirlo aceptadas).
- `generation` (1–9) y marca `hisui` cuando corresponda.
- `types` (1 o 2).
- Categorías: `legendary`, `subLegendary`, `mythical`, `ultraBeast`, `paradox`.
- Sección/región del layout a la que pertenece.
- Rutas de sprite normal y shiny, y sprites alternativos para "cycle sprites".

Secciones que existen en la web original y deben existir aquí: Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Mega Evolution – Kalos, Mega Evolution – Hoenn, Alola, Unknown, Galar, Gigantamax, Hisui, Paldea, Paldea Expeditions, Mega Evolution – Lumiose, Mega Evolution – Hyperspace. Comprobar en la web qué Pokémon entran exactamente en cada una (incluida "Unknown").

Las listas que PokéAPI no da directamente (ultraentes, paradoja, distinción legendario/sub-legendario, megas de cada grupo, gigamax) se definen a mano en `/data/lists/`.

Las **siluetas** no se guardan como archivos: se generan en el navegador rellenando de negro el sprite (canvas o filtro CSS `brightness(0)`).

---

## 3. Mecánica principal

### 3.1 Entrada de texto sin Enter
- Un único campo de texto. En cada pulsación se comprueba si lo escrito coincide con algún Pokémon **aún no acertado** dentro del quiz activo.
- Si coincide: se marca como acertado, aparece su sprite en su casilla, se limpia el campo y suena el sonido (si está activado). **Nunca hace falta pulsar Enter.**
- Normalización al comparar: sin distinguir mayúsculas, ignorar tildes/diacríticos, espacios, puntos, guiones, apóstrofos y símbolos. Deben funcionar sin problema casos como Farfetch'd, Sirfetch'd, Mr. Mime, Mr. Rime, Mime Jr., Nidoran♀/♂, Flabébé, Type: Null, Porygon-Z, Ho-Oh, Jangmo-o, Tapu Koko, los Pokémon paradoja y los nombres de megas/gigamax (comprobar en la web cómo se escriben esos).
- Si el nombre existe pero no pertenece al quiz activo, no cuenta.

### 3.2 Marcador y temporizador
- Contador "acertados / total".
- Temporizador visible (formato `00:00:00`).
- Opción de temporizador: infinito (∞, cuenta hacia arriba) o un número de minutos (cuenta atrás). Botón "set" para aplicarlo. Cambiarlo muestra el diálogo "Change timer? – Quiz and timer will reset".
- Botón de pausa ⏸ (ver 5.4).

### 3.3 Layout
- Casillas agrupadas por sección/región con su título, como en la web original. Casilla vacía = sprite "desconocido"; al acertar, sprite real.

### 3.4 Final
- Botones **Give Up** y **Reset**.
- Al rendirse o acabarse el tiempo: mostrar los **nombres fallados** (Missed names).
- Al completar: pantalla "Well done!" con número de Pokémon, tiempo, mención "in Pokédex order" si aplica, y el aviso de cuántas sombras se usaron con la sugerencia de probar sin sombras. Se cierra haciendo clic en cualquier sitio.

---

## 4. Tipos de quiz

Cambiar de quiz muestra el diálogo "Switch Quiz? – Quiz and timer will reset".

### 4.1 Full Quiz
Todos los Pokémon (todas las secciones).

### 4.2 Generations — ⭐ ÚNICO CAMBIO RESPECTO A LA ORIGINAL
- Lista de opciones: Gen 1, 2, 3, 4, 5, 6, 7, 8, **Hisui**, 9 (igual que la original), cada una con su icono.
- **Selección múltiple**: se pueden marcar una, varias o todas. El quiz contiene solo los Pokémon de las marcadas, con el layout agrupado por sección en orden de generación.
- Botón claro para empezar el quiz con la selección actual, y atajos "seleccionar todas" / "ninguna".
- No se puede empezar con 0 marcadas.
- Mostrar en la cabecera del quiz qué generaciones están activas (p. ej. "Gen 1 · 2 · 5").
- Respetar el mismo criterio que la original sobre qué formas (megas, regionales, etc.) entran en el quiz de cada generación.
- El estado guardado (5.4) y el multijugador (6) deben incluir la selección de generaciones.

### 4.3 Types
- Selector de los 18 tipos con icono y abreviatura (NRM, GRD, BUG, WTR, FLY, RCK, GRS, FGT, GHT, FIR, PSN, STL, ELC, PSY, DRG, ICE, DRK, FRY).
- Funcionar exactamente como en la original (comprobar si se elige un tipo o varios y cómo se tratan los de doble tipo).

### 4.4 Special Quiz
Sub-Legendary, Legendary, Mythical, Ultra Beast, Paradox (y lo que haya en la original).

---

## 5. Opciones

Cada opción que en la original muestra diálogo de confirmación debe mostrarlo aquí con el mismo texto.

### 5.1 Modo (Mode)
- **Regular**: layout por regiones con casillas fijas. Diálogo: "Switch to regular quiz with Region Layout".
- **Chaos**: acertar sin posiciones predeterminadas (los acertados aparecen según se van diciendo). Diálogo: "Enable guessing without predetermined placements".
- **Dex Order**: obliga a acertar en orden de Pokédex. Diálogo: "Enforce guessing in Pokédex order".
- Los tres reinician quiz y temporizador.

### 5.2 Visual
- **Type-Shuffle** on/off (comprobar su efecto exacto en la original).
- **Shiny**: usar sprites shiny.
- **Cycle sprites** on/off: ir alternando entre los sprites de las distintas formas.
- **I'm scared!**: replicar el comportamiento exacto de la original (comprobar qué hace).
- **Modo claro/oscuro** (sol/luna).
- **Sound** on/off.

### 5.3 Ayudas
- **Spelling Help**: muestra "Most similar spelling – click to reveal", el nombre no acertado más parecido a lo escrito (distancia de Levenshtein o similar), oculto hasta hacer clic.
- **No Shadows / Shadows**: activar sombras muestra las siluetas de todos los no acertados. Diálogo: "Reveal shadows? – Cannot be undone without reset".
- **Next Shadow**: con las sombras desactivadas, pulsar `,` revela la silueta del siguiente Pokémon; opción **AUTO 20s** que lo hace cada 20 segundos.
- Contar las sombras usadas para la pantalla final.

### 5.4 Pausa y guardado
- Pausa: oculta el tablero y detiene el temporizador. Botón Resume.
- **Save/Load Quiz State**: descargar el estado completo en un archivo JSON (quiz activo, generaciones seleccionadas, acertados, tiempo, opciones, sombras usadas) y cargarlo desde archivo.

---

## 6. Multijugador

- **Multiplayer Invite**: el anfitrión pone un nombre temporal y se crea un enlace de invitación. **Copy Invite Link** lo copia.
- Quien entra por el enlace pone su nombre temporal y ve el aviso de que el anfitrión controla la configuración.
- Solo el anfitrión cambia quiz, generaciones, modo, temporizador y opciones; todo se sincroniza a los demás.
- Las respuestas se sincronizan en tiempo real y se atribuyen al jugador que acertó.
- Paneles **Current Top 3** y **Leaderboard**, como en la original.
- Servidor autoritativo (`server/index.js` con `ws`): valida aciertos, evita que dos jugadores cuenten el mismo Pokémon y gestiona desconexiones y reconexiones.
- Debe funcionar en local con varias pestañas. Documentar en el README cómo jugar con amigos fuera de mi red (desplegar el servidor o usar un túnel).

---

## 7. Otros

- Pantalla de carga "Loading Quiz".
- Diseño responsive (PC y móvil).
- Pie de página con créditos a PokéAPI, PokéSprite y el aviso de que es un proyecto no oficial basado en Pokémon. No copiar los créditos, enlaces de donación ni textos personales de la web original.

---

## 8. Plan de trabajo por fases

Trabajar fase a fase. Al terminar cada una, comprobar que funciona, resumirme qué se ha hecho y esperar mi confirmación antes de seguir.

1. **Datos y sprites**: script de datos, listas manuales, descarga de sprites normales y shiny. Verificar el recuento por generación y sección.
2. **Quiz básico**: layout, entrada sin Enter con normalización, contador, temporizador, Give Up / Reset, nombres fallados, pantalla final.
3. **Selector de generaciones múltiple**, Full Quiz, Types y Special Quiz.
4. **Modos**: Regular, Chaos, Dex Order y todos los diálogos de confirmación.
5. **Opciones**: sombras, next shadow + auto 20s, spelling help, shiny, type-shuffle, cycle sprites, I'm scared, sonido, modo oscuro, temporizador configurable.
6. **Pausa y guardar/cargar estado.**
7. **Multijugador.**
8. **Repaso final**: comparar opción por opción con pkmnquiz.com y listar cualquier diferencia que quede.

## 9. Criterios de aceptación

- Escribir "pikachu", "Pikachu" o "PIKACHU" lo acierta al instante sin Enter; "mr mime", "farfetchd", "flabebe" y "type null" también funcionan.
- Marcar solo Gen 1, 2 y 5 genera un quiz con exactamente los Pokémon de esas tres generaciones.
- Cada opción de la web original existe y se comporta igual (salvo Twitch).
- Guardar, recargar la página y cargar el archivo recupera la partida exacta.
- Dos pestañas en multijugador ven los aciertos del otro en tiempo real y el leaderboard coincide.
