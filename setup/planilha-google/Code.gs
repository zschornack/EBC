/**
 * ENGLISH BOOK CLUB — recebe os envios do site e grava na planilha.
 *   Lista de espera  → aba "Leads"
 *   Nivelamento      → aba "Nivelamento"
 * (as abas são criadas sozinhas no primeiro envio)
 *
 * COMO USAR (detalhes no guia):
 *   1. Na planilha: Extensões → Apps Script → apague tudo e cole este arquivo inteiro.
 *   2. Configurações do projeto (engrenagem) → Propriedades do script → adicionar:
 *        SECRET = (a mesma senha que está na Cloudflare como SHEET_SECRET)
 *   3. Implantar → Nova implantação → Tipo: App da Web
 *        Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
 *   4. Copie a URL do App da Web (termina em /exec) → vai na Cloudflare como SHEET_WEBHOOK_URL.
 *
 * Se você alterar este código depois, faça: Implantar → Gerenciar implantações →
 * editar (lápis) → Versão: "Nova versão" → Implantar. A URL continua a mesma.
 */

const SHEETS = {
  leads: {
    name: 'Leads',
    headers: ['Data', 'Responsável', 'Aluno', 'Telefone', 'Idade', 'Turma', 'WhatsApp', 'Status'],
    row: function (d) { return [d.name, d.studentName, d.phone, d.age, d.program, d.whatsapp]; },
  },
  nivelamento: {
    name: 'Nivelamento',
    headers: ['Data', 'Aluno', 'Idade', 'Responsável', 'Telefone', 'Acertos', 'Nível estimado',
      'Bloco A1', 'Bloco A2', 'Bloco B1', 'Bloco B2', 'Bloco C1', 'Erros e em branco', 'Respostas', 'WhatsApp', 'Status'],
    row: function (d) {
      const blocks = (d.blocks || []).slice(0, 5);
      while (blocks.length < 5) blocks.push('');
      return [d.studentName, d.age, d.name, d.phone, d.score, d.level].concat(blocks, [d.missed, d.answers, d.whatsapp]);
    },
  },
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);

    // só aceita envios vindos do site (senha combinada)
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || data.token !== secret) return reply({ ok: false, error: 'unauthorized' });

    const config = data.type === 'nivelamento' ? SHEETS.nivelamento : SHEETS.leads;

    lock.waitLock(10000); // evita que dois envios ao mesmo tempo se atrapalhem

    const sheet = getSheet(config);
    const date = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
    sheet.appendRow([date].concat(config.row(data).map(safe), ['Novo']));

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Cria a aba com o cabeçalho na primeira vez
function getSheet(config) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(config.name);
  if (!sheet) sheet = ss.insertSheet(config.name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(config.headers);
    sheet.getRange(1, 1, 1, config.headers.length).setFontWeight('bold').setBackground('#bed5ff');
    sheet.setFrozenRows(1);
  }
  if (config === SHEETS.leads) addStudentColumn(sheet);
  return sheet;
}

// A aba "Leads" antiga não tinha a coluna "Aluno": cria a coluna logo depois de "Responsável",
// sem bagunçar os cadastros que já estavam lá (eles ficam com "Aluno" em branco).
function addStudentColumn(sheet) {
  const header = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  if (header.indexOf('Aluno') !== -1 || header[1] !== 'Responsável') return;
  sheet.insertColumnAfter(2);
  sheet.getRange(1, 3).setValue('Aluno').setFontWeight('bold').setBackground('#bed5ff');
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
 * Aparece uma linha de teste em cada aba ("Leads" e "Nivelamento"). Pode apagar as linhas depois.
 */
function testarPlanilha() {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret) throw new Error('Cadastre a propriedade SECRET antes (Configurações do projeto → Propriedades do script).');
  function send(data) {
    data.token = secret;
    Logger.log(doPost({ postData: { contents: JSON.stringify(data) } }).getContent());
  }
  send({ name: 'TESTE — pode apagar', studentName: 'Aluno teste', phone: '(11) 98765-4321', age: '10',
    program: 'Little Reads', whatsapp: 'https://wa.me/5511987654321' });
  send({ type: 'nivelamento', studentName: 'TESTE — pode apagar', age: '12', name: 'Responsável teste',
    phone: '(11) 98765-4321', score: '30 de 52', level: 'B1 · Intermediário', blocks: ['9 de 9', '7 de 8', '8 de 11', '5 de 12', '1 de 12'],
    missed: '3, 12', answers: '1b 2b 3-', whatsapp: 'https://wa.me/5511987654321' });
}
