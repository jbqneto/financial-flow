
export type Category = 
  | 'Food' | 'Transport' | 'Shopping' | 'Entertainment' 
  | 'Health' | 'Utilities' | 'Income' | 'Education' | 'Feira' | 'Other';

export interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  category: Category;
  source: 'Manual' | 'Revolut' | 'Millennium' | 'XLSX';
  type: 'Expense' | 'Income';
  ignored?: boolean;
}

export type RuleType = 'exact' | 'starts_with';

export interface AutoRule {
  id: string;
  pattern: string;
  type: RuleType;
  targetCategory?: Category;
  shouldIgnore?: boolean;
}

export interface SpendingSummary {
  category: Category;
  amount: number;
}
