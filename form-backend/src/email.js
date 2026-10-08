import { forms } from './forms.js';
import { bumpAttempts, markEmail } from './db.js';

async function send({ to, subject, text, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email dev mode] to=${to} subject="${subject}"\n${text}\n`);
    return 'skipped';
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text, reply_to: replyTo }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return 'sent';
}

const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').slice(0, 150);

// Works from a DB row so it can be reused by the retry job.
export async function deliver(row) {
  const form = forms[row.form_type];
  const data = JSON.parse(row.data);
  bumpAttempts(row.id);

  const fields = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
  const text =
    `Nova submissão (${row.form_type})\n\nemail: ${row.email}\n${fields}\n\n` +
    `origem: ${row.source ?? '-'}\nrecebido: ${row.created_at} UTC\nid: ${row.id}`;

  try {
    const status = await send({
      to: process.env.NOTIFY_TO,
      subject: oneLine(form.subject(data)),
      text,
      replyTo: row.email, // hitting "reply" answers the lead
    });
    markEmail(row.id, status);
  } catch (err) {
    markEmail(row.id, 'failed', String(err.message));
    throw err;
  }

  // Auto-reply is best-effort and never affects the notification status.
  if (form.autoReply) {
    try {
      const r = form.autoReply(data);
      await send({ to: row.email, subject: oneLine(r.subject), text: r.text });
    } catch (err) {
      console.error('auto-reply failed:', err.message);
    }
  }
}
