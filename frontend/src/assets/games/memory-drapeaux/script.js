// 12 pays -> 24 cartes (paires). Images depuis flagcdn.com (codes ISO 3166-1 alpha-2).
const COUNTRIES = [
  { code: 'fr', name: 'France' },
  { code: 'de', name: 'Allemagne' },
  { code: 'it', name: 'Italie' },
  { code: 'es', name: 'Espagne' },
  { code: 'jp', name: 'Japon' },
  { code: 'br', name: 'Brésil' },
  { code: 'ca', name: 'Canada' },
  { code: 'gb', name: 'Royaume-Uni' },
  { code: 'us', name: 'États-Unis' },
  { code: 'ma', name: 'Maroc' },
  { code: 'kr', name: 'Corée du Sud' },
  { code: 'in', name: 'Inde' },
];

const FLAG_URL = code => `https://flagcdn.com/w320/${code}.png`;

const board = document.getElementById('board');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const player1El = document.getElementById('player1');
const player2El = document.getElementById('player2');
const turnIndicator = document.getElementById('turnIndicator');
const restartBtn = document.getElementById('restartBtn');
const winModal = document.getElementById('winModal');
const winText = document.getElementById('winText');
const playAgainBtn = document.getElementById('playAgainBtn');

let currentPlayer = 1;
let scores = { 1: 0, 2: 0 };
let flippedCards = [];
let lockBoard = false;
let matchedCount = 0;

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck() {
  const pairs = COUNTRIES.flatMap(country => [country, country]);
  return shuffle(pairs).map((country, index) => ({ ...country, id: index }));
}

function createCardElement(card) {
  const cardEl = document.createElement('div');
  cardEl.className = 'card';
  cardEl.dataset.id = card.id;
  cardEl.dataset.code = card.code;

  cardEl.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back">🏳️</div>
      <div class="card-face card-front">
        <img src="${FLAG_URL(card.code)}" alt="Drapeau ${card.name}">
      </div>
    </div>
  `;

  cardEl.addEventListener('click', () => onCardClick(cardEl));
  return cardEl;
}

function onCardClick(cardEl) {
  if (lockBoard) return;
  if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;
  if (flippedCards.length === 2) return;

  cardEl.classList.add('flipped');
  flippedCards.push(cardEl);

  if (flippedCards.length === 2) {
    checkMatch();
  }
}

function checkMatch() {
  const [first, second] = flippedCards;
  const isMatch = first.dataset.code === second.dataset.code;

  if (isMatch) {
    lockBoard = true;
    setTimeout(() => {
      first.classList.add('matched');
      second.classList.add('matched');
      flippedCards = [];
      lockBoard = false;
      matchedCount += 2;

      scores[currentPlayer]++;
      updateScores();

      if (matchedCount === COUNTRIES.length * 2) {
        endGame();
      }
      // Le joueur qui trouve une paire rejoue : pas de changement de tour.
    }, 600);
  } else {
    lockBoard = true;
    first.classList.add('shake');
    second.classList.add('shake');
    setTimeout(() => {
      first.classList.remove('flipped', 'shake');
      second.classList.remove('flipped', 'shake');
      flippedCards = [];
      lockBoard = false;
      switchPlayer();
    }, 900);
  }
}

function switchPlayer() {
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateActivePlayer();
}

function updateActivePlayer() {
  player1El.classList.toggle('active', currentPlayer === 1);
  player2El.classList.toggle('active', currentPlayer === 2);
  turnIndicator.textContent = `Au tour de Joueur ${currentPlayer}`;
}

function updateScores() {
  score1El.textContent = scores[1];
  score2El.textContent = scores[2];
}

function endGame() {
  let message;
  if (scores[1] > scores[2]) message = '🏆 Joueur 1 remporte la partie !';
  else if (scores[2] > scores[1]) message = '🏆 Joueur 2 remporte la partie !';
  else message = '🤝 Match nul !';

  winText.textContent = message;
  winModal.classList.remove('hidden');
}

function startGame() {
  currentPlayer = 1;
  scores = { 1: 0, 2: 0 };
  flippedCards = [];
  lockBoard = false;
  matchedCount = 0;

  updateScores();
  updateActivePlayer();
  winModal.classList.add('hidden');

  board.innerHTML = '';
  buildDeck().forEach(card => board.appendChild(createCardElement(card)));
}

restartBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', startGame);

startGame();
