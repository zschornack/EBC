// BACKEND DO FORMULÁRIO (Cloudflare)
// Recebe o formulário do site, guarda o lead na planilha do Google e avisa a cliente por e-mail.
// Na Cloudflare, o worker/index.js entrega para cá tudo o que chega em: https://seusite.com/api/lead
//
// ORDEM DE SEGURANÇA DOS LEADS
//   1. confere se não é robô (Turnstile)
//   2. valida os dados
//   3. SALVA NA PLANILHA primeiro  ← a planilha é a lista oficial de leads
//   4. manda o e-mail de aviso (Resend)
//   O cadastro só dá erro para a família se a planilha E o e-mail falharem ao mesmo tempo.
//
// CONFIGURAÇÕES (cadastradas no painel da Cloudflare → Variáveis e segredos, nunca no código):
//   SHEET_WEBHOOK_URL  endereço do script da planilha do Google
//   SHEET_SECRET       senha combinada entre o site e a planilha
//   RESEND_API_KEY     chave do Resend
//   MAIL_FROM          remetente, ex.: English Book Club <site@seudominio.com.br>
//   LEAD_TO_EMAIL      e-mail da cliente, que recebe os avisos
//   TURNSTILE_SECRET   chave secreta do Turnstile (anti-robô)

const PROGRAMS = ['Little Reads', 'Book & Talk', 'Ainda não sei'];
const AGES = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17'];
// DDDs que existem no Brasil
const DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
  51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];


/* =========================================================
   FUNÇÕES DE APOIO
   ========================================================= */

// Ano da próxima turma (fevereiro ou agosto, horário de Brasília) — igual ao site
function launchYear(now = new Date()) {
  const y = now.getUTCFullYear();
  const next = [Date.UTC(y, 1, 1, 3), Date.UTC(y, 7, 1, 3), Date.UTC(y + 1, 1, 1, 3)].find((d) => d > now.getTime());
  return new Date(next).getUTCFullYear();
}

// Remove quebras de linha e espaços extras, e limita o tamanho
function clean(value, maxLength) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
}

// Evita que alguém injete HTML no e-mail que a cliente vai receber
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Aceita telefone brasileiro com DDD (10 ou 11 dígitos), com ou sem +55.
// Devolve só os números (ex.: "11987654321") ou null se for inválido.
function normalizePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (!DDDS.includes(Number(digits.slice(0, 2)))) return null;            // DDD precisa existir
  if (digits.length === 11 && digits[2] !== '9') return null;             // celular começa com 9
  if (digits.length === 10 && !'2345'.includes(digits[2])) return null;   // fixo começa de 2 a 5
  return digits;
}

// "11987654321" → "(11) 98765-4321"
function formatPhone(digits) {
  const split = digits.length === 11 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Mensagem que já vem escrita quando a cliente clica em "Chamar no WhatsApp"
function whatsappMessage(name, program) {
  return `Olá, ${name}! Aqui é do English Book Club. Recebemos seu cadastro na lista de espera` +
    (program === 'Ainda não sei' ? '' : ` do ${program}`) + ' e queremos conversar sobre a turma ideal. 😊';
}


/* =========================================================
   TEMPLATE DO E-MAIL
   É aqui que você muda o texto e o visual do e-mail que a cliente recebe.
   Use só estilos "inline" (style="...") — programas de e-mail ignoram CSS externo.
   ========================================================= */

function emailTemplate({ name, phone, age, program, date, whatsappUrl, savedToSheet }) {
  const row = (label, value) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e6e0d2;color:#6b7a8c;font-size:13px;width:150px;">${label}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e6e0d2;color:#103c65;font-size:15px;font-weight:600;">${value}</td>
    </tr>`;

  // se a planilha falhou, o e-mail avisa para a cliente copiar o lead manualmente
  const sheetWarning = savedToSheet ? '' : `
        <p style="margin:0 0 20px;padding:12px 16px;border-radius:12px;background:#fdecea;color:#ad2525;font-size:13px;">
          ⚠️ Este cadastro <strong>não foi salvo na planilha</strong> (falha temporária). Copie os dados para a planilha manualmente.
        </p>`;

  return `
  <div style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">

      <div style="background:#103c65;padding:28px 32px;">
        <p style="margin:0 0 6px;color:#94b9ff;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">English Book Club · Lista de espera ${launchYear()}</p>
        <h1 style="margin:0;color:#f5f1e8;font-family:Georgia,serif;font-weight:400;font-size:26px;">Novo cadastro no site</h1>
      </div>

      <div style="padding:24px 32px 32px;">${sheetWarning}
        <table style="width:100%;border-collapse:collapse;">
          ${row('Responsável', escapeHtml(name))}
          ${row('Telefone', escapeHtml(phone))}
          ${row('Idade do aluno', `${escapeHtml(age)} anos`)}
          ${row('Interesse', escapeHtml(program))}
        </table>

        <div style="text-align:center;margin:28px 0 8px;">
          <a href="${whatsappUrl}" style="display:inline-block;background:#25d366;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;">
            Chamar no WhatsApp
          </a>
        </div>

        <p style="margin:24px 0 0;color:#9aa5b1;font-size:12px;text-align:center;">Recebido em ${date}</p>
      </div>
    </div>
  </div>`;
}


/* =========================================================
   SERVIÇOS EXTERNOS
   ========================================================= */

// 1. Turnstile: confirma que quem enviou é uma pessoa, não um robô.
//    Se a chave ainda não foi configurada, a verificação é pulada.
async function verifyHuman(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile indisponível:', error);
    return true; // se o próprio Turnstile estiver fora do ar, não bloqueia famílias de verdade
  }
}

// 2. Planilha do Google: guarda o lead (a lista oficial).
async function saveToSheet(env, lead) {
  if (!env.SHEET_WEBHOOK_URL || !env.SHEET_SECRET) {
    console.error('Planilha não configurada (SHEET_WEBHOOK_URL / SHEET_SECRET).');
    return false;
  }
  try {
    const res = await fetch(env.SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: env.SHEET_SECRET, ...lead }),
      redirect: 'follow',
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok !== true) console.error('Planilha recusou o lead:', res.status, JSON.stringify(data));
    return data.ok === true;
  } catch (error) {
    console.error('Erro ao salvar na planilha:', error);
    return false;
  }
}

// 3. Resend: manda o e-mail de aviso para a cliente.
async function sendEmail(env, lead, savedToSheet) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.LEAD_TO_EMAIL) {
    console.error('E-mail não configurado (RESEND_API_KEY / MAIL_FROM / LEAD_TO_EMAIL).');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [env.LEAD_TO_EMAIL],
        subject: `Novo cadastro na lista de espera: ${lead.name} (${lead.program})`,
        // versão em texto simples, para programas de e-mail que não mostram HTML
        text:
          `Novo cadastro na lista de espera ${launchYear()}\n\n` +
          (savedToSheet ? '' : 'ATENÇÃO: este cadastro NÃO foi salvo na planilha. Copie manualmente.\n\n') +
          `Responsável: ${lead.name}\n` +
          `Telefone: ${lead.phone}\n` +
          `Idade do aluno: ${lead.age} anos\n` +
          `Interesse: ${lead.program}\n\n` +
          `WhatsApp: ${lead.whatsapp}\n\n` +
          `Recebido em ${lead.date}`,
        html: emailTemplate({ ...lead, whatsappUrl: lead.whatsapp, savedToSheet }),
      }),
    });
    if (!res.ok) console.error('Resend recusou o e-mail:', res.status, await res.text());
    return res.ok;
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return false;
  }
}


/* =========================================================
   ENDEREÇO /api/lead (só aceita POST; outros métodos recebem 405 automaticamente)
   ========================================================= */

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_data' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ error: 'invalid_data' }, 400);

  // Armadilha anti-spam: se o campo invisível veio preenchido, é robô. Finge que deu certo.
  if (body.website) return json({ ok: true });

  // 1. Não é robô?
  const human = await verifyHuman(env, body['cf-turnstile-response'], request.headers.get('CF-Connecting-IP'));
  if (!human) return json({ error: 'captcha' }, 400);

  // 2. Limpa e valida (nunca confie no que vem do navegador)
  const name = clean(body.name, 100);
  const phoneDigits = normalizePhone(body.phone);
  const age = clean(body.age, 2);
  const program = clean(body.program, 30);

  if (!name) return json({ error: 'invalid_name' }, 400);
  if (!phoneDigits) return json({ error: 'invalid_phone' }, 400);
  if (!AGES.includes(age)) return json({ error: 'invalid_age' }, 400);
  if (!PROGRAMS.includes(program)) return json({ error: 'invalid_program' }, 400);

  const lead = {
    name,
    phone: formatPhone(phoneDigits),
    age,
    program,
    date: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    whatsapp: `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(whatsappMessage(name, program))}`,
  };

  // 3. Planilha primeiro, 4. depois o e-mail (que avisa se a planilha falhou)
  const savedToSheet = await saveToSheet(env, lead);
  const emailSent = await sendEmail(env, lead, savedToSheet);

  if (savedToSheet || emailSent) return json({ ok: true, savedToSheet, emailSent });

  console.error('LEAD PERDIDO — planilha e e-mail falharam:', JSON.stringify(lead));
  return json({ error: 'unavailable' }, 503);
}
