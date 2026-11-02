// GABARITO DO TESTE DE NIVELAMENTO (privado: fica só no servidor, não aparece no site)
//
// Uma resposta por pergunta, na MESMA ORDEM de nivelamento-perguntas.js (1 a 52).
// Quando duas respostas estão certas, use as duas: ['a', 'c'].
//
// ⚠️ Peça para a professora conferir as marcadas com "confira":
//    são perguntas em que mais de uma opção pode ser aceita.

export const ANSWERS = [
  // Bloco 1 — A1 (perguntas 1 a 9)
  'b', 'b', 'c', 'b', 'b', 'a', 'a', 'b', 'a',

  // Bloco 2 — A2 (perguntas 10 a 17)
  'c', 'b', 'b', 'b', 'a', 'c', 'a', 'b',

  // Bloco 3 — B1 (perguntas 18 a 28)
  'a', 'a', 'b', 'a', 'c', 'a', 'a', 'a', 'd', 'b', 'a',

  // Bloco 4 — B2 (perguntas 29 a 40)
  'a',
  ['a', 'c'], // 30 — confira: "will launch" e "is launching" estão corretas (aceitamos as duas)
  'a', 'c', 'a', 'a', 'b', 'a', 'b', 'a', 'a', 'b',

  // Bloco 5 — C1 (perguntas 41 a 52)
  'a', 'c', 'a', 'b', 'a', 'a', 'a', 'a', 'b', 'a',
  ['a', 'c'], // 51 — confira: "he be informed" e "he should be informed" estão corretas (aceitamos as duas)
  'a',
];

// Para ser considerado "aprovado" num bloco, o aluno precisa acertar pelo menos esta fração dele.
// O nível estimado é o do último bloco aprovado em sequência (A1 → A2 → B1 → B2 → C1).
export const PASS_RATE = 0.6;

export const LEVEL_NAMES = {
  A1: 'A1 · Iniciante',
  A2: 'A2 · Básico',
  B1: 'B1 · Intermediário',
  B2: 'B2 · Intermediário avançado',
  C1: 'C1 · Avançado',
};
export const BELOW_A1 = 'Pré-A1 · Começando do zero';
