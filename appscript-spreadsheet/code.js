// === MAIN ENTRY ===
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Plutus')
    .addItem('Enter Token', 'showTokenPrompt')
    .addItem('Fetch All Data', 'fetchAllPlutusData')
    .addToUi();
}


function fetchAllPlutusData() {
  const token = PropertiesService.getScriptProperties().getProperty('PLUTUS_TOKEN');
  if (!token) {
    SpreadsheetApp.getUi().alert("Token missing. Use 'Plutus → Enter Token' first.");
    return;
  }
  cleanUpPlutusSheets();
  fetchTransactions(token);
  fetchRewards(token);
  fetchGiftcardOrders(token);
  fetchGiftcardCatalog(token);
}

// === TOKEN ===
function showTokenPrompt() {
  const html = HtmlService.createHtmlOutputFromFile('TokenPrompt')
    .setWidth(300)
    .setHeight(150);
  SpreadsheetApp.getUi().showModalDialog(html, 'Enter Plutus Token');
}

function saveToken(token) {
  PropertiesService.getScriptProperties().setProperty('PLUTUS_TOKEN', token);
}

// === SETTINGS ===
function createUserSettingsSheet() {
  const sheetName = 'UserSettings';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange('A1').setValue('Setting');
    sheet.getRange('B1').setValue('Value');
    sheet.getRange('A2').setValue('Preferred Currency');
    sheet.getRange('B2').setValue('EUR');

    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['EUR', 'GBP'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange('B2').setDataValidation(rule);

    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, 2);
  }
}

function getPreferredCurrency() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('UserSettings');
  if (!sheet) return 'EUR';
  const value = sheet.getRange('B2').getValue();
  return value && ['EUR', 'GBP'].includes(value.toUpperCase()) ? value.toUpperCase() : 'EUR';
}

// === SHEET UTILS ===
function cleanUpPlutusSheets() {
  const names = ['Transactions', 'Rewards', 'GiftcardOrders', 'GiftcardCatalog', 'SpendingSummary'];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  names.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) ss.deleteSheet(sheet);
  });
}

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function styleSheet(sheet, headersLength) {
  const range = sheet.getRange(1, 1, 1, headersLength);
  range.setFontWeight("bold").setBackground("#2C3E50").setFontColor("white").setHorizontalAlignment("center").setFontSize(12);
  sheet.setFrozenRows(1);
  for (let col = 1; col <= headersLength; col++) sheet.autoResizeColumn(col);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, headersLength);
    dataRange.setBackgrounds(
      dataRange.getValues().map((_, i) => Array(headersLength).fill(i % 2 === 0 ? "#F9F9F9" : "#FFFFFF"))
    );
  }
  enableSheetFilter(sheet, headersLength);
  sheet.deleteColumns(headersLength + 1, sheet.getMaxColumns() - headersLength);
  if (sheet.getLastRow() < sheet.getMaxRows()) {
    sheet.deleteRows(sheet.getLastRow() + 1, sheet.getMaxRows() - sheet.getLastRow());
  }
}

function enableSheetFilter(sheet, headersLength) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(1, 1, lastRow, headersLength).createFilter();
  }
}

// === FETCH REWARDS ===
function fetchRewards(token) {
  const sheet = getOrCreateSheet('Rewards');
  const headers = ['Date', 'Status', 'Ticker', 'Amount', 'Fiat Reward', 'Reward Rate', 'Description', 'Reward ID'];
  const allRewards = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `https://api.plutus.it/v3/rewards/list?limit=1000000&page=${page}`;
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const rewards = JSON.parse(res.getContentText()).data || [];
    if (!rewards.length) break;
    allRewards.push(...rewards);
    page++;
    if (rewards.length < pageSize) break;
  }

  const currency = getPreferredCurrency();
  const valid = ['approved', 'pending', 'rejected'];
  const filtered = allRewards.filter(r => r && valid.includes((r.status || '').toLowerCase()));

  const rows = filtered.map(r => [
    r.createdAt,
    r.status.toLowerCase(),
    r.ticker || '',
    r.amount || '',
    r.fiatAmountRewarded ? `${(r.fiatAmountRewarded / 100).toFixed(2)} ${currency}` : '',
    r.rewardRate || '',
    r.transactionDescription || '',
    r.id || ''
  ]);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  styleSheet(sheet, headers.length);
  highlightRewardStatuses(sheet, 2);
}

function highlightRewardStatuses(sheet, col) {
  const range = sheet.getRange(2, col, sheet.getLastRow() - 1);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('approved').setBackground('#DFF0D8').setFontColor('#3C763D').setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('pending').setBackground('#FCF8E3').setFontColor('#8A6D3B').setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('rejected').setBackground('#F2DEDE').setFontColor('#A94442').setRanges([range]).build()
  ];
  sheet.setConditionalFormatRules(rules);
}

function fetchTransactions(token) {
  const url = 'https://api.plutus.it/v3/statement/list?limit=1000000';
  const sheet = getOrCreateSheet('Transactions');
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const txs = JSON.parse(res.getContentText()).data || [];

  const currency = getPreferredCurrency();
  const headers = ['Date', 'Description', 'Type', 'Amount', 'Status', 'PLU', 'Transaction ID', 'MCC'];
  const rows = txs.map(tx => [
    tx.date,
    tx.cleanDescription || tx.transactionDescription || '',
    tx.type,
    tx.amount ? `${parseFloat(tx.amount).toFixed(2)} ${currency}` : '',
    tx.status,
    parseFloat(tx.totalPluAmount || 0),
    tx.id,
    tx.mcc || ''
  ]);

  sheet.clearContents();
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2,1,rows.length,headers.length).setValues(rows);
  styleSheet(sheet, headers.length);
  buildSpendingSummary(txs);
}

function fetchGiftcardOrders(token) {
  const url = 'https://api.plutus.it/v3/giftcard/orders/';
  const sheet = getOrCreateSheet('GiftcardOrders');
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const data = JSON.parse(res.getContentText()).data || [];

  const headers = ['Created', 'Status', 'Value', 'Used', 'Brand', 'Expires', 'URL'];
  const rows = data.map(g => [
    g.created_at,
    g.order_status,
    g.giftcard_value,
    g.used ? 'Yes' : 'No',
    g.brand?.name || '',
    g.giftcard_expiration || '',
    g.giftcard_url || ''
  ]);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  styleSheet(sheet, headers.length);
}

function fetchGiftcardCatalog(token) {
  const url = 'https://api.plutus.it/v3/giftcard/brands';
  const sheet = getOrCreateSheet('GiftcardCatalog');
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  const data = JSON.parse(res.getContentText()).data || [];

  const headers = ['Name', 'Countries', 'Categories', 'Currency', 'Denominations', 'Discount %', 'Expiry', 'Image URL'];
  const rows = data.map(card => [
    card.name,
    card.countries.join(', '),
    card.categories.join(', '),
    card.currency_code || '',
    (card.denominations || []).join(', '),
    card.discount_percentage || 0,
    card.expiry || 'N/A',
    card.gift_card_url || ''
  ]);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  styleSheet(sheet, headers.length);
  highlightGiftcardDiscounts(sheet);
}

function highlightGiftcardDiscounts(sheet) {
  const discountColumn = 6; // Column F = Discount %
  const range = sheet.getRange(2, discountColumn, sheet.getLastRow() - 1);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThanOrEqualTo(10)
      .setBackground('#b6ffb6')
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(5)
      .setBackground('#ffb6b6')
      .setRanges([range])
      .build()
  ];
  sheet.setConditionalFormatRules(rules);
}

function buildSpendingSummary(transactions) {
  const catMap = {};
  transactions.forEach(tx => {
    if (tx.type !== 'PAYOUT') return;
    const category = tx.mcc || 'Other';
    if (!catMap[category]) catMap[category] = { count: 0, total: 0, plu: 0 };
    catMap[category].count += 1;
    catMap[category].total += parseFloat(tx.amount);
    catMap[category].plu += parseFloat(tx.totalPluAmount || 0);
  });

  const sheet = getOrCreateSheet('SpendingSummary');
  const headers = ['MCC', 'Tx Count', 'Total Spent', 'PLU Earned'];
  const rows = Object.entries(catMap).map(([mcc, stats]) => [
    mcc, stats.count, stats.total, stats.plu
  ]);

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  styleSheet(sheet, headers.length);
}






function updateCurrencyDisplay() {
  const currency = getPreferredCurrency();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToCheck = ['Transactions', 'Rewards'];

  sheetsToCheck.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const range = sheet.getDataRange();
    const values = range.getValues();
    const newValues = values.map((row, i) => {
      if (i === 0) return row; // Skip header
      return row.map(cell => {
        if (typeof cell === 'string' && /\\d+(?:\\.\\d{1,2})? (EUR|GBP)/.test(cell)) {
          return cell.replace(/(EUR|GBP)$/, currency);
        }
        return cell;
      });
    });
    range.setValues(newValues);
  });
}

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  if (
    sheet.getName() === 'UserSettings' &&
    range.getA1Notation() === 'B1' // Currency cell
  ) {
    updateCurrencyDisplay();
  }
}


