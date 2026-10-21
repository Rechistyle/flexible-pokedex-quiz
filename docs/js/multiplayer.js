// Multijugador P2P con PeerJS (WebRTC). El navegador del anfitrión es el árbitro:
// valida los aciertos, reparte los puntos y manda el estado del quiz a los invitados.
// Solo se usa el servidor público y gratuito de PeerJS para que los jugadores se encuentren.
//
// Mensajes invitado -> anfitrión: hello {name}, guess {base, unique}, ping
// Mensajes anfitrión -> invitado: welcome/state {state}, named {base, user, scores}, msg {text, sound}, nametaken, ping

const ROOM_PREFIX = 'flexpkmnquiz-';
const RETRIES = 3;
const PING_MS = 3000;
const TIMEOUT_MS = 10000; // sin noticias en este tiempo = conexión perdida

export function createNet(hooks) {
  const net = {
    role: null, // null (solo) | 'host' | 'guest'
    username: null,
    room: null,
    scores: {}, // nombre -> aciertos
  };
  let peer = null;
  const guests = new Map(); // conn.peer -> { conn, name, seen }
  let hostConn = null;
  let hostSeen = 0;
  let retries = 0;

  const send = (conn, msg) => { if (conn?.open) conn.send(msg); };
  const broadcast = (msg) => { for (const g of guests.values()) send(g.conn, msg); };

  // Latido: WebRTC tarda mucho en notar que el otro se ha ido, así que cada lado
  // avisa cada 3 s y da por perdida la conexión si pasan 10 s sin noticias
  setInterval(() => {
    const now = Date.now();
    if (net.role === 'host') {
      broadcast({ t: 'ping' });
      for (const [id, g] of guests) if (now - g.seen > TIMEOUT_MS) dropGuest(id);
    } else if (net.role === 'guest' && hostConn) {
      send(hostConn, { t: 'ping' });
      if (now - hostSeen > TIMEOUT_MS) hostLost();
    }
  }, PING_MS);

  // Al cerrar la página se avisa a los demás
  addEventListener('pagehide', () => peer?.destroy());

  // ------------------------------------------------------------ anfitrión

  net.host = (username) => {
    net.username = username;
    net.scores[username] ??= 0;
    hooks.message('Generating room...');
    const id = ROOM_PREFIX + Math.random().toString(36).slice(2, 10);
    peer = new window.Peer(id);
    peer.on('open', () => {
      net.role = 'host';
      net.room = id.slice(ROOM_PREFIX.length);
      hooks.onRoomCreated();
    });
    peer.on('error', (err) => hooks.message(`Multiplayer error: ${err.type}`));
    peer.on('connection', (conn) => {
      conn.on('data', (msg) => onGuestMessage(conn, msg));
      conn.on('close', () => dropGuest(conn.peer));
    });
  };

  function dropGuest(id) {
    const g = guests.get(id);
    if (!g) return;
    guests.delete(id);
    g.conn.close();
    broadcast({ t: 'msg', text: `${g.name} left the room !`, sound: 'leave' });
    hooks.message(`${g.name} left the room !`);
    hooks.sound('leave');
  }

  function onGuestMessage(conn, msg) {
    const g = guests.get(conn.peer);
    if (g) g.seen = Date.now();
    if (msg.t === 'hello') {
      const name = String(msg.name).slice(0, 25);
      if (name === net.username) return send(conn, { t: 'nametaken' });
      // Mismo nombre que un invitado conectado: es él reconectando (recargó la página)
      for (const [id, other] of guests) if (other.name === name) { guests.delete(id); other.conn.close(); }
      guests.set(conn.peer, { conn, name, seen: Date.now() });
      net.scores[name] ??= 0; // si vuelve con el mismo nombre conserva sus puntos
      send(conn, { t: 'welcome', state: hooks.getState() });
      broadcast({ t: 'msg', text: `${name} joined the room !`, sound: 'join' });
      hooks.message(`${name} joined the room !`);
      hooks.sound('join');
      hooks.onScores();
    } else if (msg.t === 'guess' && g) {
      hooks.onGuestGuess(msg.base, msg.unique, g.name);
    }
  }

  // El anfitrión anuncia un acierto (suyo o de un invitado)
  net.announce = (base, user) => {
    if (net.role !== 'host') return;
    net.scores[user] = (net.scores[user] ?? 0) + 1;
    broadcast({ t: 'named', base, user, scores: net.scores });
    hooks.onScores();
  };

  // Cualquier cambio de configuración del anfitrión se manda entero
  net.sync = () => {
    if (net.role === 'host') broadcast({ t: 'state', state: hooks.getState() });
  };

  net.resetScores = () => {
    for (const k of Object.keys(net.scores)) net.scores[k] = 0;
    hooks.onScores();
  };

  net.inviteLink = () => `${location.origin}${location.pathname}?room=${net.room}`;

  // ------------------------------------------------------------ invitado

  net.join = (room, username) => {
    net.username = username;
    net.room = room;
    if (hostConn?.open) return send(hostConn, { t: 'hello', name: username }); // otro nombre tras "nametaken"
    peer = new window.Peer();
    peer.on('open', connect);
    peer.on('error', (err) => {
      if (err.type !== 'peer-unavailable') return hooks.message(`Multiplayer error: ${err.type}`);
      if (net.role !== 'guest') return hooks.onClosed('Room no longer exists');
      retry();
    });
  };

  function connect() {
    const conn = peer.connect(ROOM_PREFIX + net.room, { reliable: true });
    hostConn = conn;
    conn.on('open', () => {
      retries = 0;
      hostSeen = Date.now();
      net.role = 'guest';
      send(conn, { t: 'hello', name: net.username });
    });
    conn.on('data', onHostMessage);
    conn.on('close', () => { if (conn === hostConn) hostLost(); });
  }

  // Si se corta, se reintenta unas veces antes de dar la sala por cerrada
  function hostLost() {
    if (!hostConn) return;
    const conn = hostConn;
    hostConn = null;
    conn.close();
    retry();
  }

  function retry() {
    if (retries++ < RETRIES) setTimeout(connect, 2000);
    else hooks.onClosed('The host has disbanded the room');
  }

  function onHostMessage(msg) {
    hostSeen = Date.now();
    if (msg.t === 'nametaken') return hooks.onNameTaken();
    if (msg.t === 'welcome' || msg.t === 'state') {
      if (msg.t === 'welcome') hooks.onJoined();
      net.scores = msg.state.scores ?? net.scores;
      hooks.applyState(msg.state);
      hooks.onScores();
    } else if (msg.t === 'named') {
      net.scores = msg.scores;
      hooks.applyNamed(msg.base, msg.user);
      hooks.onScores();
    } else if (msg.t === 'msg') {
      hooks.message(msg.text);
      if (msg.sound) hooks.sound(msg.sound);
    }
  }

  net.sendGuess = (base, unique) => send(hostConn, { t: 'guess', base, unique });

  return net;
}
