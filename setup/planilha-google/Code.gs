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

// Cada aba: nome + colunas. Cada coluna diz de onde vem o valor.
// O script grava PELO NOME DA COLUNA (não pela posição): pode mover, pintar ou acrescentar colunas suas
// na planilha à vontade. Se faltar alguma coluna daqui, ela é criada sozinha no próximo envio.
const SHEETS = {
  leads: {
    name: 'Leads',
    columns: [
      ['Data', function (d) { return d.date; }],
      ['Responsável', function (d) { return d.name; }],
      ['Aluno', function (d) { return d.studentName; }],
      ['Telefone', function (d) { return d.phone; }],
      ['Idade', function (d) { return d.age; }],
      ['Turma', function (d) { return d.program; }],
      ['WhatsApp', function (d) { return d.whatsapp; }],
      ['Status', function () { return 'Novo'; }],
    ],
  },
  nivelamento: {
    name: 'Nivelamento',
    columns: [
      ['Data', function (d) { return d.date; }],
      ['Aluno', function (d) { return d.studentName; }],
      ['Idade', function (d) { return d.age; }],
      ['Responsável', function (d) { return d.name; }],
      ['Telefone', function (d) { return d.phone; }],
      ['Acertos', function (d) { return d.score; }],
      ['Nível estimado', function (d) { return d.level; }],
      ['Bloco A1', function (d) { return (d.blocks || [])[0]; }],
      ['Bloco A2', function (d) { return (d.blocks || [])[1]; }],
      ['Bloco B1', function (d) { return (d.blocks || [])[2]; }],
      ['Bloco B2', function (d) { return (d.blocks || [])[3]; }],
      ['Bloco C1', function (d) { return (d.blocks || [])[4]; }],
      ['Erros e em branco', function (d) { return d.missed; }],
      ['Respostas', function (d) { return d.answers; }],
      ['WhatsApp', function (d) { return d.whatsapp; }],
      ['Status', function () { return 'Novo'; }],
    ],
  },
};

// Abrir a URL do script no navegador mostra qual versão do código está respondendo.
// (Serve para conferir se a URL cadastrada na Cloudflare é a implantação certa.)
const VERSION = '25/11/2026 · grava pelo nome da coluna';
function doGet() {
  return ContentService.createTextOutput('English Book Club · script da planilha · versão ' + VERSION);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);

    // só aceita envios vindos do site (senha combinada)
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || data.token !== secret) return reply({ ok: false, error: 'unauthorized' });

    const config = data.type === 'nivelamento' ? SHEETS.nivelamento : SHEETS.leads;

    lock.waitLock(10000); // evita que dois envios ao mesmo tempo se atrapalhem

    data.date = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
    appendRecord(getSheet(config), config, data);

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// Acha (ou cria) a aba; na primeira vez escreve o cabeçalho
function getSheet(config) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(config.name);
  if (!sheet) sheet = ss.insertSheet(config.name);
  if (sheet.getLastRow() === 0) {
    const titles = config.columns.map(function (c) { return c[0]; });
    sheet.appendRow(titles);
    sheet.getRange(1, 1, 1, titles.length).setFontWeight('bold').setBackground('#bed5ff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// "  Responsavel " e "Responsável" contam como a mesma coluna
function norm(text) {
  return String(text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function readHeader(sheet) {
  const width = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, width).getValues()[0].map(norm);
}

// Grava uma linha nova colocando cada valor embaixo da coluna com o mesmo nome
function appendRecord(sheet, config, data) {
  let header = readHeader(sheet);

  // cria as colunas que faltarem (os cadastros antigos ficam com elas em branco)
  config.columns.forEach(function (column, i) {
    if (header.indexOf(norm(column[0])) !== -1) return;
    // coloca a coluna nova logo depois da coluna que vem antes dela na lista (ex.: "Aluno" depois de "Responsável")
    const previous = i > 0 ? header.indexOf(norm(config.columns[i - 1][0])) : -1;
    let position; // número da coluna nova, começando em 1
    if (previous !== -1) {
      sheet.insertColumnAfter(previous + 1);
      position = previous + 2;
    } else {
      position = header.filter(String).length ? sheet.getLastColumn() + 1 : 1;
    }
    sheet.getRange(1, position).setValue(column[0]).setFontWeight('bold').setBackground('#bed5ff');
    header = readHeader(sheet);
  });

  const row = header.map(function (title) {
    const column = config.columns.filter(function (c) { return norm(c[0]) === title; })[0];
    return column ? safe(column[1](data)) : '';
  });
  sheet.appendRow(row);
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
