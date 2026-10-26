/**
 * ENGLISH BOOK CLUB — recebe os leads do site e grava na planilha.
 *
 * COMO USAR (detalhes no guia):
 *   1. Na planilha: Extensões → Apps Script → apague tudo e cole este arquivo inteiro.
 *   2. Configurações do projeto (engrenagem) → Propriedades do script → adicionar:
 *        SECRET = (a mesma senha que você vai cadastrar na Cloudflare como SHEET_SECRET)
 *   3. Implantar → Nova implantação → Tipo: App da Web
 *        Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
 *   4. Copie a URL do App da Web (termina em /exec) → vai na Cloudflare como SHEET_WEBHOOK_URL.
 *
 * Se você alterar este código depois, faça: Implantar → Gerenciar implantações →
 * editar (lápis) → Versão: "Nova versão" → Implantar. A URL continua a mesma.
 */

const SHEET_NAME = 'Leads';
const HEADERS = ['Data', 'Responsável', 'Telefone', 'Idade', 'Turma', 'WhatsApp', 'Status'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);

    // só aceita cadastros vindos do site (senha combinada)
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || data.token !== secret) return reply({ ok: false, error: 'unauthorized' });

    lock.waitLock(10000); // evita que dois cadastros ao mesmo tempo se atrapalhem

    const sheet = getSheet();
    sheet.appendRow([
      Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
      safe(data.name),
      safe(data.phone),
      safe(data.age),
      safe(data.program),
      safe(data.whatsapp),
      'Novo',
    ]);

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Cria a aba "Leads" com o cabeçalho na primeira vez
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#bed5ff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Impede que alguém coloque uma fórmula maliciosa no nome (ex.: "=IMPORTXML(...)")
function safe(value) {
  const text = String(value === undefined || value === null ? '' : value).slice(0, 2000);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * TESTE MANUAL: no editor do Apps Script, escolha "testarPlanilha" no menu de funções e clique em Executar.
 * Uma linha de teste deve aparecer na aba "Leads". (Pode apagar a linha depois.)
 */
function testarPlanilha() {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret) throw new Error('Cadastre a propriedade SECRET antes (Configurações do projeto → Propriedades do script).');
  const result = doPost({ postData: { contents: JSON.stringify({
    token: secret, name: 'TESTE — pode apagar', phone: '(11) 98765-4321', age: '10',
    program: 'Little Reads', whatsapp: 'https://wa.me/5511987654321',
  }) } });
  Logger.log(result.getContent());
}
