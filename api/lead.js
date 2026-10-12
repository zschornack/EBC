// BACKEND: recebe o formulário do site e envia o lead por e-mail.
// Na Vercel, todo arquivo dentro da pasta /api vira um endereço do site.
// Este aqui responde em: https://seusite.com/api/lead

import nodemailer from 'nodemailer';

const PROGRAMS = ['Little Reads', 'Book & Talk', 'Ainda não sei'];
const AGES = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17'];
// DDDs que existem no Brasil
const DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
  51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];

// Remove quebras de linha e espaços extras, e limita o tamanho
function clean(value, maxLength) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
}

// Evita que alguém injete HTML no e-mail que a cliente vai receber
function escapeHtml(text) {
  return text
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
  if (!DDDS.includes(Number(digits.slice(0, 2)))) return null;  // DDD precisa existir
  if (digits.length === 11 && digits[2] !== '9') return null;   // celular começa com 9
  if (digits.length === 10 && !'2345'.includes(digits[2])) return null; // fixo começa de 2 a 5
  return digits;
}

// "11987654321" → "(11) 98765-4321"
function formatPhone(digits) {
  const split = digits.length === 11 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}


/* =========================================================
   TEMPLATE DO E-MAIL
   É aqui que você muda o texto e o visual do e-mail que a cliente recebe.
   Use só estilos "inline" (style="...") — programas de e-mail ignoram CSS externo.
   ========================================================= */

function emailTemplate({ name, phone, age, program, date, whatsappUrl }) {
  const row = (label, value) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e6e0d2;color:#6b7a8c;font-size:13px;width:150px;">${label}</td>
      <td style="padding:12px 0;border-bottom:1px solid #e6e0d2;color:#103c65;font-size:15px;font-weight:600;">${value}</td>
    </tr>`;

  return `
  <div style="margin:0;padding:32px 16px;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;">

      <div style="background:#103c65;padding:28px 32px;">
        <p style="margin:0 0 6px;color:#94b9ff;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">English Book Club · Lista de espera 2027</p>
        <h1 style="margin:0;color:#f5f1e8;font-family:Georgia,serif;font-weight:400;font-size:26px;">Novo cadastro no site</h1>
      </div>

      <div style="padding:24px 32px 32px;">
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

// Mensagem que já vem escrita quando a cliente clica em "Chamar no WhatsApp"
function whatsappMessage(name, program) {
  return `Olá, ${name}! Aqui é do English Book Club. Recebemos seu cadastro na lista de espera` +
    (program === 'Ainda não sei' ? '' : ` do ${program}`) + ' e queremos conversar sobre a turma ideal. 😊';
}


export default async function handler(req, res) {
  // 1. Só aceitamos envios (POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // 2. Armadilha anti-spam: se o campo invisível veio preenchido, é robô.
  //    Fingimos que deu certo e não enviamos nada.
  if (body.website) {
    return res.status(200).json({ ok: true });
  }

  // 3. Limpa e valida os dados (nunca confie no que vem do navegador)
  const name = clean(body.name, 100);
  const phoneDigits = normalizePhone(body.phone);
  const age = clean(body.age, 2);
  const program = clean(body.program, 30);

  // diz ao site qual campo está errado, para ele mostrar a mensagem certa
  if (!name) return res.status(400).json({ error: 'invalid_name' });
  if (!phoneDigits) return res.status(400).json({ error: 'invalid_phone' });
  if (!AGES.includes(age)) return res.status(400).json({ error: 'invalid_age' });
  if (!PROGRAMS.includes(program)) return res.status(400).json({ error: 'invalid_program' });

  const phone = formatPhone(phoneDigits);
  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const whatsappUrl = `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(whatsappMessage(name, program))}`;

  // 4. Monta e envia o e-mail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `"English Book Club · Site" <${process.env.GMAIL_USER}>`,
      to: process.env.LEAD_TO_EMAIL,
      subject: `Novo cadastro na lista de espera: ${name} (${program})`,
      // versão em texto simples, para programas de e-mail que não mostram HTML
      text:
        `Novo cadastro na lista de espera 2027\n\n` +
        `Responsável: ${name}\n` +
        `Telefone: ${phone}\n` +
        `Idade do aluno: ${age} anos\n` +
        `Interesse: ${program}\n\n` +
        `WhatsApp: ${whatsappUrl}\n\n` +
        `Recebido em ${date}`,
      html: emailTemplate({ name, phone, age, program, date, whatsappUrl }),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return res.status(500).json({ error: 'Could not send email' });
  }
}
