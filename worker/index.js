// PORTA DE ENTRADA DO SITE NA CLOUDFLARE (Workers)
// - /api/lead         → lista de espera da home   (functions/api/lead.js)
// - /api/nivelamento  → teste de nivelamento      (functions/api/nivelamento.js)
// - todo o resto      → arquivos do site (pasta dist, gerada pelo build.sh)

import { onRequestPost as lead } from '../functions/api/lead.js';
import { onRequestPost as nivelamento } from '../functions/api/nivelamento.js';

const ROUTES = {
  '/api/lead': lead,
  '/api/nivelamento': nivelamento,
};

export default {
  async fetch(request, env) {
    const handler = ROUTES[new URL(request.url).pathname];

    if (handler) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
      }
      return handler({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
};
