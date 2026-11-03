// PÁGINA DO TESTE DE NIVELAMENTO (/nivelamento)
//
// Como funciona:
//   1. a pessoa preenche os dados do aluno e começa;
//   2. as perguntas aparecem UMA POR VEZ: respondeu, passa para a próxima;
//   3. no fim de cada parte, a página pergunta ao servidor (/api/nivelamento/parte) se o aluno
//      acertou pelo menos 60%. Se sim, segue para a próxima parte. Se não, o teste termina ali;
//   4. no fim, as respostas vão para /api/nivelamento, que corrige e manda o resultado para a professora.
// O progresso fica salvo no navegador: se a página recarregar, o aluno continua de onde parou.

import { BLOCKS } from './nivelamento-perguntas.js';

const LETTERS = ['a', 'b', 'c', 'd'];
const STORAGE_KEY = 'ebc-nivelamento-v2';
const ADVANCE_DELAY = 350; // tempo (ms) mostrando a opção escolhida antes de passar para a próxima

// onde cada parte começa e termina na lista geral de respostas
const RANGES = BLOCKS.reduce((list, block) => {
  const start = list.length ? list[list.length - 1].end : 0;
  return list.concat({ start, end: start + block.questions.length });
}, []);

const $ = (id) => document.getElementById(id);
const screens = {
  start: $('level-start'),
  quiz: $('level-quiz'),
  break: $('level-break'),
  checking: $('level-checking'),
  finish: $('level-finish'),
  done: $('level-done'),
};

const PHONE_ERROR = 'O número de WhatsApp não está certo. Confira o DDD e o número, ex.: (11) 98765-4321.';
const MESSAGES = {
  captcha: 'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo (suas respostas ficam salvas).',
  invalid_phone: PHONE_ERROR,
  invalid_name: 'Confira o nome do responsável.',
  invalid_student_name: 'Confira o nome do aluno.',
  invalid_age: 'Confira a idade do aluno.',
};


/* ---------- estado (o que já foi respondido) ---------- */

let state = {
  stage: 'start',   // start | quiz | checking | break | finish | done
  fields: {},       // dados do aluno
  answers: [],      // uma letra por pergunta respondida ('' = "Não sei")
  block: 0,         // parte atual
  q: 0,             // pergunta atual dentro da parte
  startedAt: null,
  endedAt: null,
};

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* sem armazenamento: segue sem salvar */ }
}
function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.stage && saved.stage !== 'done') state = Object.assign(state, saved);
  } catch (e) { /* dados antigos ou inválidos: ignora */ }
}
function forget() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

function show(stage, focus) {
  state.stage = stage;
  Object.entries(screens).forEach(([name, el]) => { el.hidden = name !== stage; });
  save();
  const el = screens[stage];
  const top = el.getBoundingClientRect().top;
  if (top < 80 || top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (focus !== false && stage !== 'start') el.focus({ preventScroll: true });
}


/* ---------- 1. dados do aluno ---------- */

const startForm = screens.start;
const startStatus = $('start-status');
const phone = startForm.elements.phone;
const age = startForm.elements.age;

const DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
  51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];

function phoneIsValid(value) {
  const d = value.replace(/\D/g, '');
  if (d.length !== 10 && d.length !== 11) return false;
  if (DDDS.indexOf(Number(d.slice(0, 2))) === -1) return false;
  if (d.length === 11) return d[2] === '9';
  return '2345'.indexOf(d[2]) !== -1;
}

function markInvalid(input, invalid) {
  input.classList.toggle('invalid', invalid);
  input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

function showStartError(message, input) {
  startStatus.textContent = message;
  startStatus.className = 'form-status error';
  if (input) { markInvalid(input, true); input.focus(); }
}

// máscara do telefone → (11) 98765-4321
phone.addEventListener('input', () => {
  const d = phone.value.replace(/\D/g, '').slice(0, 11);
  let out = d;
  if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 6) {
    const split = d.length === 11 ? 7 : 6;
    out = `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
  }
  phone.value = out;
  if (phone.classList.contains('invalid') && phoneIsValid(out)) markInvalid(phone, false);
});
age.addEventListener('input', () => { age.value = age.value.replace(/\D/g, '').slice(0, 2); });

startForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const inputs = ['studentName', 'age', 'name', 'phone'].map((field) => startForm.elements[field]);
  inputs.forEach((input) => markInvalid(input, false));
  const empty = inputs.find((input) => input.value.trim() === '');
  if (empty) return showStartError('Preencha todos os campos para começar.', empty);
  if (Number(age.value) < 5) return showStartError(MESSAGES.invalid_age, age);
  if (!phoneIsValid(phone.value)) return showStartError(PHONE_ERROR, phone);

  startStatus.textContent = '';
  inputs.forEach((input) => { state.fields[input.name] = input.value.trim(); });
  state.answers = [];
  state.block = 0;
  state.q = 0;
  state.startedAt = Date.now();
  renderQuestion();
  show('quiz');
});


/* ---------- 2. perguntas, uma por vez ---------- */

const questionBox = $('quiz-question');
const backButton = $('quiz-back');
const skipButton = $('quiz-skip');
let locked = false; // evita dois cliques seguidos na mesma pergunta

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderQuestion() {
  const block = BLOCKS[state.block];
  const question = block.questions[state.q];
  const index = RANGES[state.block].start + state.q;
  const current = state.answers[index];

  $('quiz-part').innerHTML = `Parte ${state.block + 1} <span>de ${BLOCKS.length}</span>`;
  $('quiz-count').textContent = `Pergunta ${state.q + 1} de ${block.questions.length}`;
  $('quiz-fill').style.width = `${(state.q / block.questions.length) * 100}%`;

  questionBox.innerHTML = `
    <p class="quiz-text" id="quiz-text" lang="en">${escapeHtml(question.q)}</p>
    <div class="quiz-options" role="group" aria-labelledby="quiz-text">
      ${question.options.map((text, o) => `
        <button type="button" class="level-option${current === LETTERS[o] ? ' is-selected' : ''}" data-letter="${LETTERS[o]}">
          <span class="level-letter">${LETTERS[o]}</span>
          <span class="level-option-text" lang="en">${escapeHtml(text)}</span>
        </button>`).join('')}
    </div>`;

  questionBox.classList.remove('is-entering');
  void questionBox.offsetWidth; // reinicia a animação de entrada
  questionBox.classList.add('is-entering');

  backButton.disabled = state.q === 0; // só volta dentro da mesma parte
  locked = false;
}

function answer(letter) {
  if (locked) return;
  locked = true;
  state.answers[RANGES[state.block].start + state.q] = letter;
  save();
  setTimeout(next, letter ? ADVANCE_DELAY : 0);
}

function next() {
  if (state.q < BLOCKS[state.block].questions.length - 1) {
    state.q += 1;
    renderQuestion();
    save();
    questionBox.querySelector('.level-option').focus({ preventScroll: true });
  } else {
    checkBlock();
  }
}

questionBox.addEventListener('click', (event) => {
  const option = event.target.closest('.level-option');
  if (!option || locked) return;
  questionBox.querySelectorAll('.level-option').forEach((el) => el.classList.toggle('is-selected', el === option));
  answer(option.dataset.letter);
});

skipButton.addEventListener('click', () => answer(''));

backButton.addEventListener('click', () => {
  if (state.q === 0 || locked) return;
  state.q -= 1;
  renderQuestion();
  save();
});

// atalho no teclado: A, B, C, D escolhem a opção
document.addEventListener('keydown', (event) => {
  if (state.stage !== 'quiz' || event.ctrlKey || event.metaKey || event.altKey) return;
  const option = questionBox.querySelector(`.level-option[data-letter="${event.key.toLowerCase()}"]`);
  if (option) option.click();
});


/* ---------- 3. fim de cada parte: segue ou termina? ---------- */

async function checkBlock() {
  const { start, end } = RANGES[state.block];
  const answers = Array.from({ length: end - start }, (_, i) => state.answers[start + i] || '');
  state.answers = state.answers.slice(0, end);
  $('checking-text').textContent = 'Conferindo suas respostas…';
  $('checking-retry').hidden = true;
  show('checking');

  try {
    const response = await fetch('/api/nivelamento/parte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block: state.block, answers }),
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const result = await response.json();

    if (result.passed && state.block < BLOCKS.length - 1) {
      $('break-eyebrow').textContent = `Parte ${state.block + 1} de ${BLOCKS.length} concluída`;
      state.block += 1;
      state.q = 0;
      show('break');
    } else {
      finishTest();
    }
  } catch (error) {
    $('checking-text').textContent = 'Não conseguimos conferir agora. Verifique sua conexão e tente de novo (suas respostas estão salvas).';
    $('checking-retry').hidden = false;
  }
}

$('checking-retry').addEventListener('click', checkBlock);

$('break-continue').addEventListener('click', () => {
  renderQuestion();
  show('quiz');
});


/* ---------- 4. enviar o resultado ---------- */

const finishForm = screens.finish;
const finishStatus = $('form-status');
const finishButton = finishForm.querySelector('button[type="submit"]');
const turnstileBox = $('turnstile-box');
let widgetId = null;

function finishTest() {
  if (!state.endedAt) state.endedAt = Date.now();
  show('finish');
  renderTurnstile();
}

// anti-robô (Turnstile): só aparece na hora de enviar, para a verificação não expirar durante o teste
function renderTurnstile() {
  const siteKey = (turnstileBox.dataset.sitekey || '').trim();
  if (!siteKey || widgetId !== null) return;
  const render = () => {
    widgetId = window.turnstile.render('#turnstile-box', { sitekey: siteKey, language: 'pt-br', size: 'flexible' });
  };
  if (window.turnstile) return render();
  window.onTurnstileLoad = render;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
  script.async = true;
  document.head.appendChild(script);
}
function resetTurnstile() {
  if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
}

finishForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  finishButton.disabled = true;
  finishButton.textContent = 'Enviando…';
  finishStatus.textContent = '';

  const data = Object.assign({}, state.fields, Object.fromEntries(new FormData(finishForm)));
  data.answers = state.answers.map((letter) => letter || '');
  data.minutes = state.startedAt ? Math.round(((state.endedAt || Date.now()) - state.startedAt) / 60000) : null;

  try {
    const response = await fetch('/api/nivelamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const reply = await response.json().catch(() => ({}));
      finishStatus.textContent = MESSAGES[reply.error] || 'Não foi possível enviar agora. Tente novamente em alguns instantes (suas respostas estão salvas).';
      finishStatus.className = 'form-status error';
      resetTurnstile();
      return;
    }
    show('done');
    forget(); // apaga o progresso salvo (depois do show, que salva o estado)
  } catch (error) {
    finishStatus.textContent = 'Não foi possível enviar agora. Verifique sua conexão e tente novamente (suas respostas estão salvas).';
    finishStatus.className = 'form-status error';
  } finally {
    finishButton.disabled = false;
    finishButton.textContent = 'Enviar resultado';
  }
});


/* ---------- ao abrir a página: continua de onde parou ---------- */

restore();
Object.entries(state.fields).forEach(([field, value]) => { if (startForm.elements[field]) startForm.elements[field].value = value; });

if (state.stage === 'quiz') { renderQuestion(); show('quiz', false); }
else if (state.stage === 'break') show('break', false);
else if (state.stage === 'checking') checkBlock();
else if (state.stage === 'finish') finishTest();
