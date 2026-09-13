const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Stockage des salles : { code: { host: socketId, guest: socketId | null } }
const rooms = {};

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

io.on('connection', (socket) => {
  console.log('🔌 Connecté :', socket.id);

  // ===== CRÉER UNE PARTIE =====
  socket.on('create-room', (callback) => {
    let code;
    do { code = genCode(); } while (rooms[code]);

    rooms[code] = { host: socket.id, guest: null };
    socket.join(code);
    socket.roomCode = code;
    socket.isHost = true;

    console.log('🎮 Salle créée :', code);
    callback({ ok: true, code, role: 'host' });
  });

  // ===== REJOINDRE UNE PARTIE =====
  socket.on('join-room', (code, callback) => {
    code = (code || '').toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      return callback({ ok: false, error: 'Code introuvable' });
    }
    if (room.guest) {
      return callback({ ok: false, error: 'Salle déjà pleine' });
    }

    room.guest = socket.id;
    socket.join(code);
    socket.roomCode = code;
    socket.isHost = false;

    console.log('👥 Client rejoint :', code);

      // ===== LE CLIENT SIGNALE QU'IL EST PRÊT =====
  socket.on('client-ready', () => {
    if (!socket.roomCode) return;
    socket.to(socket.roomCode).emit('client-ready');
    console.log('✅ Client prêt dans la salle', socket.roomCode);
  });

    // Informe l'hôte que l'adversaire est là
    io.to(room.host).emit('opponent-joined');

    callback({ ok: true, code, role: 'guest' });
  });

    // Informe l'hôte que l'adversaire est là
    io.to(room.host).emit('opponent-joined');

    callback({ ok: true, code, role: 'guest' });
  });

  // ===== RELAI DES MESSAGES DE JEU =====
  socket.on('game-message', (msg) => {
    if (!socket.roomCode) return;
    // Envoie à tout le monde dans la salle SAUF l'émetteur
    socket.to(socket.roomCode).emit('game-message', msg);
  });

  // ===== DÉCONNEXION =====
  socket.on('disconnect', () => {
    console.log('❌ Déconnecté :', socket.id);
    const code = socket.roomCode;
    if (code && rooms[code]) {
      // Préviens l'autre joueur
      socket.to(code).emit('opponent-left');
      delete rooms[code];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('✅ Serveur prêt sur le port ' + PORT);
});
