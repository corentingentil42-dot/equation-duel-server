// ==========================================
//   ÉQUATION DUEL — Multijoueur Socket.io
// ==========================================
const CONFIG = {
  rounds: 5,
  roundTime: 45,
  pointsPerSolve: 100,
  speedBonusMax: 50
};

const ROLE = sessionStorage.getItem('role');
const CODE = sessionStorage.getItem('code');

if (!ROLE || !CODE) {
  location.href = 'index.html';
}

const socket = io();

const state = {
  round: 0,
  maxRounds: CONFIG.rounds,
  running: false,
  scores: [0, 0],
  myIndex: ROLE === 'host' ? 0 : 1,
  timeLeft: CONFIG.roundTime,
  timerInterval: null,
  myEquation: null,
  myAnswers: [],
  myCurrentIndex: 0,
  mySolved: false,
  myFrozen: false,
  myPowerups: { hint: 2, freeze: 1, skip: 1 },
  myCombo: 0,
  oppEquation: '—',
  oppSolved: false,
  oppProgress: [0, 0],
  mode: 'easy',
  gameStarted: false
};

const $ = (id) => document.getElementById(id);
const eqEls = { my: $('my-equation'), opp: $('opp-equation') };
const scoreEls = { my: $('my-score'), opp: $('opp-score') };
const nameEls = { my: $('my-name'), opp: $('opp-name') };
const dotsEls = { my: $('my-dots'), opp: $('opp-dots') };
const inputEl = $('my-input');
const hintEl = $('my-hint');
const feedbackEl = $('my-feedback');
const powerupBar = $('my-powerups');
const myZone = $('my-zone');
const oppStatusEl = $('opp-status');

nameEls.my.textContent = 'JOUEUR ' + (state.myIndex + 1);
nameEls.opp.textContent = 'JOUEUR ' + ((1 - state.myIndex) + 1);

// ==========================================
//   RECEPTION DES MESSAGES
// ==========================================
socket.on('game-message', (msg) => {
  switch (msg.type) {
    case 'start-round':
      applyRound(msg);
      break;
    case 'progress':
      state.oppProgress = msg.progress;
      state.oppEquation = msg.equation;
      renderOpp();
      break;
    case 'solved':
      state.oppSolved = true;
      state.oppEquation = msg.equation;
      renderOpp();
      endRound(1 - state.myIndex);
      break;
    case 'freeze':
      applyFreeze();
      break;
    case 'timeout':
      endRound(null);
      break;
    case 'restart':
      resetGame();
      if (ROLE === 'host') startCountdown();
      break;
    case 'client-ready-next':
      if (ROLE === 'host') {
        state.round++;
        sendRound();
      }
      break;
  }
});

// Le client signale qu'il est prêt au lancement
socket.on('client-ready', () => {
  if (ROLE === 'host') {
    console.log('[Game] Client prêt, démarrage !');
    setTimeout(() => startCountdown(), 500);
  }
});

socket.on('opponent-left', () => {
  alert('Ton adversaire s\'est déconnecté.');
  location.href = 'index.html';
});

// ==========================================
//   DEMARRAGE
// ==========================================
window.addEventListener('load', () => {
  if (ROLE === 'host') {
    console.log('[Game] Hôte en attente du client...');
    // L'hôte attend le signal 'client-ready' du client
  } else {
    console.log('[Game] Client prêt, signal envoyé');
    // Le client prévient l'hôte qu'il est prêt
    setTimeout(() => socket.emit('client-ready'), 300);
  }
});

// ==========================================
//   ENVOI D'UN ROUND (MÊME ÉQUATION POUR LES DEUX)
// ==========================================
function sendRound() {
  // 🎯 UNE SEULE équation générée, partagée par les deux joueurs
  const eq = Equations.generateEquation(state.mode);
  const msg = {
    type: 'start-round',
    round: state.round,
    mode: state.mode,
    equations: [eq, eq]   // même équation pour les deux
  };
  applyRound(msg);
  socket.emit('game-message', msg);
}

// ==========================================
//   APPLICATION D'UN ROUND
// ==========================================
function applyRound(msg) {
  state.round = msg.round;
  state.mode = msg.mode;
  state.mySolved = false;
  state.myFrozen = false;
  state.oppSolved = false;
  state.oppProgress = [0, 0];
  state.myCurrentIndex = 0;
  state.myCombo = 0;
  state.gameStarted = true;
  myZone.classList.remove('frozen');

  const myEq = msg.equations[state.myIndex];
  state.myEquation = myEq.eq;
  state.myAnswers = myEq.answers;
  eqEls.my.textContent = myEq.eq;
  inputEl.value = '';
  inputEl.disabled = false;

  state.oppEquation = '—';
  eqEls.opp.textContent = '—';
  oppStatusEl.textContent = 'En attente…';

  updateRoundInfo();
  updateDots();
  updatePowerups();
  updateScore();

  hintEl.textContent = state.myAnswers.length > 1
    ? `Donne les ${state.myAnswers.length} solutions dans l'ordre croissant` : '';

  state.running = true;
  state.timeLeft = CONFIG.roundTime;
  startTimer();

  // Force le focus (utile sur mobile après réception du message)
  setTimeout(() => inputEl.focus(), 100);
}

function updateScore() {
  scoreEls.my.textContent = state.scores[state.myIndex];
  scoreEls.opp.textContent = state.scores[1 - state.myIndex];
}

function updateRoundInfo() {
  $('round-num').textContent = state.round;
  $('round-total').textContent = state.maxRounds;
}

function updateDots() {
  dotsEls.my.innerHTML = '';
  for (let i = 0; i < state.myAnswers.length; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    if (i < state.myCurrentIndex) d.classList.add('done');
    else if (i === state.myCurrentIndex) d.classList.add('current');
    dotsEls.my.appendChild(d);
  }
}

function renderOpp() {
  eqEls.opp.textContent = state.oppEquation;
  dotsEls.opp.innerHTML = '';
  for (let i = 0; i < state.oppProgress[1]; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    if (i < state.oppProgress[0]) d.classList.add('done');
    else if (i === state.oppProgress[0]) d.classList.add('current');
    dotsEls.opp.appendChild(d);
  }
  oppStatusEl.textContent = state.oppSolved ? '✅ Résolu !' : 'Réflexion…';
}

function updatePowerups() {
  powerupBar.querySelectorAll('.powerup').forEach(el => {
    const pu = el.dataset.pu;
    const count = state.myPowerups[pu];
    const c = el.querySelector('.count');
    if (count > 0) {
      el.classList.remove('used');
      c.textContent = count;
      c.style.display = 'flex';
    } else {
      el.classList.add('used');
      c.style.display = 'none';
    }
  });
}

function showFeedback(text, color = '#00ff88') {
  feedbackEl.textContent = text;
  feedbackEl.style.color = color;
  feedbackEl.classList.remove('show');
  void feedbackEl.offsetWidth;
  feedbackEl.classList.add('show');
}

function startTimer() {
  clearInterval(state.timerInterval);
  const bar = $('timer-bar');
  bar.style.width = '100%';
  state.timerInterval = setInterval(() => {
    state.timeLeft -= 0.1;
    bar.style.width = Math.max(0, (state.timeLeft / CONFIG.roundTime) * 100) + '%';
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      if (ROLE === 'host') {
        endRound(null);
        socket.emit('game-message', { type: 'timeout' });
      }
    }
  }, 100);
}

function submitAnswer() {
  if (!state.running || state.mySolved || state.myFrozen) return;
  const raw = inputEl.value.trim().replace(',', '.').replace(/\s/g, '');
  if (raw === '') return;
  const val = parseFloat(raw);
  if (isNaN(val)) { shake(); return; }

  const expected = state.myAnswers[state.myCurrentIndex];

  if (Math.abs(val - expected) < 0.01) {
    state.myCurrentIndex++;
    inputEl.value = '';
    updateDots();

    if (state.myCurrentIndex >= state.myAnswers.length) {
      state.mySolved = true;
      state.myCombo++;
      const speedBonus = Math.round((state.timeLeft / CONFIG.roundTime) * CONFIG.speedBonusMax);
      const comboBonus = Math.min(state.myCombo - 1, 5) * 20;
      const points = CONFIG.pointsPerSolve + speedBonus + comboBonus;
      state.scores[state.myIndex] += points;
      updateScore();
      showFeedback(`+${points} ✓`);

      socket.emit('game-message', {
        type: 'solved',
        equation: state.myEquation,
        progress: [state.myAnswers.length, state.myAnswers.length]
      });
      endRound(state.myIndex);
    } else {
      showFeedback('✓');
      socket.emit('game-message', {
        type: 'progress',
        equation: state.myEquation,
        progress: [state.myCurrentIndex, state.myAnswers.length]
      });
    }
  } else {
    shake();
    showFeedback('✗', '#ff4d6d');
    state.myCombo = 0;
  }
}

function shake() {
  inputEl.classList.add('shake');
  setTimeout(() => inputEl.classList.remove('shake'), 400);
}

function endRound(winnerIndex) {
  if (!state.running) return;
  state.running = false;
  clearInterval(state.timerInterval);
  inputEl.disabled = true;

  if (winnerIndex === state.myIndex) myZone.classList.add('flash-win');
  else if (winnerIndex !== null) myZone.classList.add('flash-lose');

  setTimeout(() => {
    myZone.classList.remove('flash-win', 'flash-lose');
    if (state.round >= state.maxRounds) endGame();
    else showRoundOverlay(winnerIndex);
  }, 800);
}

function showRoundOverlay(winnerIndex) {
  const overlay = $('round-overlay');
  const result = $('round-result');
  const detail = $('round-detail');

  if (winnerIndex === null) {
    result.textContent = '⏱️ TEMPS ÉCOULÉ';
    result.style.color = '#8b9bc0';
    detail.textContent = 'Personne n\'a terminé à temps.';
  } else if (winnerIndex === state.myIndex) {
    result.textContent = '🎉 TU GAGNES LE ROUND !';
    result.style.color = '#00ff88';
  } else {
    result.textContent = '😞 ROUND PERDU';
    result.style.color = '#ff4d6d';
  }
  detail.textContent = `Toi ${state.scores[state.myIndex]} — Adversaire ${state.scores[1 - state.myIndex]}`;
  overlay.classList.remove('hidden');
}

function endGame() {
  const overlay = $('gameover-overlay');
  const w = $('winner-name');
  const s = $('final-score');
  const mine = state.scores[state.myIndex];
  const theirs = state.scores[1 - state.myIndex];

  if (mine > theirs) { w.textContent = '🏆 VICTOIRE !'; w.style.color = '#00ff88'; }
  else if (mine < theirs) { w.textContent = 'DÉFAITE…'; w.style.color = '#ff4d6d'; }
  else { w.textContent = 'ÉGALITÉ'; w.style.color = '#ffd700'; }

  s.textContent = `Toi ${mine} — Adversaire ${theirs}`;
  overlay.classList.remove('hidden');
}

function usePowerup(pu) {
  if (!state.running || state.mySolved) return;
  if (state.myPowerups[pu] <= 0) return;
  state.myPowerups[pu]--;
  updatePowerups();

  if (pu === 'hint') {
    const expected = state.myAnswers[state.myCurrentIndex];
    hintEl.textContent = `💡 Solution n°${state.myCurrentIndex + 1} : ${expected > 0 ? 'positive' : expected < 0 ? 'négative' : 'nulle'}`;
    hintEl.style.color = '#ffd700';
    setTimeout(() => {
      hintEl.style.color = '#8b9bc0';
      hintEl.textContent = state.myAnswers.length > 1
        ? `Donne les ${state.myAnswers.length} solutions dans l'ordre croissant` : '';
    }, 4000);
  }
  if (pu === 'freeze') {
    socket.emit('game-message', { type: 'freeze' });
    showFeedback('❄️', '#a0e0ff');
  }
  if (pu === 'skip') {
    socket.emit('game-message', {
      type: 'solved',
      equation: state.myEquation,
      progress: [state.myAnswers.length, state.myAnswers.length],
      skipped: true
    });
    endRound(1 - state.myIndex);
  }
}

function applyFreeze() {
  state.myFrozen = true;
  myZone.classList.add('frozen');
  inputEl.disabled = true;
  setTimeout(() => {
    state.myFrozen = false;
    if (state.running && !state.mySolved) {
      myZone.classList.remove('frozen');
      inputEl.disabled = false;
      inputEl.focus();
    }
  }, 4000);
}

function startCountdown() {
  const overlay = $('countdown-overlay');
  const el = $('countdown');
  overlay.classList.remove('hidden');
  let n = 3;
  el.textContent = n;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'countPulse 1s ease-out';

  const iv = setInterval(() => {
    n--;
    if (n > 0) {
      el.textContent = n;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'countPulse 1s ease-out';
    } else {
      clearInterval(iv);
      overlay.classList.add('hidden');
      state.round = 0;
      state.scores = [0, 0];
      updateScore();
      state.myPowerups = { hint: 2, freeze: 1, skip: 1 };
      updatePowerups();
      state.round = 1;
      sendRound();
    }
  }, 1000);
}

function resetGame() {
  state.round = 0;
  state.scores = [0, 0];
  state.myPowerups = { hint: 2, freeze: 1, skip: 1 };
  state.mySolved = false;
  state.oppSolved = false;
  state.gameStarted = false;
  updateScore();
  updatePowerups();
  $('gameover-overlay').classList.add('hidden');
}

// ==========================================
//   UI
// ==========================================
$('next-round-btn').addEventListener('click', () => {
  $('round-overlay').classList.add('hidden');
  if (ROLE === 'host') {
    state.round++;
    sendRound();
  } else {
    // Le client signale qu'il est prêt pour la suite
    socket.emit('game-message', { type: 'client-ready-next' });
  }
});

$('restart-btn').addEventListener('click', () => {
  resetGame();
  if (ROLE === 'host') {
    socket.emit('game-message', { type: 'restart' });
    setTimeout(() => startCountdown(), 300);
  }
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
});

powerupBar.querySelectorAll('.powerup').forEach(el => {
  el.addEventListener('click', () => usePowerup(el.dataset.pu));
});

document.body.addEventListener('touchmove', (e) => {
  if (e.target === document.body) e.preventDefault();
}, { passive: false });
