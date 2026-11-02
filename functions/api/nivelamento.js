// BACKEND DO TESTE DE NIVELAMENTO (Cloudflare)
// Recebe as respostas da página /nivelamento, CORRIGE AQUI NO SERVIDOR (o gabarito nunca vai para o navegador),
// guarda o resultado na aba "Nivelamento" da planilha e manda para a cliente um e-mail com acertos e erros.
// O worker/index.js entrega para cá tudo o que chega em: https://seusite.com/api/nivelamento
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
   ========================================================= */

function grade(rawAnswers) {
  const items = QUESTIONS.map((question, i) => {
    const raw = String(rawAnswers[i] ?? '').trim().toLowerCase();
    const given = LETTERS.indexOf(raw) >= 0 && LETTERS.indexOf(raw) < question.options.length ? raw : '';
    const accepted = [].concat(ANSWERS[i] ?? []);
    return { ...question, given, accepted, correct: given !== '' && accepted.includes(given) };
  });

  const blocks = BLOCKS.map((block, b) => {
    const mine = items.filter((item) => item.block === b);
    const correct = mine.filter((item) => item.correct).length;
    return { level: block.level, correct, total: mine.length, passed: correct >= Math.ceil(mine.length * PASS_RATE) };
  });

  // nível estimado = último bloco aprovado em sequência
  let level = BELOW_A1;
  for (const block of blocks) {
    if (!block.passed) break;
    level = LEVEL_NAMES[block.level] || block.level;
  }

  const correct = items.filter((item) => item.correct).length;
  return { items, blocks, correct, total: items.length, level };
}

const optionText = (item, letter) => `${letter}) ${item.options[LETTERS.indexOf(letter)]}`;


/* =========================================================
   TEMPLATE DO E-MAIL
   ========================================================= */

function emailHtml(result, test, savedToSheet) {
  const percent = Math.round((result.correct / result.total) * 100);

  const blockRows = result.blocks.map((block, b) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e6e0d2;color:#103c65;font-size:14px;">Bloco ${b + 1} · ${block.level}</td>
            <td style="padding:8px 0;border-bottom:1px solid #e6e0d2;color:#103c65;font-size:14px;font-weight:700;text-align:right;">${block.correct}/${block.total}</td>
            <td style="padding:8px 0 8px 12px;border-bottom:1px solid #e6e0d2;font-size:13px;text-align:right;color:${block.passed ? '#1e7b3c' : '#ad2525'};">${block.passed ? 'aprovado' : 'abaixo de ' + Math.round(PASS_RATE * 100) + '%'}</td>
          </tr>`).join('');

  const details = result.blocks.map((block, b) => {
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
        <p style="margin:28px 0 4px;color:#103c65;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Bloco ${b + 1} · ${block.level} — ${block.correct}/${block.total}</p>
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
          ${emailRow('Acertos', `${result.correct} de ${result.total} (${percent}%)`)}
          ${emailRow('Nível estimado', escapeHtml(result.level))}
          ${test.minutes === null ? '' : emailRow('Tempo de prova', `${test.minutes} min`)}
        </table>

        <p style="margin:28px 0 4px;color:#103c65;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Resultado por bloco</p>
        <table style="width:100%;border-collapse:collapse;">${blockRows}
        </table>
        <p style="margin:10px 0 0;color:#9aa5b1;font-size:12px;">O nível estimado é o último bloco em que o aluno acertou pelo menos ${Math.round(PASS_RATE * 100)}%, sem pular nenhum antes dele. É uma referência: a avaliação final é da professora.</p>
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
    `Acertos: ${result.correct} de ${result.total}\nNível estimado: ${result.level}\n` +
    (test.minutes === null ? '' : `Tempo de prova: ${test.minutes} min\n`) + '\n' +
    result.blocks.map((block, b) => `Bloco ${b + 1} (${block.level}): ${block.correct}/${block.total}`).join('\n') +
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
  if (!answers) return json({ error: 'invalid_data' }, 400);

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
    score: `${result.correct} de ${result.total}`, // "de" em vez de "/": a planilha não confunde com data
    level: result.level,
    blocks: result.blocks.map((block) => `${block.correct} de ${block.total}`),
    missed: result.items.filter((item) => !item.correct).map((item) => item.number).join(', ') || 'nenhuma',
    answers: result.items.map((item) => `${item.number}${item.given || '-'}`).join(' '),
  });
  const emailSent = await sendEmail(env, {
    subject: `Nivelamento: ${studentName}, ${age} anos — ${result.correct}/${result.total} · ${result.level}`,
    text: emailText(result, test, savedToSheet),
    html: emailHtml(result, test, savedToSheet),
  });

  if (savedToSheet || emailSent) return json({ ok: true });

  console.error('NIVELAMENTO PERDIDO — planilha e e-mail falharam:', JSON.stringify({ ...test, answers }));
  return json({ error: 'unavailable' }, 503);
}
