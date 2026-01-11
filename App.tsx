
import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  FileUp, 
  History, 
  PieChart as PieChartIcon, 
  Search,
  Sparkles,
  ChevronRight,
  Trash2,
  EyeOff,
  Settings,
  Tag,
  Zap,
  MoreVertical,
  RotateCw
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid 
} from 'recharts';
import { Transaction, Category, AutoRule, RuleType } from './types';
import { parseRevolutCSV, parseMillenniumCSV, parseGenericXLSX, formatCurrency, applyRulesToTransaction } from './utils';
import { getFinancialInsights } from './services/gemini';

const CATEGORIES: Category[] = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Utilities', 'Income', 'Education', 'Feira', 'Other'];
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#a855f7', '#94a3b8'];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('ff_tx');
    if (!saved) return [];
    try {
      return JSON.parse(saved).map((t: any) => ({ ...t, date: new Date(t.date) }));
    } catch { return []; }
  });

  const [autoRules, setAutoRules] = useState<AutoRule[]>(() => {
    const saved = localStorage.getItem('ff_rules');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'reports' | 'categories'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [insights, setInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Manual Form State
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Food' as Category,
    type: 'Expense' as 'Expense' | 'Income',
    date: new Date().toISOString().split('T')[0]
  });

  // Persistent Storage
  useEffect(() => {
    localStorage.setItem('ff_tx', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('ff_rules', JSON.stringify(autoRules));
    // When rules change, re-apply to all existing transactions
    setTransactions(prev => prev.map(t => applyRulesToTransaction(t, autoRules)));
  }, [autoRules]);

  const totals = useMemo(() => {
    return transactions.filter(t => !t.ignored).reduce((acc, t) => {
      if (t.type === 'Income') acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [transactions]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'Expense' && !t.ignored).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string, income: number, expense: number }> = {};
    transactions.filter(t => !t.ignored).forEach(t => {
      const monthYear = t.date.toLocaleString('default', { month: 'short' });
      if (!map[monthYear]) map[monthYear] = { month: monthYear, income: 0, expense: 0 };
      if (t.type === 'Income') map[monthYear].income += t.amount;
      else map[monthYear].expense += t.amount;
    });
    return Object.values(map).slice(-6);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions, searchTerm]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, source: 'Revolut' | 'Millennium' | 'XLSX') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (source === 'XLSX') {
      const parsed = await parseGenericXLSX(file);
      setTransactions(prev => [...prev, ...parsed.map(t => applyRulesToTransaction(t, autoRules))]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = source === 'Revolut' ? parseRevolutCSV(text) : parseMillenniumCSV(text);
      setTransactions(prev => [...prev, ...parsed.map(t => applyRulesToTransaction(t, autoRules))]);
    };
    reader.readAsText(file);
  };

  const addManualTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const newTx: Transaction = {
      id: `man-${Date.now()}`,
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category,
      type: formData.type,
      date: new Date(formData.date),
      source: 'Manual'
    };
    setTransactions(prev => [...prev, applyRulesToTransaction(newTx, autoRules)]);
    setIsModalOpen(false);
    setFormData({ ...formData, description: '', amount: '' });
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const toggleIgnore = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ignored: !t.ignored } : t));
  };

  const createRuleFromTx = (tx: Transaction, type: RuleType, action: 'category' | 'ignore') => {
    const newRule: AutoRule = {
      id: `rule-${Date.now()}`,
      pattern: tx.description,
      type: type,
      targetCategory: action === 'category' ? tx.category : undefined,
      shouldIgnore: action === 'ignore' ? true : undefined
    };
    setAutoRules(prev => [...prev, newRule]);
  };

  const fetchInsights = async () => {
    if (transactions.length === 0) return;
    setLoadingInsights(true);
    const res = await getFinancialInsights(transactions);
    setInsights(res);
    setLoadingInsights(false);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-white border-r border-slate-200 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <LayoutDashboard size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">FinanciaFlow</h1>
        </div>

        <div className="space-y-2 flex-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'transactions', label: 'Transactions', icon: History },
            { id: 'reports', label: 'Reports', icon: PieChartIcon },
            { id: 'categories', label: 'Categories', icon: Tag },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </div>

        <div className="pt-6 border-t border-slate-100 space-y-4">
          <div className="p-4 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <p className="text-xs font-medium opacity-80 mb-1">Total Balance</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.income - totals.expense)}</p>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h2>
            <p className="text-slate-500 text-sm">Managing your finances with intelligence.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-md hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Plus size={20} /> Add Expense
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Income', value: totals.income, icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Expenses', value: totals.expense, icon: ArrowDownLeft, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Rules Active', value: autoRules.length, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', isMoney: false },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                  <div className={`w-12 h-12 ${stat.bg} rounded-full flex items-center justify-center ${stat.color}`}>
                    <stat.icon size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                    <p className="text-xl font-bold text-slate-900">
                      {stat.isMoney === false ? stat.value : formatCurrency(stat.value as number)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(v) => `€${v}`} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="income" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FileUp size={18} /> Import Data
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {['Revolut', 'Millennium', 'XLSX'].map(s => (
                      <label key={s} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-indigo-50 cursor-pointer transition-all group">
                        <span className="text-sm font-medium text-slate-700">{s} File</span>
                        <ChevronRight size={16} className="text-slate-400" />
                        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFileUpload(e, s as any)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-indigo-900 p-6 rounded-3xl text-white shadow-lg">
                  <h3 className="font-bold flex items-center gap-2 mb-4">
                    <Sparkles size={18} className="text-indigo-300" /> AI Coach
                  </h3>
                  {insights ? (
                    <div className="text-sm text-indigo-100 space-y-3">{insights}</div>
                  ) : (
                    <button onClick={fetchInsights} className="w-full py-2 bg-indigo-800 hover:bg-indigo-700 rounded-xl text-xs font-bold uppercase tracking-widest">Generate Insights</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search description..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50">
                  <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} className={`hover:bg-slate-50 transition-colors group ${tx.ignored ? 'opacity-40 grayscale' : ''}`}>
                      <td className="px-6 py-4 text-sm text-slate-500">{tx.date.toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">{tx.description}</p>
                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{tx.source}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          {tx.category}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm font-bold text-right ${tx.type === 'Income' ? 'text-green-600' : 'text-slate-900'}`}>
                        {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => toggleIgnore(tx.id)} title="Ignore / Unignore" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                            <EyeOff size={16} />
                          </button>
                          <div className="relative group/menu">
                            <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><MoreVertical size={16} /></button>
                            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-10 hidden group-hover/menu:block">
                              <button onClick={() => createRuleFromTx(tx, 'exact', 'category')} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 border-b border-slate-50">Apply category to all exact matches</button>
                              <button onClick={() => createRuleFromTx(tx, 'starts_with', 'category')} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 border-b border-slate-50">Apply category to all starting with...</button>
                              <button onClick={() => createRuleFromTx(tx, 'starts_with', 'ignore')} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 text-rose-500">Auto-ignore all starting with...</button>
                            </div>
                          </div>
                          <button onClick={() => deleteTransaction(tx.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-fit">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Tag size={20} /> Categories List</h3>
              <div className="grid grid-cols-2 gap-4">
                {CATEGORIES.map((cat, i) => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium text-slate-700">{cat}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Zap size={20} className="text-amber-500" /> Auto-Rules</h3>
                <button 
                  onClick={() => setAutoRules([])}
                  className="text-[10px] font-bold text-rose-500 hover:underline uppercase tracking-widest"
                >Clear All</button>
              </div>
              <div className="space-y-4">
                {autoRules.map(rule => (
                  <div key={rule.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{rule.pattern}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-medium">
                        {rule.type === 'starts_with' ? 'Starts with' : 'Exact match'} 
                        {rule.shouldIgnore ? ' → Ignore' : ` → ${rule.targetCategory}`}
                      </p>
                    </div>
                    <button onClick={() => setAutoRules(prev => prev.filter(r => r.id !== rule.id))} className="text-slate-400 hover:text-rose-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {autoRules.length === 0 && (
                  <div className="text-center py-12 text-slate-400 italic text-sm">No rules defined yet. Add some from the transactions tab!</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-8">Spending Distribution</h3>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                      {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-8">Top Expense Categories</h3>
              <div className="space-y-6">
                {categoryData.sort((a,b) => b.value - a.value).map((item, idx) => (
                  <div key={item.name} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-600">{item.name}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(item.value / totals.expense) * 100}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">New Entry</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={addManualTransaction} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'Expense'})} className={`py-2 text-sm font-semibold rounded-lg transition-all ${formData.type === 'Expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>Expense</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'Income'})} className={`py-2 text-sm font-semibold rounded-lg transition-all ${formData.type === 'Income' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}>Income</button>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Description</label>
                <input type="text" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none" placeholder="Target, Rent, etc..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Amount (€)</label>
                  <input type="number" step="0.01" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Date</label>
                  <input type="date" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Category</label>
                <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value as Category})}>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mt-4 shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Save Entry</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
