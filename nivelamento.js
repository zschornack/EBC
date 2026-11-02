// PÁGINA DO TESTE DE NIVELAMENTO (/nivelamento)
// Monta as perguntas, guarda o progresso no navegador (se a página recarregar, nada se perde)
// e envia as respostas para o backend (/api/nivelamento), que corrige e manda o resultado para a professora.

import { BLOCKS } from './nivelamento-perguntas.js';

const LETTERS = ['a', 'b', 'c', 'd'];
const TOTAL = BLOCKS.reduce((sum, block) => sum + block.questions.length, 0);
const STORAGE_KEY = 'ebc-nivelamento-v1';

const form = document.getElementById('level-form');
const list = document.getElementById('level-questions');
const status = document.getElementById('form-status');
const button = form.querySelector('button[type="submit"]');
const phone = form.querySelector('input[name="phone"]');
const age = form.querySelector('input[name="age"]');
const progress = document.getElementById('level-progress');
const progressText = document.getElementById('level-progress-text');
const progressFill = document.getElementById('level-progress-fill');
const done = document.getElementById('level-done');

const PHONE_ERROR = 'O número de WhatsApp não está certo. Confira o DDD e o número, ex.: (11) 98765-4321.';
const MESSAGES = {
  captcha: 'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo (suas respostas ficam salvas).',
  invalid_phone: PHONE_ERROR,
  invalid_name: 'Confira o nome do responsável.',
  invalid_student_name: 'Confira o nome do aluno.',
  invalid_age: 'Confira a idade do aluno.',
};
const GENERIC_ERROR = 'Não foi possível enviar agora. Tente novamente em alguns instantes (suas respostas ficam salvas).';


/* ---------- 1. monta as perguntas ---------- */

let number = 0;
list.innerHTML = BLOCKS.map((block, b) => {
  const questions = block.questions.map((question) => {
    number += 1;
    const options = question.options.map((text, o) => `
          <label class="level-option">
            <input type="radio" name="q${number}" value="${LETTERS[o]}">
            <span class="level-letter">${LETTERS[o]}</span>
            <span class="level-option-text" lang="en">${escapeHtml(text)}</span>
          </label>`).join('');
    return `
        <fieldset class="level-question" id="q${number}">
          <legend><span class="level-num">${number}</span><span lang="en">${escapeHtml(question.q)}</span></legend>
          <div class="level-options">${options}</div>
        </fieldset>`;
  }).join('');
  return `
      <section class="level-card level-block" aria-labelledby="part-${b + 1}">
        <p class="level-card-title" id="part-${b + 1}">Parte ${b + 1} <span>de ${BLOCKS.length}</span></p>
        ${questions}
      </section>`;
}).join('');

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function answers() {
  return Array.from({ length: TOTAL }, (_, i) => {
    const checked = form.querySelector(`input[name="q${i + 1}"]:checked`);
    return checked ? checked.value : '';
  });
}


/* ---------- 2. progresso (contador + salvar no navegador) ---------- */

let startedAt = null;

function updateProgress() {
  const answered = answers().filter(Boolean).length;
  progressText.textContent = `${answered} de ${TOTAL}`;
  progressFill.style.width = `${(answered / TOTAL) * 100}%`;
}

function save() {
  try {
    const fields = {};
    ['studentName', 'age', 'name', 'phone'].forEach((field) => { fields[field] = form.elements[field].value; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ fields, answers: answers(), startedAt }));
  } catch (e) { /* navegador sem armazenamento: segue sem salvar */ }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return;
    Object.entries(saved.fields || {}).forEach(([field, value]) => { if (form.elements[field]) form.elements[field].value = value; });
    (saved.answers || []).forEach((letter, i) => {
      const input = letter && form.querySelector(`input[name="q${i + 1}"][value="${letter}"]`);
      if (input) input.checked = true;
    });
    startedAt = saved.startedAt || null;
  } catch (e) { /* dados antigos ou inválidos: ignora */ }
}

function forget() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

restore();
updateProgress();

form.addEventListener('change', (event) => {
  if (event.target.type === 'radio') {
    if (!startedAt) startedAt = Date.now();
    event.target.closest('.level-question').classList.remove('is-missing');
    resetConfirm();
  }
  updateProgress();
  save();
});
form.addEventListener('input', save);

// o contador só aparece depois que a pessoa chega nas perguntas
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.target === list) progress.classList.toggle('is-visible', entry.isIntersecting);
  });
}, { rootMargin: '0px 0px -40% 0px' });
observer.observe(list);


/* ---------- 3. campos do aluno ---------- */

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


/* ---------- 4. anti-robô (Turnstile) ---------- */

const siteKey = (form.dataset.turnstileSitekey || '').trim();
let widgetId = null;
if (siteKey) {
  window.onTurnstileLoad = () => {
    widgetId = window.turnstile.render('#turnstile-box', { sitekey: siteKey, language: 'pt-br', size: 'flexible' });
  };
  const ts = document.createElement('script');
  ts.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
  ts.async = true;
  document.head.appendChild(ts);
}
function resetTurnstile() {
  if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
}


/* ---------- 5. envio ---------- */

const buttonText = button.textContent;
let confirmedBlanks = false;

function showStatus(message, type) {
  status.textContent = message;
  status.className = `form-status ${type || ''}`;
}

function resetConfirm() {
  if (!confirmedBlanks) return;
  confirmedBlanks = false;
  button.textContent = buttonText;
  showStatus('');
}

function goTo(element) {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const focusable = element.matches('input') ? element : element.querySelector('input');
  if (focusable) focusable.focus({ preventScroll: true });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  // 1. dados do aluno
  const required = ['studentName', 'age', 'name', 'phone'].map((field) => form.elements[field]);
  const empty = required.find((input) => input.value.trim() === '');
  required.forEach((input) => markInvalid(input, input.value.trim() === ''));
  if (empty) {
    showStatus('Preencha os dados do aluno lá em cima antes de enviar.', 'error');
    goTo(empty);
    return;
  }
  if (Number(age.value) < 5) {
    markInvalid(age, true);
    showStatus(MESSAGES.invalid_age, 'error');
    goTo(age);
    return;
  }
  if (!phoneIsValid(phone.value)) {
    markInvalid(phone, true);
    showStatus(PHONE_ERROR, 'error');
    goTo(phone);
    return;
  }

  // 2. perguntas em branco: avisa uma vez; no segundo clique envia assim mesmo
  const given = answers();
  const blanks = given.map((letter, i) => (letter ? null : i + 1)).filter(Boolean);
  document.querySelectorAll('.level-question').forEach((fieldset, i) => fieldset.classList.toggle('is-missing', !given[i]));
  if (blanks.length && !confirmedBlanks) {
    confirmedBlanks = true;
    const which = blanks.length > 8 ? `${blanks.slice(0, 8).join(', ')}…` : blanks.join(', ');
    showStatus(`${blanks.length === 1 ? 'Ficou 1 pergunta' : `Ficaram ${blanks.length} perguntas`} em branco (${which}). ` +
      'Se não sabe a resposta, tudo bem: clique de novo para enviar assim mesmo.', 'error');
    button.textContent = 'Enviar mesmo assim';
    return;
  }

  button.disabled = true;
  button.textContent = 'Enviando…';
  showStatus('');

  const data = Object.fromEntries(new FormData(form));
  Object.keys(data).forEach((key) => { if (/^q\d+$/.test(key)) delete data[key]; });
  data.answers = given;
  data.minutes = startedAt ? Math.round((Date.now() - startedAt) / 60000) : null;

  try {
    const response = await fetch('/api/nivelamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const reply = await response.json().catch(() => ({}));
      const fieldName = { invalid_phone: 'phone', invalid_age: 'age', invalid_name: 'name', invalid_student_name: 'studentName' }[reply.error];
      if (fieldName) { markInvalid(form.elements[fieldName], true); goTo(form.elements[fieldName]); }
      showStatus(MESSAGES[reply.error] || GENERIC_ERROR, 'error');
      resetTurnstile();
      return;
    }

    forget();
    form.hidden = true;
    progress.remove();
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    done.focus({ preventScroll: true });
  } catch (error) {
    showStatus('Não foi possível enviar agora. Verifique sua conexão e tente novamente (suas respostas ficam salvas).', 'error');
  } finally {
    button.disabled = false;
    if (!form.hidden) button.textContent = confirmedBlanks ? 'Enviar mesmo assim' : buttonText;
  }
});
