import { z } from 'zod';

// Fields every form shares (stored in their own columns).
export const commonSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
  source: z.string().trim().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

// One entry per form. Adding a form = adding an entry here. No endpoint or migration needed.
// Access it at POST /api/forms/<key>
export const forms = {
  contact: {
    schema: z.object({
      name: z.string().trim().min(1).max(100),
      phone: z.string().trim().max(30).optional(),
      message: z.string().trim().min(1).max(5000),
    }),
    subject: (d) => `Novo contato: ${d.name}`,
    autoReply: (d) => ({
      subject: 'Recebemos sua mensagem',
      text: `Olá, ${d.name}!\n\nRecebemos sua mensagem e responderemos em breve.\n\nObrigado!`,
    }),
  },

  // Example of a second form:
  // quote: {
  //   schema: z.object({
  //     name: z.string().trim().min(1).max(100),
  //     service: z.enum(['site', 'loja', 'outro']),
  //     budget: z.string().trim().max(50).optional(),
  //   }),
  //   subject: (d) => `Pedido de orçamento: ${d.name}`,
  // },
};
