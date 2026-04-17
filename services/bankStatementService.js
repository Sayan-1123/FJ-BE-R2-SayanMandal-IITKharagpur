/**
 * Bank Statement Import Service
 * Parses CSV/PDF bank statements with duplicate detection
 */
const fs = require('fs');
const csv = require('csv-parser');
const crypto = require('crypto');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => results.push(row))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const normalizeCSVRow = (row) => {
  const keys = Object.keys(row).map((k) => k.toLowerCase().trim());
  const vals = Object.values(row);
  const mapped = {};
  keys.forEach((k, i) => { mapped[k] = vals[i]; });

  // Try to detect columns
  const dateKey = keys.find((k) => /date/i.test(k));
  const amountKey = keys.find((k) => /amount|value|sum/i.test(k));
  const descKey = keys.find((k) => /desc|narr|detail|memo|particular/i.test(k));
  const debitKey = keys.find((k) => /debit|withdrawal/i.test(k));
  const creditKey = keys.find((k) => /credit|deposit/i.test(k));

  let amount = 0;
  let type = 'expense';

  if (debitKey && creditKey) {
    const debit = parseFloat(mapped[debitKey]) || 0;
    const credit = parseFloat(mapped[creditKey]) || 0;
    if (credit > 0) { amount = credit; type = 'income'; }
    else { amount = debit; type = 'expense'; }
  } else if (amountKey) {
    amount = parseFloat(mapped[amountKey]) || 0;
    if (amount > 0) type = 'income';
    else { type = 'expense'; amount = Math.abs(amount); }
  }

  const dateStr = dateKey ? mapped[dateKey] : null;
  let date = null;
  if (dateStr) {
    date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Try DD/MM/YYYY format
      const parts = dateStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }
    if (isNaN(date.getTime())) date = new Date();
  } else {
    date = new Date();
  }

  return {
    date: date.toISOString().split('T')[0],
    amount: Math.abs(amount).toFixed(2),
    type,
    description: descKey ? mapped[descKey]?.trim() || '' : '',
  };
};

const generateImportHash = (row) => {
  const str = `${row.date}-${row.amount}-${row.type}-${row.description}`;
  return crypto.createHash('sha256').update(str).digest('hex');
};

const processCSVFile = async (filePath) => {
  const rawRows = await parseCSV(filePath);
  return rawRows.map((row) => {
    const normalized = normalizeCSVRow(row);
    normalized.import_hash = generateImportHash(normalized);
    return normalized;
  }).filter((r) => r.amount > 0);
};

const processPDFFile = async (filePath) => {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    const lines = data.text.split('\n').filter((l) => l.trim());
    
    const transactions = [];
    const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/;
    const amountRegex = /[\$€£₹]?\s*[\d,]+\.?\d{0,2}/g;

    for (const line of lines) {
      const dateMatch = line.match(dateRegex);
      const amountMatches = line.match(amountRegex);
      if (dateMatch && amountMatches) {
        const amountStr = amountMatches[amountMatches.length - 1].replace(/[\$€£₹,\s]/g, '');
        const amount = parseFloat(amountStr);
        if (amount > 0) {
          const desc = line.replace(dateRegex, '').replace(amountRegex, '').trim();
          const tx = {
            date: new Date(dateMatch[1]).toISOString().split('T')[0],
            amount: amount.toFixed(2),
            type: 'expense',
            description: desc.substring(0, 500),
          };
          tx.import_hash = generateImportHash(tx);
          transactions.push(tx);
        }
      }
    }
    return transactions;
  } catch (err) {
    console.error('PDF parse error:', err.message);
    return [];
  }
};

module.exports = { processCSVFile, processPDFFile, generateImportHash };
