import React, { useState, useEffect } from 'react';
import { Package, Loader2, Search, Edit, ShoppingCart } from 'lucide-react';
import { API_URL } from '../utils/Constants';

export default function StocksScreen({ onNavigateToDisbursement, onUseStock }) {
    const [disbursements, setDisbursements] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchDisbursements = async () => {
            try {
                const token = localStorage.getItem('fbtmcc_token');
                const res = await fetch(`${API_URL}/disbursements`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setDisbursements(data);
                }
            } catch (error) {
                console.error("Failed to fetch disbursements:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDisbursements();
    }, []);

    const stockRecords = disbursements.filter(d => d.stocks_amount && parseFloat(d.stocks_amount) > 0);

    const filteredRecords = stockRecords.filter(d => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return d.cv_no && d.cv_no.toLowerCase().includes(query);
    });

    return (
        <main className="flex-1 p-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-3">
                            <Package className="text-blue-600 dark:text-blue-500" size={32} />
                            Stock Monitoring
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                            Minimalist viewer for stock disbursements
                        </p>
                    </div>

                    <div className="relative w-full md:w-64">
                        <span className="absolute left-3 top-2.5 text-slate-400">
                            <Search size={18} />
                        </span>
                        <input
                            type="text"
                            placeholder="Search CV No..."
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white transition-colors shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </header>

                <section className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-800 dark:bg-slate-950 text-slate-200 uppercase text-xs font-black tracking-widest border-b-4 border-blue-500">
                                    <th className="px-6 py-4 whitespace-nowrap">CV #</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Invoice #</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Item Description</th>
                                    <th className="px-6 py-4 whitespace-nowrap text-right">Stocks Amount</th>
                                    <th className="px-6 py-4 whitespace-nowrap text-center w-40">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 gap-3">
                                                <Loader2 className="animate-spin" size={32} />
                                                <span className="font-bold uppercase tracking-wider text-sm">Loading Records...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-3">
                                                <Package size={48} className="opacity-50" />
                                                <span className="font-bold uppercase tracking-wider text-sm">No stock records found.</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((record, index) => (
                                        <tr
                                            key={record.id || index}
                                            className="even:bg-slate-50/80 dark:even:bg-slate-800/80 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors group"
                                        >
                                            <td className="px-6 py-4 font-black text-blue-700 dark:text-blue-400 border-r border-slate-100 dark:border-slate-700 w-32">
                                                {record.cv_no ? `#${record.cv_no}` : '-'}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-700 whitespace-nowrap uppercase">
                                                {record.or_inv_no || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-bold border-r border-slate-100 dark:border-slate-700 whitespace-normal break-words max-w-xs uppercase">
                                                {record.stock_description || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono font-black text-slate-900 dark:text-white w-48 border-r border-slate-100 dark:border-slate-700">
                                                ₱ {parseFloat(record.stocks_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4 text-center w-40">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => onNavigateToDisbursement && onNavigateToDisbursement(record.cv_no, record.id)}
                                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 font-bold text-xs rounded-lg transition-colors shadow-sm"
                                                        title="Edit Disbursement"
                                                    >
                                                        <Edit size={14} /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => onUseStock && onUseStock({
                                                            cv_no: record.cv_no,
                                                            stock_description: record.stock_description,
                                                            stocks_amount: parseFloat(record.stocks_amount)
                                                        })}
                                                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 dark:text-emerald-400 font-bold text-xs rounded-lg transition-colors shadow-sm border border-emerald-200 dark:border-emerald-800"
                                                        title="Allocate / Use this Stock"
                                                    >
                                                        <ShoppingCart size={14} /> Use Stock
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </main>
    );
}
