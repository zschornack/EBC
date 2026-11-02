// BACKEND DA LISTA DE ESPERA (Cloudflare)
// Recebe o formulário da home, guarda o lead na planilha do Google e avisa a cliente por e-mail.
// O worker/index.js entrega para cá tudo o que chega em: https://seusite.com/api/lead
//
// ORDEM DE SEGURANÇA DOS LEADS
//   1. confere se não é robô (Turnstile)
//   2. valida os dados
//   3. SALVA NA PLANILHA primeiro  ← a planilha é a lista oficial de leads
//   4. manda o e-mail de aviso (Resend)
//   O cadastro só dá erro para a família se a planilha E o e-mail falharem ao mesmo tempo.
//
// As configurações (variáveis da Cloudflare) e as funções de apoio ficam em _lib.js.

import {
  clean, escapeHtml, normalizePhone, formatPhone, nowBrasilia, whatsappLink, json, readBody,
  verifyHuman, saveToSheet, sendEmail, emailRow, sheetWarning, whatsappButton, emailFrame,
} from './_lib.js';

const PROGRAMS = ['Little Reads', 'Book & Talk', 'Ainda não sei'];
const AGES = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17'];

// Ano da próxima turma (fevereiro ou agosto, horário de Brasília) — igual ao site
function launchYear(now = new Date()) {
  const y = now.getUTCFullYear();
  const next = [Date.UTC(y, 1, 1, 3), Date.UTC(y, 7, 1, 3), Date.UTC(y + 1, 1, 1, 3)].find((d) => d > now.getTime());
  return new Date(next).getUTCFullYear();
}

// Mensagem que já vem escrita quando a cliente clica em "Chamar no WhatsApp"
function whatsappMessage(name, studentName, program) {
  return `Olá, ${name}! Aqui é do English Book Club. Recebemos o cadastro de ${studentName} na lista de espera` +
    (program === 'Ainda não sei' ? '' : ` do ${program}`) + ' e queremos conversar sobre a turma ideal. 😊';
}


/* =========================================================
   TEMPLATE DO E-MAIL
   É aqui que você muda o texto do e-mail que a cliente recebe.
   (O visual da moldura fica em _lib.js → emailFrame.)
   ========================================================= */

function emailHtml(lead, savedToSheet) {
  return emailFrame({
    eyebrow: `English Book Club · Lista de espera ${launchYear()}`,
    title: 'Novo cadastro no site',
    date: lead.date,
    body: `${sheetWarning(savedToSheet)}
        <table style="width:100%;border-collapse:collapse;">
          ${emailRow('Aluno', escapeHtml(lead.studentName))}
          ${emailRow('Idade do aluno', `${escapeHtml(lead.age)} anos`)}
          ${emailRow('Responsável', escapeHtml(lead.name))}
          ${emailRow('Telefone', escapeHtml(lead.phone))}
          ${emailRow('Interesse', escapeHtml(lead.program))}
        </table>
        ${whatsappButton(lead.whatsapp)}`,
  });
}

// versão em texto simples, para programas de e-mail que não mostram HTML
function emailText(lead, savedToSheet) {
  return `Novo cadastro na lista de espera ${launchYear()}\n\n` +
    (savedToSheet ? '' : 'ATENÇÃO: este cadastro NÃO foi salvo na planilha. Copie manualmente.\n\n') +
    `Aluno: ${lead.studentName}\n` +
    `Idade do aluno: ${lead.age} anos\n` +
    `Responsável: ${lead.name}\n` +
    `Telefone: ${lead.phone}\n` +
    `Interesse: ${lead.program}\n\n` +
    `WhatsApp: ${lead.whatsapp}\n\n` +
    `Recebido em ${lead.date}`;
}


/* =========================================================
   ENDEREÇO /api/lead (só aceita POST)
   ========================================================= */

export async function onRequestPost({ request, env }) {
  const body = await readBody(request);
  if (!body) return json({ error: 'invalid_data' }, 400);

  // Armadilha anti-spam: se o campo invisível veio preenchido, é robô. Finge que deu certo.
  if (body.website) return json({ ok: true });

  // 1. Não é robô?
  if (!(await verifyHuman(env, request, body['cf-turnstile-response']))) return json({ error: 'captcha' }, 400);

  // 2. Limpa e valida (nunca confie no que vem do navegador)
  const name = clean(body.name, 100);
  const studentName = clean(body.studentName, 100);
  const phoneDigits = normalizePhone(body.phone);
  const age = clean(body.age, 2);
  const program = clean(body.program, 30);

  if (!name) return json({ error: 'invalid_name' }, 400);
  if (!phoneDigits) return json({ error: 'invalid_phone' }, 400);
  if (!studentName) return json({ error: 'invalid_student_name' }, 400);
  if (!AGES.includes(age)) return json({ error: 'invalid_age' }, 400);
  if (!PROGRAMS.includes(program)) return json({ error: 'invalid_program' }, 400);

  const lead = {
    name,
    studentName,
    phone: formatPhone(phoneDigits),
    age,
    program,
    date: nowBrasilia(),
    whatsapp: whatsappLink(phoneDigits, whatsappMessage(name, studentName, program)),
  };

  // 3. Planilha primeiro, 4. depois o e-mail (que avisa se a planilha falhou)
  const savedToSheet = await saveToSheet(env, lead);
  const emailSent = await sendEmail(env, {
    subject: `Novo cadastro na lista de espera: ${studentName}, ${age} anos (${program})`,
    text: emailText(lead, savedToSheet),
    html: emailHtml(lead, savedToSheet),
  });

  if (savedToSheet || emailSent) return json({ ok: true, savedToSheet, emailSent });

  console.error('LEAD PERDIDO — planilha e e-mail falharam:', JSON.stringify(lead));
  return json({ error: 'unavailable' }, 503);
}
