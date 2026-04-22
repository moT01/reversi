// ─── Constants ───────────────────────────────────────────────────────────────

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0,  -1],           [0,  1],
  [1,  -1], [1,  0], [1,  1],
];

const POSITION_WEIGHTS = [
  [100, -20,  10,   5,   5,  10, -20, 100],
  [-20, -50,  -2,  -2,  -2,  -2, -50, -20],
  [ 10,  -2,   0,   1,   1,   0,  -2,  10],
  [  5,  -2,   1,   0,   0,   1,  -2,   5],
  [  5,  -2,   1,   0,   0,   1,  -2,   5],
  [ 10,  -2,   0,   1,   1,   0,  -2,  10],
  [-20, -50,  -2,  -2,  -2,  -2, -50, -20],
  [100, -20,  10,   5,   5,  10, -20, 100],
];

// ─── Game Logic ──────────────────────────────────────────────────────────────

function createBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(0));
  board[3][3] = 2; // light
  board[3][4] = 1; // dark
  board[4][3] = 1; // dark
  board[4][4] = 2; // light
  return board;
}

function getFlips(board, row, col, player) {
  if (board[row][col] !== 0) return [];
  const opponent = player === 1 ? 2 : 1;
  const flips = [];
  for (const [dr, dc] of DIRECTIONS) {
    const line = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opponent) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }
    if (line.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

function getValidMoves(board, player) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 0 && getFlips(board, r, c, player).length > 0) {
        moves.push([r, c]);
      }
    }
  }
  return moves;
}

function applyMove(board, row, col, player) {
  const flipped = getFlips(board, row, col, player);
  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = player;
  for (const [r, c] of flipped) {
    newBoard[r][c] = player;
  }
  return { board: newBoard, flipped };
}

function countDiscs(board) {
  const counts = { 1: 0, 2: 0 };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 1) counts[1]++;
      else if (board[r][c] === 2) counts[2]++;
    }
  }
  return counts;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

function evaluateBoard(board, player) {
  const opponent = player === 1 ? 2 : 1;
  const playerMoves = getValidMoves(board, player);
  const opponentMoves = getValidMoves(board, opponent);

  if (playerMoves.length === 0 && opponentMoves.length === 0) {
    const counts = countDiscs(board);
    return (counts[player] - counts[opponent]) * 1000;
  }

  let positional = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === player) positional += POSITION_WEIGHTS[r][c];
      else if (board[r][c] === opponent) positional -= POSITION_WEIGHTS[r][c];
    }
  }

  const mobility = (playerMoves.length - opponentMoves.length) * 10;

  let endgameBonus = 0;
  const total = countDiscs(board);
  const totalDiscs = total[1] + total[2];
  if (totalDiscs >= 50) {
    endgameBonus = (total[player] - total[opponent]) * 5;
  }

  return positional + mobility + endgameBonus;
}

function negamax(board, depth, alpha, beta, player) {
  const opponent = player === 1 ? 2 : 1;
  const moves = getValidMoves(board, player);

  if (depth === 0 || (moves.length === 0 && getValidMoves(board, opponent).length === 0)) {
    return evaluateBoard(board, player);
  }

  if (moves.length === 0) {
    return -negamax(board, depth, -beta, -alpha, opponent);
  }

  let best = -Infinity;
  for (const [r, c] of moves) {
    const { board: newBoard } = applyMove(board, r, c, player);
    const score = -negamax(newBoard, depth - 1, -beta, -alpha, opponent);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function getBestMove(board, player, depth) {
  const opponent = player === 1 ? 2 : 1;
  const moves = getValidMoves(board, player);
  let bestScore = -Infinity;
  let bestMove = moves[0];
  for (const [r, c] of moves) {
    const { board: newBoard } = applyMove(board, r, c, player);
    const score = -negamax(newBoard, depth - 1, -Infinity, Infinity, opponent);
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }
  return bestMove;
}

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  board: createBoard(),
  currentPlayer: 1,
  status: 'idle',
  winner: null,
  scores: { 1: 2, 2: 2 },
  validMoves: [],
  lastMove: null,
  flippedCells: [],
  mode: 'hvc',
  playerColor: 1,
  aiThinking: false,
  animating: false,
  passMessage: null,
  difficulty: 'normal',
  wins: { normal: 0, hard: 0 },
};

// ─── Persistence ─────────────────────────────────────────────────────────────

function saveState() {
  const toSave = { ...state };
  delete toSave.flippedCells;
  delete toSave.aiThinking;
  delete toSave.animating;
  delete toSave.passMessage;
  localStorage.setItem('reversi_state', JSON.stringify(toSave));
}

function loadState() {
  const winsRaw = localStorage.getItem('reversi_wins');
  if (winsRaw) {
    try { Object.assign(state.wins, JSON.parse(winsRaw)); } catch (_) {}
  }

  const raw = localStorage.getItem('reversi_state');
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      if (saved.status === 'playing') {
        Object.assign(state, saved);
        state.status = 'idle';
        state.flippedCells = [];
        state.aiThinking = false;
        state.passMessage = null;
        state.validMoves = getValidMoves(state.board, state.currentPlayer).map(([r, c]) => `${r},${c}`);
        return;
      }
    } catch (_) {}
  }

  // Restore preferences
  const theme = localStorage.getItem('reversi_theme') || 'dark';
  applyTheme(theme);
  const mode = localStorage.getItem('reversi_mode') || 'hvc';
  const color = parseInt(localStorage.getItem('reversi_color') || '1', 10);
  const difficulty = localStorage.getItem('reversi_difficulty') || 'normal';
  state.mode = mode;
  state.playerColor = color;
  state.difficulty = difficulty;
  state.status = 'idle';
}

// ─── Turn / Move Logic ───────────────────────────────────────────────────────

const FLIP_DURATION = 350;

function handleCellClick(row, col) {
  if (state.status !== 'playing') return;
  if (state.aiThinking || state.animating) return;
  if (!state.validMoves.includes(`${row},${col}`)) return;

  const { board: newBoard, flipped } = applyMove(state.board, row, col, state.currentPlayer);
  const player = state.currentPlayer;
  state.animating = true;
  state.lastMove = [row, col];

  // Place new disc directly in the DOM
  const placedCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  if (placedCell) {
    placedCell.querySelector('.valid-dot')?.remove();
    const disc = document.createElement('div');
    disc.className = `disc ${player === 1 ? 'dark' : 'light'} disc-new`;
    placedCell.appendChild(disc);
    document.querySelectorAll('.last-move-ring').forEach(el => el.remove());
    placedCell.appendChild(Object.assign(document.createElement('div'), { className: 'last-move-ring' }));
  }

  // Add flip animation class to each flipped disc's existing element
  const flipClass = player === 1 ? 'flip-to-dark' : 'flip-to-light';
  flipped.forEach(([r, c]) => {
    const disc = document.querySelector(`[data-row="${r}"][data-col="${c}"] .disc`);
    if (disc) disc.classList.add(flipClass);
  });

  // Lock all cells visually during animation
  document.querySelectorAll('.valid-dot').forEach(el => el.remove());
  document.querySelectorAll('.cell.valid').forEach(el => {
    el.classList.remove('valid');
    el.setAttribute('aria-disabled', 'true');
  });

  playSound('place');
  if (flipped.length > 0) setTimeout(() => playSound('flip'), 80);

  // After animation completes, commit state and continue
  setTimeout(() => {
    state.board = newBoard;
    state.flippedCells = [];
    state.scores = countDiscs(newBoard);
    state.animating = false;
    advanceTurn(newBoard, player);
    saveState();
  }, FLIP_DURATION + 10);
}

function advanceTurn(board, justPlayed) {
  const opponent = justPlayed === 1 ? 2 : 1;
  const opponentMoves = getValidMoves(board, opponent);
  const currentMoves = getValidMoves(board, justPlayed);
  const counts = countDiscs(board);
  const boardFull = counts[1] + counts[2] === 64;

  if (boardFull || (opponentMoves.length === 0 && currentMoves.length === 0)) {
    endGame(board);
    render();
    return;
  }

  if (opponentMoves.length === 0) {
    const colorName = opponent === 1 ? 'Dark' : 'Light';
    const otherName = justPlayed === 1 ? 'Dark' : 'Light';
    state.passMessage = `${colorName} has no moves - ${otherName}'s turn`;
    state.currentPlayer = justPlayed;
    state.validMoves = currentMoves.map(([r, c]) => `${r},${c}`);
    render();
    setTimeout(() => {
      state.passMessage = null;
      render();
    }, 1500);
    if (state.mode === 'hvc' && state.currentPlayer !== state.playerColor) {
      triggerAI();
    }
    return;
  }

  state.currentPlayer = opponent;
  state.validMoves = opponentMoves.map(([r, c]) => `${r},${c}`);
  render();

  if (state.mode === 'hvc' && state.currentPlayer !== state.playerColor) {
    triggerAI();
  }
}

function triggerAI() {
  if (state.animating) { setTimeout(triggerAI, 50); return; }
  state.aiThinking = true;
  render();
  const aiColor = state.mode === 'hvc' ? (state.playerColor === 1 ? 2 : 1) : state.currentPlayer;
  const depth = state.difficulty === 'hard' ? 5 : 3;
  const aiStartTime = Date.now();
  const move = getBestMove(state.board, aiColor, depth);
  const elapsed = Date.now() - aiStartTime;

  setTimeout(() => {
    state.aiThinking = false;
    if (move) {
      handleCellClick(move[0], move[1]);
    }
  }, Math.max(0, 900 - elapsed));
}

function endGame(board) {
  const counts = countDiscs(board);
  state.scores = counts;
  if (counts[1] > counts[2]) {
    state.status = 'won';
    state.winner = 1;
  } else if (counts[2] > counts[1]) {
    state.status = 'won';
    state.winner = 2;
  } else {
    state.status = 'draw';
    state.winner = null;
  }
  if (state.mode === 'hvc' && state.winner === state.playerColor) {
    state.wins[state.difficulty]++;
    localStorage.setItem('reversi_wins', JSON.stringify(state.wins));
  }
}

function startGame() {
  state.board = createBoard();
  state.currentPlayer = 1;
  state.status = 'playing';
  state.winner = null;
  state.lastMove = null;
  state.flippedCells = [];
  state.passMessage = null;
  state.scores = { 1: 2, 2: 2 };
  state.validMoves = getValidMoves(state.board, 1).map(([r, c]) => `${r},${c}`);
  saveState();
  render();
  if (state.mode === 'hvc' && state.playerColor === 2) {
    triggerAI();
  }
}

function resetGame() {
  if (state.status === 'playing') {
    showConfirmModal(startGame);
  } else {
    startGame();
  }
}

// ─── Sound ───────────────────────────────────────────────────────────────────

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'place') {
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else {
      osc.frequency.value = 280;
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    }
    osc.onended = () => ctx.close();
  } catch (_) {}
}

// ─── Theme ───────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.body.classList.remove('dark-palette', 'light-palette');
  document.body.classList.add(theme === 'light' ? 'light-palette' : 'dark-palette');
  localStorage.setItem('reversi_theme', theme);
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-palette');
  applyTheme(isLight ? 'dark' : 'light');
  render();
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const ICON_QUESTION = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" fill="currentColor"><path d="M64 160c0-53 43-96 96-96s96 43 96 96c0 42.7-27.9 78.9-66.5 91.4-28.4 9.2-61.5 35.3-61.5 76.6l0 24c0 17.7 14.3 32 32 32s32-14.3 32-32l0-24c0-1.7 .6-4.1 3.5-7.3 3-3.3 7.9-6.5 13.7-8.4 64.3-20.7 110.8-81 110.8-152.3 0-88.4-71.6-160-160-160S0 71.6 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32zm96 352c22.1 0 40-17.9 40-40s-17.9-40-40-40-40 17.9-40 40 17.9 40 40 40z"/></svg>`;
const ICON_HEART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M241 87.1l15 20.7 15-20.7C296 52.5 336.2 32 378.9 32 452.4 32 512 91.6 512 165.1l0 2.6c0 112.2-139.9 242.5-212.9 298.2-12.4 9.4-27.6 14.1-43.1 14.1s-30.8-4.6-43.1-14.1C139.9 410.2 0 279.9 0 167.7l0-2.6C0 91.6 59.6 32 133.1 32 175.8 32 216 52.5 241 87.1z"/></svg>`;
const ICON_X = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M376.6 84.5c11.3-13.6 9.5-33.8-4.1-45.1s-33.8-9.5-45.1 4.1L192 206 56.6 43.5C45.3 29.9 25.1 28.1 11.5 39.4S-3.9 70.9 7.4 84.5L150.3 256 7.4 427.5c-11.3 13.6-9.5 33.8 4.1 45.1s33.8 9.5 45.1-4.1L192 306 327.4 468.5c11.3 13.6 31.5 15.4 45.1 4.1s15.4-31.5 4.1-45.1L233.7 256 376.6 84.5z"/></svg>`;

function sunIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M288-32c8.4 0 16.3 4.4 20.6 11.7L364.1 72.3 468.9 46c8.2-2 16.9 .4 22.8 6.3S500 67 498 75.1l-26.3 104.7 92.7 55.5c7.2 4.3 11.7 12.2 11.7 20.6s-4.4 16.3-11.7 20.6L471.7 332.1 498 436.8c2 8.2-.4 16.9-6.3 22.8S477 468 468.9 466l-104.7-26.3-55.5 92.7c-4.3 7.2-12.2 11.7-20.6 11.7s-16.3-4.4-20.6-11.7L211.9 439.7 107.2 466c-8.2 2-16.8-.4-22.8-6.3S76 445 78 436.8l26.2-104.7-92.6-55.5C4.4 272.2 0 264.4 0 256s4.4-16.3 11.7-20.6L104.3 179.9 78 75.1c-2-8.2 .3-16.8 6.3-22.8S99 44 107.2 46l104.7 26.2 55.5-92.6 1.8-2.6c4.5-5.7 11.4-9.1 18.8-9.1zm0 144a144 144 0 1 0 0 288 144 144 0 1 0 0-288zm0 240a96 96 0 1 1 0-192 96 96 0 1 1 0 192z"/></svg>`;
}

function moonIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M256 0C114.6 0 0 114.6 0 256S114.6 512 256 512c68.8 0 131.3-27.2 177.3-71.4 7.3-7 9.4-17.9 5.3-27.1s-13.7-14.9-23.8-14.1c-4.9 .4-9.8 .6-14.8 .6-101.6 0-184-82.4-184-184 0-72.1 41.5-134.6 102.1-164.8 9.1-4.5 14.3-14.3 13.1-24.4S322.6 8.5 312.7 6.3C294.4 2.2 275.4 0 256 0z"/></svg>`;
}

function themeIcon() {
  return document.body.classList.contains('light-palette') ? moonIcon() : sunIcon();
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function render() {
  const app = document.getElementById('app');
  if (state.status === 'idle') {
    app.innerHTML = renderHome();
  } else {
    app.innerHTML = renderPlay();
  }
  attachEvents();
}

// ─── Home Screen ─────────────────────────────────────────────────────────────

function renderHome() {
  const isHvc = state.mode === 'hvc';
  const hasSaved = (() => {
    try {
      const raw = localStorage.getItem('reversi_state');
      if (!raw) return false;
      return JSON.parse(raw).status === 'playing';
    } catch (_) { return false; }
  })();

  return `
    <div class="home-screen">
      <div class="home-bg-discs" aria-hidden="true"></div>
      <div class="home-card">
        <header class="home-header">
          <div class="header-buttons">
            <button class="icon-btn" id="help-btn" aria-label="Help">${ICON_QUESTION}</button>
            <button class="icon-btn" id="theme-btn" aria-label="Toggle theme">${themeIcon()}</button>
            <a class="icon-btn" href="https://www.freecodecamp.org/donate" target="_blank" rel="noopener" aria-label="Donate">${ICON_HEART}</a>
          </div>
        </header>

        <div class="home-title-section">
          <h1 class="game-title">Reversi</h1>
          <p class="game-subtitle">MOST DISCS WINS</p>
        </div>

        <div class="mode-tabs">
          <button class="tab-btn ${state.mode === 'hvc' ? 'active' : ''}" data-mode="hvc">vs Computer</button>
          <button class="tab-btn ${state.mode === 'hvh' ? 'active' : ''}" data-mode="hvh">2 Players</button>
        </div>

        ${isHvc ? `
          <div class="wins-display">
            <span class="wins-label">WINS</span>
            <div class="wins-rows">
              <div class="wins-row"><span class="wins-row-label">Normal</span><span class="wins-num">${state.wins.normal}</span></div>
              <div class="wins-row"><span class="wins-row-label">Hard</span><span class="wins-num">${state.wins.hard}</span></div>
            </div>
          </div>

          <div class="option-row">
            <div class="pill-toggle">
              <button class="pill-btn ${state.playerColor === 1 ? 'active' : ''}" data-color="1">Dark <span class="goes-first">(goes first)</span></button>
              <button class="pill-btn ${state.playerColor === 2 ? 'active' : ''}" data-color="2">Light</button>
            </div>
            <label class="hard-mode-label">
              <input type="checkbox" class="hard-mode-check" id="hard-mode-check" ${state.difficulty === 'hard' ? 'checked' : ''} />
              <span class="hard-mode-text">Hard mode</span>
            </label>
          </div>
        ` : ''}

        <div class="home-actions">
          <button class="primary-btn" id="new-game-btn">New Game</button>
          ${hasSaved ? `<button class="secondary-btn" id="resume-btn">Resume Game</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ─── Play Screen ─────────────────────────────────────────────────────────────

function renderPlay() {
  const isHvc = state.mode === 'hvc';
  const aiColor = isHvc ? (state.playerColor === 1 ? 2 : 1) : null;
  const isAITurn = isHvc && state.currentPlayer === aiColor;
  const isOver = state.status === 'won' || state.status === 'draw';

  let turnText = '';
  if (!isOver) {
    if (state.aiThinking) {
      turnText = 'Thinking...';
    } else {
      turnText = state.currentPlayer === 1 ? "Dark's turn" : "Light's turn";
    }
  }

  return `
    <div class="home-bg-discs" aria-hidden="true"></div>
    <div class="play-screen">
      <div class="game-container">
        <header class="header">
          <button class="icon-btn" id="close-btn" aria-label="Close">${ICON_X}</button>
          <div class="header-buttons">
            <button class="icon-btn" id="help-btn" aria-label="Help">${ICON_QUESTION}</button>
            <button class="icon-btn" id="theme-btn" aria-label="Toggle theme">${themeIcon()}</button>
            <a class="icon-btn" href="https://www.freecodecamp.org/donate" target="_blank" rel="noopener" aria-label="Donate">${ICON_HEART}</a>
          </div>
        </header>
        <div class="game-body">
          <div class="score-bar">
            <div class="score-item">
              <span class="disc-icon dark-disc"></span>
              <span class="score-label">Dark:</span>
              <span class="score-num">${state.scores[1]}</span>
            </div>
            <div class="score-item">
              <span class="disc-icon light-disc"></span>
              <span class="score-label">Light:</span>
              <span class="score-num">${state.scores[2]}</span>
            </div>
          </div>
          <div class="turn-label ${state.aiThinking ? 'thinking' : ''}">${turnText}</div>
          <div class="board-wrapper">
            ${renderBoard(isHvc, aiColor)}
            ${isOver ? renderGameOver() : ''}
          </div>
          <div id="pass-message" class="pass-message" aria-live="polite">${state.passMessage || ''}</div>
        </div>
      </div>
    </div>
  `;
}

function renderBoard(isHvc, aiColor) {
  const validSet = new Set(state.validMoves);
  const showDots = !state.aiThinking && (!isHvc || state.currentPlayer === state.playerColor);
  let html = '<div class="board" role="grid">';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const key = `${r},${c}`;
      const val = state.board[r][c];
      const isValid = validSet.has(key);
      const isLast = state.lastMove && state.lastMove[0] === r && state.lastMove[1] === c;
      const isFlipped = state.flippedCells.some(([fr, fc]) => fr === r && fc === c);
      const isEmpty = val === 0;

      const discClass = val === 1 ? 'dark' : val === 2 ? 'light' : '';
      let displayClass = discClass;
      let flipClass = '';
      if (isFlipped) {
        displayClass = val === 1 ? 'light' : 'dark'; // start from old color
        flipClass = val === 1 ? 'flip-to-dark' : 'flip-to-light';
      }

      const isDisabled = !isValid || state.aiThinking;
      const cellLabel = `Row ${r + 1} Column ${c + 1}, ${val === 0 ? 'empty' : val === 1 ? 'dark disc' : 'light disc'}`;

      html += `<div
        class="cell${isValid ? ' valid' : ''}"
        role="button"
        tabindex="${isValid && !isDisabled ? '0' : '-1'}"
        aria-label="${cellLabel}"
        aria-disabled="${isDisabled ? 'true' : 'false'}"
        data-row="${r}" data-col="${c}"
      >`;

      if (val !== 0) {
        html += `<div class="disc ${displayClass}${flipClass ? ' ' + flipClass : ''}"></div>`;
      } else if (isValid && showDots) {
        html += `<div class="valid-dot"></div>`;
      }
      if (isLast) {
        html += `<div class="last-move-ring"></div>`;
      }
      html += `</div>`;
    }
  }
  html += '</div>';
  return html;
}

function renderGameOver() {
  const isWon = state.status === 'won';
  const isDraw = state.status === 'draw';
  let resultText = '';
  if (isDraw) resultText = 'Draw!';
  else resultText = state.winner === 1 ? 'Dark wins!' : 'Light wins!';

  return `
    <div class="game-over-overlay">
      <div class="game-over-card">
        <div class="game-over-result ${isDraw ? 'draw' : state.winner === 1 ? 'dark-wins' : 'light-wins'}">${resultText}</div>
        <div class="game-over-counts">Dark ${state.scores[1]} - Light ${state.scores[2]}</div>
        <div class="game-over-actions">
          <button class="primary-btn" id="play-again-btn">Play Again</button>
          <button class="secondary-btn" id="home-btn">Home</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Help Modal ──────────────────────────────────────────────────────────────

function renderHelpModal() {
  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Help">
        <button class="modal-close icon-btn" id="modal-close-btn">${ICON_X}</button>
        <h2 class="modal-title">How to Play</h2>
        <div class="modal-content">
          <h3>Objective</h3>
          <p>Have more discs of your color on the board than your opponent when neither player can move.</p>

          <h3>Rules</h3>
          <ul>
            <li>Dark goes first; players alternate placing one disc per turn.</li>
            <li>A disc can only be placed where it flips at least one opponent disc.</li>
            <li>All opponent discs sandwiched between your new disc and an existing friendly disc (in any direction) are flipped simultaneously.</li>
            <li>If you have no valid move, your turn is skipped automatically.</li>
            <li>Game ends when neither player can move or all 64 squares are filled.</li>
          </ul>

          <h3>Strategy</h3>
          <ul>
            <li>Corners are permanent once captured; anchor your edge control around them.</li>
            <li>Avoid X-squares (diagonally adjacent to corners) - giving them away hands your opponent the corner.</li>
            <li>Avoid C-squares (edge squares adjacent to corners) for the same reason.</li>
            <li>Prioritize mobility (more valid moves than opponent) over raw disc count early in the game.</li>
            <li>Fewer discs mid-game is often an advantage - it limits your opponent's flipping options.</li>
          </ul>

          <h3>Common mistakes</h3>
          <ul>
            <li>Taking X-squares to gain a few discs - your opponent captures the corner next turn.</li>
            <li>Chasing disc count in the first 30 moves.</li>
            <li>Ignoring opponent mobility - many opponent moves means they control the board.</li>
          </ul>

          <h3>Tips</h3>
          <ul>
            <li>Count your opponent's valid moves after each placement - fewer is better.</li>
            <li>The first player to capture a corner almost always wins.</li>
            <li>Edges are strong once fully filled.</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────

let confirmCallback = null;

function showConfirmModal(cb, opts = {}) {
  confirmCallback = cb;
  const existing = document.getElementById('confirm-backdrop');
  if (existing) existing.remove();
  const title = opts.title || 'Start a new game?';
  const body = opts.body || 'Your current game will be lost.';
  const okLabel = opts.okLabel || 'New Game';
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="modal-backdrop" id="confirm-backdrop">
      <div class="modal-card" role="dialog" aria-modal="true">
        <h2 class="modal-title">${title}</h2>
        <p class="modal-body-text">${body}</p>
        <div class="modal-actions">
          <button class="secondary-btn" id="confirm-cancel">Cancel</button>
          <button class="primary-btn" id="confirm-ok">${okLabel}</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(div.firstElementChild);
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-backdrop').remove();
  });
  document.getElementById('confirm-ok').addEventListener('click', () => {
    document.getElementById('confirm-backdrop').remove();
    if (confirmCallback) confirmCallback();
  });
  document.getElementById('confirm-backdrop').addEventListener('click', e => {
    if (e.target.id === 'confirm-backdrop') document.getElementById('confirm-backdrop').remove();
  });
}

// ─── Event Wiring ────────────────────────────────────────────────────────────

function attachEvents() {
  // Board cells
  document.querySelectorAll('.cell').forEach(cell => {
    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);
    cell.addEventListener('click', () => handleCellClick(row, col));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCellClick(row, col);
      }
    });
  });

  // Help button
  document.getElementById('help-btn')?.addEventListener('click', () => {
    document.body.insertAdjacentHTML('beforeend', renderHelpModal());
    wireHelpModal();
  });

  // Theme button
  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);

  // Home screen
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      localStorage.setItem('reversi_mode', state.mode);
      render();
    });
  });

  document.querySelectorAll('.pill-btn[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.playerColor = parseInt(btn.dataset.color, 10);
      localStorage.setItem('reversi_color', state.playerColor);
      render();
    });
  });

  document.getElementById('hard-mode-check')?.addEventListener('change', e => {
    state.difficulty = e.target.checked ? 'hard' : 'normal';
    localStorage.setItem('reversi_difficulty', state.difficulty);
  });

  document.getElementById('new-game-btn')?.addEventListener('click', resetGame);
  document.getElementById('resume-btn')?.addEventListener('click', () => {
    try {
      const saved = JSON.parse(localStorage.getItem('reversi_state'));
      if (saved && saved.status === 'playing') {
        Object.assign(state, saved);
        state.flippedCells = [];
        state.aiThinking = false;
        state.passMessage = null;
        state.validMoves = getValidMoves(state.board, state.currentPlayer).map(([r, c]) => `${r},${c}`);
        render();
      }
    } catch (_) {}
  });

  // Play screen
  document.getElementById('close-btn')?.addEventListener('click', () => {
    if (state.status === 'playing') {
      showConfirmModal(() => {
        saveState();
        state.status = 'idle';
        render();
      }, {
        title: 'Quit Game',
        body: 'Return to the main menu? You can resume your game from there.',
        okLabel: 'Quit',
      });
    } else {
      state.status = 'idle';
      render();
    }
  });

  document.getElementById('play-again-btn')?.addEventListener('click', startGame);
  document.getElementById('home-btn')?.addEventListener('click', () => {
    state.status = 'idle';
    render();
  });
}

function wireHelpModal() {
  const backdrop = document.getElementById('modal-backdrop');
  document.getElementById('modal-close-btn')?.addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', onEsc); }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

applyTheme(localStorage.getItem('reversi_theme') || 'dark');
loadState();
render();
