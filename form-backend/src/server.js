import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { commonSchema, forms } from './forms.js';
import { insertSubmission, getSubmission, findRetryable } from './db.js';
import { deliver } from './email.js';

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 20_000 });

await app.register(cors, {
  origin: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  methods: ['POST', 'OPTIONS'],
});
await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // disabled
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  return (await res.json()).success === true;
}

function fieldErrors(...results) {
  const errors = {};
  for (const r of results) {
    if (r.success) continue;
    for (const issue of r.error.issues) errors[issue.path.join('.') || '_'] = issue.message;
  }
  return errors;
}

app.get('/health', async () => ({ ok: true }));

app.post(
  '/api/forms/:formType',
  { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, // per IP
  async (req, reply) => {
    const form = forms[req.params.formType];
    if (!form) return reply.code(404).send({ ok: false, error: 'unknown_form' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};

    // Honeypot: real users never fill this hidden field. Pretend success, store nothing.
    if (body.website) return reply.code(201).send({ ok: true });

    const common = commonSchema.safeParse(body);
    const fields = form.schema.safeParse(body);
    if (!common.success || !fields.success) {
      return reply.code(422).send({ ok: false, error: 'validation', fields: fieldErrors(common, fields) });
    }

    if (!(await verifyTurnstile(common.data.turnstileToken, req.ip))) {
      return reply.code(400).send({ ok: false, error: 'captcha_failed' });
    }

    // 1) Save first...
    const id = insertSubmission({
      form_type: req.params.formType,
      email: common.data.email,
      consent: 1,
      source: common.data.source ?? null,
      data: JSON.stringify(fields.data),
      ip: req.ip,
      user_agent: (req.headers['user-agent'] || '').slice(0, 300),
    });

    // 2) ...email second, without making the visitor wait. Failures are retried below.
    deliver(getSubmission(id)).catch((err) => req.log.error({ err: err.message, id }, 'email failed'));

    return reply.code(201).send({ ok: true });
  }
);

// Retry emails that failed or never finished.
setInterval(() => {
  for (const row of findRetryable()) deliver(row).catch((e) => app.log.warn({ id: row.id, err: e.message }, 'retry failed'));
}, 5 * 60 * 1000).unref();

await app.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
