// FUNÇÕES COMPARTILHADAS pelos dois formulários do site:
//   /api/lead         → lista de espera (functions/api/lead.js)
//   /api/nivelamento  → teste de nivelamento (functions/api/nivelamento.js)
//
// CONFIGURAÇÕES (cadastradas no painel da Cloudflare → Variáveis e segredos, nunca no código):
//   SHEET_WEBHOOK_URL  endereço do script da planilha do Google
//   SHEET_SECRET       senha combinada entre o site e a planilha
//   RESEND_API_KEY     chave do Resend
//   MAIL_FROM          remetente, ex.: English Book Club <site@seudominio.com.br>
//   LEAD_TO_EMAIL      e-mail da cliente, que recebe os avisos
//   TURNSTILE_SECRET   chave secreta do Turnstile (anti-robô)

// DDDs que existem no Brasil
const DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
  51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];


/* =========================================================
   DADOS
   ========================================================= */

// Remove quebras de linha e espaços extras, e limita o tamanho
export function clean(value, maxLength) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
}

// Evita que alguém injete HTML no e-mail que a cliente vai receber
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Aceita telefone brasileiro com DDD (10 ou 11 dígitos), com ou sem +55.
// Devolve só os números (ex.: "11987654321") ou null se for inválido.
export function normalizePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (!DDDS.includes(Number(digits.slice(0, 2)))) return null;            // DDD precisa existir
  if (digits.length === 11 && digits[2] !== '9') return null;             // celular começa com 9
  if (digits.length === 10 && !'2345'.includes(digits[2])) return null;   // fixo começa de 2 a 5
  return digits;
}

// "11987654321" → "(11) 98765-4321"
export function formatPhone(digits) {
  const split = digits.length === 11 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

// Data e hora de Brasília, ex.: "02/11/2026, 18:30:00"
export function nowBrasilia() {
  return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Link do WhatsApp com a mensagem já escrita
export function whatsappLink(phoneDigits, message) {
  return `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(message)}`;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Lê o corpo do envio; devolve null se não for um objeto JSON válido
export async function readBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}


/* =========================================================
   SERVIÇOS EXTERNOS
   ========================================================= */

// 1. Turnstile: confirma que quem enviou é uma pessoa, não um robô.
//    Se a chave ainda não foi configurada, a verificação é pulada.
export async function verifyHuman(env, request, token) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
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

// 2. Planilha do Google: guarda o envio. "data.type" diz em qual aba vai
//    (sem type → aba "Leads"; type "nivelamento" → aba "Nivelamento").
export async function saveToSheet(env, data) {
  if (!env.SHEET_WEBHOOK_URL || !env.SHEET_SECRET) {
    console.error('Planilha não configurada (SHEET_WEBHOOK_URL / SHEET_SECRET).');
    return false;
  }
  try {
    const res = await fetch(env.SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: env.SHEET_SECRET, ...data }),
      redirect: 'follow',
    });
    const reply = await res.json().catch(() => ({}));
    if (reply.ok !== true) console.error('Planilha recusou o envio:', res.status, JSON.stringify(reply));
    return reply.ok === true;
  } catch (error) {
    console.error('Erro ao salvar na planilha:', error);
    return false;
  }
}

// 3. Resend: manda o e-mail de aviso para a cliente.
export async function sendEmail(env, { subject, text, html }) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.LEAD_TO_EMAIL) {
    console.error('E-mail não configurado (RESEND_API_KEY / MAIL_FROM / LEAD_TO_EMAIL).');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [env.LEAD_TO_EMAIL], subject, text, html }),
    });
    if (!res.ok) console.error('Resend recusou o e-mail:', res.status, await res.text());
    return res.ok;
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return false;
  }
}


/* =========================================================
   PEDAÇOS DO E-MAIL (mesmo visual nos dois formulários)
   Use só estilos "inline" (style="...") — programas de e-mail ignoram CSS externo.
   ========================================================= */

export function emailRow(label, value) {
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e6e0d2;color:#6b7a8c;font-size:13px;width:150px;">${label}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e6e0d2;color:#103c65;font-size:15px;font-weight:600;">${value}</td>
    </tr>`;
}

// se a planilha falhou, o e-mail avisa para a cliente copiar os dados manualmente
export function sheetWarning(savedToSheet) {
  return savedToSheet ? '' : `
        <p style="margin:0 0 20px;padding:12px 16px;border-radius:12px;background:#fdecea;color:#ad2525;font-size:13px;">
          ⚠️ Este envio <strong>não foi salvo na planilha</strong> (falha temporária). Copie os dados para a planilha manualmente.
        </p>`;
}

export function whatsappButton(url) {
  return `
        <div style="text-align:center;margin:28px 0 8px;">
          <a href="${url}" style="display:inline-block;background:#25d366;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;">
            Chamar no WhatsApp
          </a>
        </div>`;
}

// Moldura do e-mail: faixa azul com título + conteúdo + data
export function emailFrame({ eyebrow, title, body, date, width = 520 }) {
  return `
  <div style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:${width}px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">

      <div style="background:#103c65;padding:28px 32px;">
        <p style="margin:0 0 6px;color:#94b9ff;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">${eyebrow}</p>
        <h1 style="margin:0;color:#f5f1e8;font-family:Georgia,serif;font-weight:400;font-size:26px;">${title}</h1>
      </div>

      <div style="padding:24px 32px 32px;">${body}
        <p style="margin:24px 0 0;color:#9aa5b1;font-size:12px;text-align:center;">Recebido em ${date}</p>
      </div>
    </div>
  </div>`;
}
