const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const NUM_CHOICES = 4;          // how many letters to show each round
const NEXT_ROUND_DELAY = 1900;  // ms to wait after a correct answer (lets the wiggle finish)
const FADE_TIME = 2000;         // ms for the fade to black (keep in sync with style.css)

const startScreen = document.getElementById("start-screen");
const startBtn = document.getElementById("start");
const goAllDoneBtn = document.getElementById("go-all-done");
const timeOptions = document.querySelectorAll(".time-option");
const game = document.getElementById("game");
const choicesEl = document.getElementById("choices");
const replayBtn = document.getElementById("replay");
const caterpillar = document.getElementById("caterpillar");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const messageEl = document.getElementById("message");
const allDoneEl = document.getElementById("all-done");
const finalScoreEl = document.getElementById("final-score");
const backBtn = document.getElementById("back");

choicesEl.style.setProperty("--n", NUM_CHOICES); // lets the CSS size the letters to fit one row

/* ---------- Audio ----------
   One shared <audio> player is used for every sound. Phones (especially iPhones)
   only allow sound that starts from a tap, but once a player has been started by
   a tap it can be reused freely afterwards - e.g. after a delay or when the timer ends. */

const ALL_DONE = "all_done";
const player = new Audio();
player.preload = "auto";
let currentSound = null;
let unlocking = false;

// Warm the browser cache so clips start quickly
[...LETTERS, ALL_DONE].forEach(name => {
  const a = new Audio(`audio/${name}.mp3`);
  a.preload = "auto";
});

function playSound(name) {
  unlocking = false;
  player.muted = false;
  if (currentSound !== name) {
    player.src = `audio/${name}.mp3`;
    currentSound = name;
  } else {
    player.pause();
    player.currentTime = 0;
  }
  return player.play().catch(() => {});
}

function stopAllAudio() {
  unlocking = false;
  player.pause();
}

// Call from inside a tap handler when the sound itself will play later.
function unlockAudio() {
  if (!player.paused) return;
  unlocking = true;
  player.muted = true;
  if (currentSound === null) {
    player.src = `audio/${ALL_DONE}.mp3`;
    currentSound = ALL_DONE;
  }
  player.play().then(() => {
    if (unlocking) { player.pause(); player.currentTime = 0; }
    player.muted = false;
    unlocking = false;
  }).catch(() => { player.muted = false; unlocking = false; });
}

let target = null;      // letter that was said this round
let lastTarget = null;  // avoid saying the same letter twice in a row
let locked = false;     // true while waiting for the next round / after time is up
let score = 0;
let minutes = 3;        // selected on the start screen
let endTime = 0;
let timerId = null;
let pending = [];       // setTimeout ids to cancel when the game ends

function later(fn, ms) {
  pending.push(setTimeout(fn, ms));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Timer ---------- */

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  endTime = Date.now() + minutes * 60 * 1000;
  tick();
  timerId = setInterval(tick, 250);
}

function tick() {
  const left = endTime - Date.now();
  timeEl.textContent = formatTime(left);
  timeEl.classList.toggle("low", left <= 10000);
  if (left <= 0) finishGame();
}

/* ---------- Game ---------- */

// playNow = true when called straight from a tap (the Start button), so the
// first sound starts inside the tap - required for audio on iPhones.
function newRound(playNow = false) {
  locked = false;
  messageEl.textContent = "Listen, then tap the letter you hear";

  const pool = LETTERS.filter(l => l !== lastTarget);
  target = pool[Math.floor(Math.random() * pool.length)];
  lastTarget = target;

  const others = shuffle(LETTERS.filter(l => l !== target)).slice(0, NUM_CHOICES - 1);
  const options = shuffle([target, ...others]);

  choicesEl.innerHTML = "";
  options.forEach(l => {
    const btn = document.createElement("button");
    btn.className = "letter";
    btn.textContent = l.toUpperCase();
    btn.dataset.letter = l;
    btn.onclick = () => choose(l, btn);
    choicesEl.appendChild(btn);
  });

  if (playNow) playSound(target);
  else later(() => playSound(target), 400);
}

function choose(letter, btn) {
  if (locked || btn.disabled) return;

  if (letter === target) {
    locked = true;
    btn.classList.add("correct");
    choicesEl.querySelectorAll(".letter").forEach(b => { if (b !== btn) b.disabled = true; });
    score++;
    scoreEl.textContent = score;
    messageEl.textContent = "Well done!";
    playSound(target);
    wiggle();
    later(newRound, NEXT_ROUND_DELAY);
  } else {
    btn.classList.add("wrong");
    btn.disabled = true;
    messageEl.textContent = "Not quite - try again!";
    later(() => playSound(target), 500);
  }
}

function wiggle() {
  caterpillar.classList.remove("wiggle");
  void caterpillar.offsetWidth; // restart the animation if it's already running
  caterpillar.classList.add("wiggle");
  later(() => caterpillar.classList.remove("wiggle"), NEXT_ROUND_DELAY - 100);
}

function startGame() {
  score = 0;
  scoreEl.textContent = "0";
  lastTarget = null;
  startScreen.hidden = true;
  game.hidden = false;
  newRound(true);
  startTimer();
}

function finishGame() {
  clearInterval(timerId);
  timerId = null;
  pending.forEach(clearTimeout);
  pending = [];
  locked = true;
  stopAllAudio();
  finalScoreEl.textContent = `You found ${score} letter${score === 1 ? "" : "s"}!`;
  showAllDone();
}

/* ---------- All Done screen ---------- */

function showAllDone() {
  allDoneEl.classList.add("show");          // fades to black (CSS transition)
  later(() => playSound(ALL_DONE), FADE_TIME); // speak once the screen is black
}

function backToStart() {
  pending.forEach(clearTimeout);
  pending = [];
  stopAllAudio();
  allDoneEl.classList.remove("show");
  finalScoreEl.textContent = "";
  game.hidden = true;
  startScreen.hidden = false;
  caterpillar.classList.remove("wiggle");
  messageEl.textContent = "Listen, then tap the letter you hear";
  target = null;
}

/* ---------- Wiring ---------- */

timeOptions.forEach(btn => {
  btn.onclick = () => {
    timeOptions.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    minutes = Number(btn.dataset.minutes);
    timeEl.textContent = formatTime(minutes * 60 * 1000);
  };
});

startBtn.onclick = startGame;
goAllDoneBtn.onclick = () => {
  unlockAudio(); // the sound plays after the fade, so unlock audio during this tap
  finalScoreEl.textContent = "";
  showAllDone();
};
backBtn.onclick = backToStart;
replayBtn.onclick = () => { if (target && !locked) playSound(target); };

// Keyboard: press a letter key to pick it (only if it's one of the choices)
document.addEventListener("keydown", e => {
  if (game.hidden || locked || e.key.length !== 1) return;
  const btn = choicesEl.querySelector(`[data-letter="${e.key.toLowerCase()}"]`);
  if (btn) choose(btn.dataset.letter, btn);
});
