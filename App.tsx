
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  Upload, 
  History, 
  PieChart as PieChartIcon, 
  Search,
  Sparkles,
  ChevronRight,
  Trash2,
  EyeOff,
  Tag,
  Zap,
  MoreVertical,
  RotateCw,
  Filter,
  Calendar,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Menu as MenuIcon
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid 
} from 'recharts';
import { Transaction, Category, AutoRule, RuleType } from './types';
import { formatCurrency, applyRulesToTransaction } from './utils';
import { getFinancialInsights } from './services/gemini';
import { uploadFileService } from './services/api';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [insights, setInsights] = useState<string>('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtering State
  const [filterType, setFilterType] = useState<'All' | 'Income' | 'Expense'>('All');
  const [filterSource, setFilterSource] = useState<'All' | 'Revolut' | 'Millennium' | 'XLSX' | 'Manual'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Manual Form State
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Food' as Category,
    type: 'Expense' as 'Expense' | 'Income',
    date: new Date().toISOString().split('T')[0]
  });

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Persistent Storage
  useEffect(() => {
    localStorage.setItem('ff_tx', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('ff_rules', JSON.stringify(autoRules));
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

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'All' || t.type === filterType;
        const matchesSource = filterSource === 'All' || t.source === filterSource;
        
        const txDate = new Date(t.date);
        txDate.setHours(0, 0, 0, 0);
        
        let matchesDate = true;
        if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0, 0, 0, 0);
          if (txDate < sDate) matchesDate = false;
        }
        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(0, 0, 0, 0);
          if (txDate > eDate) matchesDate = false;
        }

        return matchesSearch && matchesType && matchesSource && matchesDate;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions, searchTerm, filterType, filterSource, startDate, endDate]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const response = await uploadFileService(file, autoRules);
    setIsUploading(false);

    if (response.success && response.data) {
      setTransactions(prev => [...prev, ...response.data!]);
      setNotification({ type: 'success', message: response.message });
    } else {
      setNotification({ type: 'error', message: response.message });
    }
    
    e.target.value = '';
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
    setNotification({ type: 'success', message: 'Lançamento manual adicionado!' });
    setFormData({ ...formData, description: '', amount: '' });
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
    setNotification({ type: 'success', message: 'Regra de automação criada!' });
  };

  const clearFilters = () => {
    setFilterType('All');
    setFilterSource('All');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <LayoutDashboard size={24} />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">FinanciaFlow</h1>
      </div>

      <div className="space-y-1 flex-1">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'transactions', label: 'Transações', icon: History },
          { id: 'reports', label: 'Relatórios', icon: PieChartIcon },
          { id: 'categories', label: 'Categorias', icon: Tag },
        ].map((item) => (
          <button 
            key={item.id}
            onClick={() => {
              setActiveTab(item.id as any);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <item.icon size={20} /> {item.label}
          </button>
        ))}
      </div>

      <div className="pt-6 border-t border-slate-100 mt-auto">
        <div className="p-4 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl text-white shadow-lg">
          <p className="text-xs font-medium opacity-80 mb-1">Saldo Total</p>
          <p className="text-2xl font-bold">{formatCurrency(totals.income - totals.expense)}</p>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 relative overflow-x-hidden">
      {/* Notifications */}
      {notification && (
        <div className="fixed top-4 right-4 md:top-6 md:right-6 z-[100] animate-in slide-in-from-right-10 duration-300 w-[calc(100%-2rem)] md:w-auto">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
            notification.type === 'success' ? 'bg-white border-green-100 text-green-800' : 'bg-white border-rose-100 text-rose-800'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="text-green-500 flex-shrink-0" /> : <AlertCircle className="text-rose-500 flex-shrink-0" />}
            <span className="font-semibold text-sm">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-auto p-1 hover:bg-slate-100 rounded-full">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Top Header (Hamburger) */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
            <LayoutDashboard size={18} />
          </div>
          <span className="font-bold text-slate-900 tracking-tight">FinanciaFlow</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <MenuIcon size={24} />
        </button>
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 p-6 flex-col sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Sidebar - Mobile Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-300 md:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="fixed top-0 left-0 bottom-0 w-[280px] bg-white z-[60] p-6 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 ease-out md:hidden">
            <div className="flex justify-end mb-4">
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 capitalize">
              {activeTab === 'dashboard' ? 'Painel de Controle' : activeTab}
            </h2>
            <p className="text-slate-500 text-sm">Controle financeiro inteligente e simplificado.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange} 
              accept=".csv,.xlsx,.xls"
            />
            <button 
              onClick={handleUploadClick}
              disabled={isUploading}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-4 md:px-5 py-2.5 rounded-xl font-medium shadow-md hover:bg-slate-800 transition-all disabled:opacity-50 text-sm md:text-base"
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {isUploading ? 'Processando...' : 'Upload'}
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 md:px-5 py-2.5 rounded-xl font-medium shadow-md hover:bg-indigo-700 transition-all active:scale-95 text-sm md:text-base"
            >
              <Plus size={20} /> Novo Gasto
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {[
                { label: 'Entradas', value: totals.income, icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Saídas', value: totals.expense, icon: ArrowDownLeft, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Regras de IA', value: autoRules.length, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', isMoney: false },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                  <div className={`w-12 h-12 ${stat.bg} rounded-full flex items-center justify-center ${stat.color} flex-shrink-0`}>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <h3 className="font-bold text-slate-800 mb-6">Fluxo de Caixa Mensal</h3>
                <div className="h-[250px] md:h-[300px] w-full">
                  <div className="flex items-center justify-center h-full text-slate-400 italic text-sm bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    Nenhum dado mensal disponível
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-indigo-900 p-6 rounded-3xl text-white shadow-lg overflow-hidden">
                  <h3 className="font-bold flex items-center gap-2 mb-4">
                    <Sparkles size={18} className="text-indigo-300" /> Consultor IA
                  </h3>
                  {insights ? (
                    <div className="text-sm text-indigo-100 space-y-3 leading-relaxed max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {insights.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setLoadingInsights(true);
                        getFinancialInsights(transactions).then(res => {
                          setInsights(res);
                          setLoadingInsights(false);
                        });
                      }} 
                      disabled={loadingInsights || transactions.length === 0}
                      className="w-full py-3 bg-indigo-800 hover:bg-indigo-700 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loadingInsights ? <Loader2 size={14} className="animate-spin" /> : null}
                      {loadingInsights ? 'Analisando...' : 'Gerar Insights Financeiros'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            {/* Advanced Filters */}
            <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col xl:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar por descrição..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <div className="flex-1 md:flex-none flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 min-w-[120px]">
                    <Filter size={14} className="text-slate-400" />
                    <select 
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as any)}
                      className="bg-transparent border-none text-xs font-semibold text-slate-600 outline-none cursor-pointer w-full"
                    >
                      <option value="All">Todos Tipos</option>
                      <option value="Income">Entradas</option>
                      <option value="Expense">Saídas</option>
                    </select>
                  </div>
                  
                  <div className="flex-1 md:flex-none flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 min-w-[120px]">
                    <RotateCw size={14} className="text-slate-400" />
                    <select 
                      value={filterSource}
                      onChange={(e) => setFilterSource(e.target.value as any)}
                      className="bg-transparent border-none text-xs font-semibold text-slate-600 outline-none cursor-pointer w-full"
                    >
                      <option value="All">Todas Fontes</option>
                      <option value="Revolut">Revolut</option>
                      <option value="Millennium">Millennium</option>
                      <option value="XLSX">Excel/XLSX</option>
                      <option value="Manual">Manual</option>
                    </select>
                  </div>

                  <div className="w-full xl:w-auto flex flex-col md:flex-row md:items-center gap-2 md:gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border-none text-[10px] font-semibold text-slate-600 outline-none cursor-pointer"
                        title="Data Inicial"
                      />
                    </div>
                    <span className="hidden md:inline text-slate-300 text-xs">até</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent border-none text-[10px] font-semibold text-slate-600 outline-none cursor-pointer"
                      title="Data Final"
                    />
                  </div>

                  <button 
                    onClick={clearFilters}
                    className="ml-auto text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors underline underline-offset-4 pr-2"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Descrição</th>
                      <th className="px-6 py-4">Categoria</th>
                      <th className="px-6 py-4 text-right">Valor</th>
                      <th className="px-6 py-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map((tx) => (
                      <tr 
                        key={tx.id} 
                        className={`hover:bg-slate-50/80 transition-all group ${tx.ignored ? 'opacity-30 grayscale' : ''}`}
                      >
                        <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{tx.date.toLocaleDateString('pt-PT')}</td>
                        <td className="px-6 py-4 min-w-[180px]">
                          <div className="flex flex-col">
                            <p 
                              className="text-sm font-semibold text-slate-800 truncate cursor-help max-w-[200px]"
                              title={tx.description}
                            >
                              {tx.description}
                            </p>
                            <span className="text-[10px] text-slate-400 uppercase font-medium">{tx.source}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                            {tx.category}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm font-bold text-right whitespace-nowrap ${tx.type === 'Income' ? 'text-green-600' : 'text-slate-900'}`}>
                          {tx.type === 'Income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => toggleIgnore(tx.id)} 
                              title={tx.ignored ? "Restaurar" : "Ignorar transação"} 
                              className={`p-1.5 rounded-lg transition-colors ${tx.ignored ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-100'}`}
                            >
                              <EyeOff size={16} />
                            </button>
                            <div className="relative group/menu">
                              <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg"><MoreVertical size={16} /></button>
                              <div className="absolute right-0 bottom-full mb-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[70] hidden group-hover/menu:block p-1">
                                <button onClick={() => createRuleFromTx(tx, 'exact', 'category')} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 rounded-xl transition-colors">Categorizar todos iguais</button>
                                <button onClick={() => createRuleFromTx(tx, 'starts_with', 'category')} className="w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 rounded-xl transition-colors">Categorizar "começando com..."</button>
                                <div className="h-px bg-slate-100 my-1" />
                                <button onClick={() => createRuleFromTx(tx, 'starts_with', 'ignore')} className="w-full text-left px-4 py-2 text-xs font-bold hover:bg-rose-50 text-rose-500 rounded-xl transition-colors">Auto-ignorar similares</button>
                              </div>
                            </div>
                            <button 
                              onClick={() => setTransactions(prev => prev.filter(t => t.id !== tx.id))} 
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-24 text-center">
                          <div className="flex flex-col items-center gap-3 text-slate-400">
                            <History size={48} strokeWidth={1} />
                            <p className="italic text-sm">Nenhuma transação encontrada.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-in fade-in duration-500">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm h-fit">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2"><Tag size={20} /> Lista de Categorias</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {CATEGORIES.map((cat, i) => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium text-slate-700">{cat}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2"><Zap size={20} className="text-amber-500" /> Regras de Automação</h3>
                <button 
                  onClick={() => {
                    setAutoRules([]);
                    setNotification({ type: 'success', message: 'Todas as regras foram removidas.' });
                  }}
                  className="text-[10px] font-bold text-rose-500 hover:underline uppercase tracking-widest"
                >Limpar Tudo</button>
              </div>
              <div className="space-y-3 md:space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {autoRules.map(rule => (
                  <div key={rule.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate" title={rule.pattern}>{rule.pattern}</p>
                      <p className="text-[10px] text-slate-500 uppercase font-medium">
                        {rule.type === 'starts_with' ? 'Começa com' : 'Exato'} 
                        {rule.shouldIgnore ? ' → Ignorar' : ` → ${rule.targetCategory}`}
                      </p>
                    </div>
                    <button onClick={() => setAutoRules(prev => prev.filter(r => r.id !== rule.id))} className="text-slate-400 hover:text-rose-500 transition-colors flex-shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {autoRules.length === 0 && (
                  <div className="text-center py-12 text-slate-400 italic text-sm">Nenhuma regra definida.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-in fade-in duration-500">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-8 text-center">Distribuição de Gastos</h3>
              <div className="h-[300px] md:h-[350px]">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 italic text-sm bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    Nenhum dado para exibir
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <h3 className="font-bold text-slate-800 mb-8">Maiores Gastos por Categoria</h3>
              <div className="space-y-6">
                {categoryData.sort((a,b) => b.value - a.value).map((item, idx) => (
                  <div key={item.name} className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-600">{item.name}</span>
                      <span className="font-bold text-slate-900">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(item.value / totals.expense) * 100}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                    </div>
                  </div>
                ))}
                {categoryData.length === 0 && <p className="text-center text-slate-400 py-20 italic">Dados insuficientes para relatório.</p>}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
            {/* Header with Close Button */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Novo Lançamento</h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={addManualTransaction} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, type: 'Expense'})} 
                  className={`py-2 text-sm font-bold rounded-xl transition-all ${formData.type === 'Expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Saída
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, type: 'Income'})} 
                  className={`py-2 text-sm font-bold rounded-xl transition-all ${formData.type === 'Income' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Entrada
                </button>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                <input 
                  type="text" 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" 
                  placeholder="Ex: Aluguel, Supermercado..." 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Valor (€)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" 
                    value={formData.amount} 
                    onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Data</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" 
                    value={formData.date} 
                    onChange={(e) => setFormData({...formData, date: e.target.value})} 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                <div className="relative">
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm appearance-none" 
                    value={formData.category} 
                    onChange={(e) => setFormData({...formData, category: e.target.value as Category})}
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl mt-4 shadow-xl hover:bg-indigo-700 active:scale-95 transition-all text-sm tracking-wide"
              >
                Salvar Transação
              </button>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}} />
    </div>
  );
}
