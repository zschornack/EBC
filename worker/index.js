// PORTA DE ENTRADA DO SITE NA CLOUDFLARE (Workers)
// - /api/lead → backend do formulário (functions/api/lead.js)
// - todo o resto → arquivos do site (pasta dist, gerada pelo build.sh)

import { onRequestPost } from '../functions/api/lead.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/lead') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
      }
      return onRequestPost({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
};
