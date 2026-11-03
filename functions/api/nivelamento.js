// BACKEND DO TESTE DE NIVELAMENTO (Cloudflare)
// Recebe as respostas da página /nivelamento, CORRIGE AQUI NO SERVIDOR (o gabarito nunca vai para o navegador),
// guarda o resultado na aba "Nivelamento" da planilha e manda para a cliente um e-mail com acertos e erros.
//
// Dois endereços (o worker/index.js entrega os dois para cá):
//   /api/nivelamento/parte  → ao fim de cada parte, responde só "passou" ou "não passou"
//                             (a página usa isso para seguir ou encerrar o teste)
//   /api/nivelamento        → no fim, recebe tudo, corrige, salva e manda o e-mail
//
// Mesma ordem de segurança da lista de espera: robô? → valida → planilha → e-mail.
// Só dá erro para o aluno se a planilha E o e-mail falharem ao mesmo tempo.

import {
  clean, escapeHtml, normalizePhone, formatPhone, nowBrasilia, whatsappLink, json, readBody,
  verifyHuman, saveToSheet, sendEmail, emailRow, sheetWarning, whatsappButton, emailFrame,
} from './_lib.js';
import { ANSWERS, PASS_RATE, LEVEL_NAMES, BELOW_A1 } from './_gabarito.js';
import { BLOCKS } from '../../nivelamento-perguntas.js';

const LETTERS = ['a', 'b', 'c', 'd'];

// todas as perguntas numa lista só, cada uma sabendo seu número e seu bloco
const QUESTIONS = BLOCKS.flatMap((block, b) => block.questions.map((question) => ({ ...question, block: b })))
  .map((question, i) => ({ ...question, number: i + 1 }));

if (ANSWERS.length !== QUESTIONS.length) {
  console.error(`GABARITO DESALINHADO: ${ANSWERS.length} respostas para ${QUESTIONS.length} perguntas.`);
}


/* =========================================================
   CORREÇÃO
   O teste para na primeira parte (bloco) com menos de 60% de acertos.
   Por isso o navegador só manda as respostas até onde o aluno chegou,
   e as partes seguintes ficam como "não realizadas".
   ========================================================= */

// em que posição da lista cada bloco começa e termina
const RANGES = BLOCKS.reduce((list, block) => {
  const start = list.length ? list[list.length - 1].end : 0;
  return list.concat({ start, end: start + block.questions.length });
}, []);

function normalizeAnswer(raw, question) {
  const letter = String(raw ?? '').trim().toLowerCase();
  const index = LETTERS.indexOf(letter);
  return index >= 0 && index < question.options.length ? letter : '';
}

function gradeItem(question, raw) {
  const given = normalizeAnswer(raw, question);
  const accepted = [].concat(ANSWERS[question.number - 1] ?? []);
  return { ...question, given, accepted, correct: given !== '' && accepted.includes(given) };
}

const blockPassed = (correct, total) => correct >= Math.ceil(total * PASS_RATE);

function grade(rawAnswers) {
  const blocks = [];
  let items = [];
  let level = BELOW_A1;
  let open = true; // o aluno ainda pode ter feito este bloco?

  BLOCKS.forEach((block, b) => {
    const { start, end } = RANGES[b];
    const taken = open && rawAnswers.length >= end;
    if (!taken) {
      open = false;
      blocks.push({ level: block.level, taken: false, correct: 0, total: end - start, passed: false });
      return;
    }
    const mine = QUESTIONS.slice(start, end).map((question, i) => gradeItem(question, rawAnswers[start + i]));
    const correct = mine.filter((item) => item.correct).length;
    const passed = blockPassed(correct, mine.length);
    items = items.concat(mine);
    blocks.push({ level: block.level, taken: true, correct, total: mine.length, passed });
    if (passed) level = LEVEL_NAMES[block.level] || block.level;
    else open = false; // reprovou: o teste parou aqui
  });

  const takenCount = blocks.filter((block) => block.taken).length;
  const correct = items.filter((item) => item.correct).length;
  const finished = takenCount === BLOCKS.length && blocks[BLOCKS.length - 1].passed;
  const stopNote = takenCount === 0 ? 'não respondeu nenhuma parte'
    : takenCount === BLOCKS.length ? `fez as ${BLOCKS.length} partes`
    : `parou na parte ${takenCount} de ${BLOCKS.length}`;
  return { items, blocks, correct, total: items.length, level, takenCount, finished, stopNote };
}

const optionText = (item, letter) => `${letter}) ${item.options[LETTERS.indexOf(letter)]}`;


/* =========================================================
   TEMPLATE DO E-MAIL
   ========================================================= */

function emailHtml(result, test, savedToSheet) {
  const percent = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  const pass = Math.round(PASS_RATE * 100);

  const blockRows = result.blocks.map((block, b) => {
    const cell = 'padding:8px 0;border-bottom:1px solid #e6e0d2;font-size:14px;';
    if (!block.taken) {
      return `
          <tr>
            <td style="${cell}color:#9aa5b1;">Parte ${b + 1} · ${block.level}</td>
            <td style="${cell}color:#9aa5b1;text-align:right;">—</td>
            <td style="${cell}padding-left:12px;font-size:13px;text-align:right;color:#9aa5b1;">não chegou nesta parte</td>
          </tr>`;
    }
    return `
          <tr>
            <td style="${cell}color:#103c65;">Parte ${b + 1} · ${block.level}</td>
            <td style="${cell}color:#103c65;font-weight:700;text-align:right;">${block.correct}/${block.total}</td>
            <td style="${cell}padding-left:12px;font-size:13px;text-align:right;color:${block.passed ? '#1e7b3c' : '#ad2525'};">${block.passed ? 'aprovado' : `abaixo de ${pass}% · teste encerrado`}</td>
          </tr>`;
  }).join('');

  const details = result.blocks.filter((block) => block.taken).map((block, b) => {
    const rows = result.items.filter((item) => item.block === b).map((item) => {
      const mark = item.correct ? '✅' : item.given ? '❌' : '⬜';
      const answer = item.given
        ? `<span style="color:${item.correct ? '#1e7b3c' : '#ad2525'};">${escapeHtml(optionText(item, item.given))}</span>`
        : '<span style="color:#9aa5b1;">em branco</span>';
      const right = item.correct ? '' :
        `<br><span style="color:#6b7a8c;">Correta: ${item.accepted.map((letter) => escapeHtml(optionText(item, letter))).join(' ou ')}</span>`;
      return `
          <tr>
            <td style="padding:10px 8px 10px 0;border-bottom:1px solid #f0ebe0;vertical-align:top;font-size:14px;width:26px;">${mark}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0ebe0;font-size:13px;line-height:1.5;color:#103c65;">
              <strong>${item.number}.</strong> ${escapeHtml(item.q)}<br>${answer}${right}
            </td>
          </tr>`;
    }).join('');
    return `
        <p style="margin:28px 0 4px;color:#103c65;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Parte ${b + 1} · ${block.level} — ${block.correct}/${block.total}</p>
        <table style="width:100%;border-collapse:collapse;">${rows}
        </table>`;
  }).join('');

  return emailFrame({
    eyebrow: 'English Book Club · Teste de nivelamento',
    title: `${escapeHtml(test.studentName)}: ${escapeHtml(result.level)}`,
    date: test.date,
    width: 640,
    body: `${sheetWarning(savedToSheet)}
        <table style="width:100%;border-collapse:collapse;">
          ${emailRow('Aluno', escapeHtml(test.studentName))}
          ${emailRow('Idade', `${escapeHtml(test.age)} anos`)}
          ${emailRow('Responsável', escapeHtml(test.name))}
          ${emailRow('Telefone', escapeHtml(test.phone))}
          ${emailRow('Nível estimado', escapeHtml(result.level))}
          ${emailRow('Até onde foi', escapeHtml(result.stopNote))}
          ${emailRow('Acertos', `${result.correct} de ${result.total} respondidas (${percent}%)`)}
          ${test.minutes === null ? '' : emailRow('Tempo de prova', `${test.minutes} min`)}
        </table>

        <p style="margin:28px 0 4px;color:#103c65;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Resultado por parte</p>
        <table style="width:100%;border-collapse:collapse;">${blockRows}
        </table>
        <p style="margin:10px 0 0;color:#9aa5b1;font-size:12px;">O teste encerra sozinho na primeira parte com menos de ${pass}% de acertos, então as partes seguintes não aparecem. O nível estimado é a última parte aprovada. É uma referência: a avaliação final é da professora.</p>
        ${whatsappButton(test.whatsapp)}
        ${details}`,
  });
}

// versão em texto simples, para programas de e-mail que não mostram HTML
function emailText(result, test, savedToSheet) {
  const lines = result.items.map((item) =>
    `${item.number}. ${item.correct ? 'CERTO' : item.given ? 'ERRADO' : 'EM BRANCO'}` +
    (item.given ? ` — marcou ${item.given}` : '') +
    (item.correct ? '' : ` (correta: ${item.accepted.join(' ou ')})`));
  return `Teste de nivelamento\n\n` +
    (savedToSheet ? '' : 'ATENÇÃO: este resultado NÃO foi salvo na planilha. Copie manualmente.\n\n') +
    `Aluno: ${test.studentName}\nIdade: ${test.age} anos\nResponsável: ${test.name}\nTelefone: ${test.phone}\n\n` +
    `Nível estimado: ${result.level}\nAté onde foi: ${result.stopNote}\nAcertos: ${result.correct} de ${result.total} respondidas\n` +
    (test.minutes === null ? '' : `Tempo de prova: ${test.minutes} min\n`) + '\n' +
    result.blocks.map((block, b) => `Parte ${b + 1} (${block.level}): ${block.taken ? `${block.correct}/${block.total}` : 'não chegou nesta parte'}`).join('\n') +
    `\n\n${lines.join('\n')}\n\nWhatsApp: ${test.whatsapp}\n\nRecebido em ${test.date}`;
}


/* =========================================================
   ENDEREÇO /api/nivelamento (só aceita POST)
   ========================================================= */

export async function onRequestPost({ request, env }) {
  const body = await readBody(request);
  if (!body) return json({ error: 'invalid_data' }, 400);

  // Armadilha anti-spam: campo invisível preenchido = robô. Finge que deu certo.
  if (body.website) return json({ ok: true });

  // 1. Não é robô?
  if (!(await verifyHuman(env, request, body['cf-turnstile-response']))) return json({ error: 'captcha' }, 400);

  // 2. Limpa e valida
  const studentName = clean(body.studentName, 100);
  const age = clean(body.age, 2);
  const name = clean(body.name, 100);
  const phoneDigits = normalizePhone(body.phone);
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, QUESTIONS.length) : null;
  const minutes = Number.isInteger(body.minutes) && body.minutes >= 0 && body.minutes <= 600 ? body.minutes : null;

  if (!studentName) return json({ error: 'invalid_student_name' }, 400);
  if (!/^\d{1,2}$/.test(age) || Number(age) < 5) return json({ error: 'invalid_age' }, 400);
  if (!name) return json({ error: 'invalid_name' }, 400);
  if (!phoneDigits) return json({ error: 'invalid_phone' }, 400);
  if (!answers || answers.length < RANGES[0].end) return json({ error: 'invalid_data' }, 400);

  // 3. Corrige
  const result = grade(answers);

  const test = {
    studentName,
    age,
    name,
    phone: formatPhone(phoneDigits),
    minutes,
    date: nowBrasilia(),
    whatsapp: whatsappLink(phoneDigits,
      `Olá, ${name}! Aqui é do English Book Club. Recebemos o teste de nivelamento de ${studentName} e queremos conversar sobre a turma ideal. 😊`),
  };

  // 4. Planilha primeiro (aba "Nivelamento"), depois o e-mail
  const savedToSheet = await saveToSheet(env, {
    type: 'nivelamento',
    ...test,
    score: `${result.correct} de ${result.total} (${result.stopNote})`, // "de" em vez de "/": a planilha não confunde com data
    level: result.level,
    blocks: result.blocks.map((block) => (block.taken ? `${block.correct} de ${block.total}` : '—')),
    missed: result.items.filter((item) => !item.correct).map((item) => item.number).join(', ') || 'nenhuma',
    answers: result.items.map((item) => `${item.number}${item.given || '-'}`).join(' '),
  });
  const emailSent = await sendEmail(env, {
    subject: `Nivelamento: ${studentName}, ${age} anos — ${result.level} (${result.stopNote})`,
    text: emailText(result, test, savedToSheet),
    html: emailHtml(result, test, savedToSheet),
  });

  if (savedToSheet || emailSent) return json({ ok: true });

  console.error('NIVELAMENTO PERDIDO — planilha e e-mail falharam:', JSON.stringify({ ...test, answers }));
  return json({ error: 'unavailable' }, 503);
}


/* =========================================================
   ENDEREÇO /api/nivelamento/parte (só aceita POST)
   Recebe { block: 0..4, answers: [...] } e devolve { passed: true/false }.
   Não diz quais questões estavam certas: o gabarito continua escondido.
   ========================================================= */

export async function onRequestCheck({ request }) {
  const body = await readBody(request);
  const b = body && body.block;
  if (!Number.isInteger(b) || b < 0 || b >= BLOCKS.length || !Array.isArray(body.answers)) {
    return json({ error: 'invalid_data' }, 400);
  }
  const { start, end } = RANGES[b];
  if (body.answers.length !== end - start) return json({ error: 'invalid_data' }, 400);
  const correct = QUESTIONS.slice(start, end).filter((question, i) => gradeItem(question, body.answers[i]).correct).length;
  return json({ passed: blockPassed(correct, end - start), last: b === BLOCKS.length - 1 });
}
