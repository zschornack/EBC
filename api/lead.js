// BACKEND: recebe o formulário do site e envia o lead por e-mail.
// Na Vercel, todo arquivo dentro da pasta /api vira um endereço do site.
// Este aqui responde em: https://seusite.com/api/lead

import nodemailer from 'nodemailer';

const PROGRAMS = ['Little Reads', 'Book & Talk', 'Ainda não sei'];
const AGES = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const email = clean(body.email, 150);
  const age = clean(body.age, 2);
  const program = clean(body.program, 30);

  if (!name || !EMAIL_REGEX.test(email) || !AGES.includes(age) || !PROGRAMS.includes(program)) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  // 4. Monta e envia o e-mail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const date = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  try {
    await transporter.sendMail({
      from: `"English Book Club · Site" <${process.env.GMAIL_USER}>`,
      to: process.env.LEAD_TO_EMAIL,
      replyTo: email, // clicar em "Responder" já responde para o pai/mãe
      subject: `Novo cadastro na lista de espera: ${name} (${program})`,
      text:
        `Novo cadastro na lista de espera 2027\n\n` +
        `Nome do responsável: ${name}\n` +
        `E-mail: ${email}\n` +
        `Idade do aluno: ${age}\n` +
        `Interesse: ${program}\n\n` +
        `Enviado em ${date}`,
      html: `
        <h2>Novo cadastro na lista de espera 2027</h2>
        <p><strong>Nome do responsável:</strong> ${escapeHtml(name)}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
        <p><strong>Idade do aluno:</strong> ${escapeHtml(age)}</p>
        <p><strong>Interesse:</strong> ${escapeHtml(program)}</p>
        <p style="color:#888">Enviado em ${date}</p>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error);
    return res.status(500).json({ error: 'Could not send email' });
  }
}
