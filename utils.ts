import { Transaction, Category, AutoRule } from './types';
import * as XLSX from 'xlsx';

const DEFAULT_CATEGORY_MAP: Record<string, Category> = {
  'uber': 'Transport',
  'bolt': 'Transport',
  'continente': 'Food',
  'pingo doce': 'Food',
  'lidl': 'Food',
  'auchan': 'Food',
  'netflix': 'Entertainment',
  'spotify': 'Entertainment',
  'amazon': 'Shopping',
  'zara': 'Shopping',
  'ikea': 'Shopping',
  'edp': 'Utilities',
  'galp': 'Utilities',
  'vodafone': 'Utilities',
  'salary': 'Income',
  'vencimento': 'Income',
  'refeicao': 'Income',
};

export const applyRulesToTransaction = (tx: Transaction, rules: AutoRule[]): Transaction => {
  const desc = tx.description.toLowerCase();
  
  // 1. Check User Defined Rules
  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    const match = rule.type === 'exact' 
      ? desc === pattern 
      : desc.startsWith(pattern);

    if (match) {
      return {
        ...tx,
        category: rule.targetCategory || tx.category,
        ignored: rule.shouldIgnore !== undefined ? rule.shouldIgnore : tx.ignored
      };
    }
  }

  // 2. Check Default Map (if not already categorized by user)
  if (tx.category === 'Other') {
    for (const [key, category] of Object.entries(DEFAULT_CATEGORY_MAP)) {
      if (desc.includes(key)) return { ...tx, category };
    }
  }

  return tx;
};

export const parseRevolutCSV = (text: string): Transaction[] => {
  const lines = text.split('\n');
  const transactions: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 6) continue;
    const amount = parseFloat(cols[5]);
    const dateStr = cols[3] || cols[2];
    const desc = cols[4].replace(/"/g, '');
    if (isNaN(amount)) continue;
    transactions.push({
      id: `rev-${i}-${Date.now()}`,
      date: new Date(dateStr),
      description: desc,
      amount: Math.abs(amount),
      category: 'Other',
      source: 'Revolut',
      type: amount < 0 ? 'Expense' : 'Income',
    });
  }
  return transactions;
};

export const parseMillenniumCSV = (text: string): Transaction[] => {
  const lines = text.split('\n');
  const transactions: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 5) continue;
    const dateStr = cols[0];
    const desc = cols[2];
    const debit = parseFloat(cols[3]?.replace(',', '.') || '0');
    const credit = parseFloat(cols[4]?.replace(',', '.') || '0');
    if (!dateStr || isNaN(debit + credit)) continue;
    const [day, month, year] = dateStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    transactions.push({
      id: `mil-${i}-${Date.now()}`,
      date,
      description: desc,
      amount: debit > 0 ? debit : credit,
      category: 'Other',
      source: 'Millennium',
      type: debit > 0 ? 'Expense' : 'Income',
    });
  }
  return transactions;
};

export const parseGenericXLSX = async (file: File): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);
        
        // Added explicit return type Transaction to map callback to fix literal widening error (string vs Category)
        const transactions: Transaction[] = json.map((row, i): Transaction => {
          // Attempt to find keys for Date, Desc, Amount
          const keys = Object.keys(row);
          const dateKey = keys.find(k => k.toLowerCase().includes('data') || k.toLowerCase().includes('date')) || keys[0];
          const descKey = keys.find(k => k.toLowerCase().includes('desc') || k.toLowerCase().includes('info')) || keys[1];
          const amountKey = keys.find(k => k.toLowerCase().includes('val') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('quant')) || keys[2];

          const amount = parseFloat(String(row[amountKey]).replace(',', '.'));
          return {
            id: `xls-${i}-${Date.now()}`,
            date: new Date(row[dateKey]),
            description: String(row[descKey]),
            amount: Math.abs(amount),
            category: 'Other',
            source: 'XLSX',
            type: amount < 0 ? 'Expense' : 'Income',
          };
        }).filter(t => !isNaN(t.amount) && t.description);
        
        resolve(transactions);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsBinaryString(file);
  });
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
};