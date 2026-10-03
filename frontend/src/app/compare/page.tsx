"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, MapPin, Building2, ChevronRight, Loader2, Plus, X, BarChart2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function Compare() {
  const [colleges, setColleges] = useState([]);
  const [selectedCodes, setSelectedCodes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState([]);

  const [category, setCategory] = useState('GOPENS');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE}/filters`).then(res => setCategories(res.data.categories)).catch(console.error);
  }, []);

  useEffect(() => {
    if (search.length > 2) {
      axios.get(`${API_BASE}/colleges`, { params: { search, limit: 10 } })
        .then(res => setColleges(res.data.results));
    } else {
      setColleges([]);
    }
  }, [search]);

  const addCollege = (c) => {
    if (selectedCodes.length < 4 && !selectedCodes.find(x => x.college_code === c.college_code)) {
      setSelectedCodes([...selectedCodes, c]);
    }
    setSearch('');
  };

  const removeCollege = (code) => {
    setSelectedCodes(selectedCodes.filter(c => c.college_code !== code));
  };

  const runComparison = async () => {
    if (selectedCodes.length === 0) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/compare`, {
        college_codes: selectedCodes.map(c => c.college_code),
        category: category,
        year: 2025,
        round_number: 3
      });
      setComparisonData(res.data.comparison);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-soft-bg py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto">
        
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">Compare Colleges</h1>
          <p className="text-text-secondary max-w-2xl text-lg">
            Create a premium comparison workspace. Select up to 4 colleges to compare historical cutoffs side-by-side.
          </p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-border mb-8">
          <div className="flex flex-col md:flex-row gap-8">
            
            {/* Selection Area */}
            <div className="flex-1 space-y-6">
              <div>
                <label className="block text-sm font-bold text-primary mb-2">Search & Add Colleges ({selectedCodes.length}/4)</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" placeholder="Start typing a college name..."
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-border focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all"
                    value={search} onChange={(e) => setSearch(e.target.value)} disabled={selectedCodes.length >= 4}
                  />
                  
                  {/* Dropdown Results */}
                  <AnimatePresence>
                    {colleges.length > 0 && search.length > 2 && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl border border-border overflow-hidden max-h-64 overflow-y-auto"
                      >
                        {colleges.map((c, i) => (
                          <button key={i} onClick={() => addCollege(c)}
                            className="w-full text-left px-5 py-3.5 hover:bg-soft-bg border-b border-border last:border-0 flex justify-between items-center transition-colors group"
                          >
                            <span className="text-sm font-semibold text-primary truncate pr-4 group-hover:text-electric-blue">{c.college_name}</span>
                            <Plus size={18} className="text-gray-400 group-hover:text-electric-blue" />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Selected Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence>
                  {selectedCodes.map(c => (
                    <motion.div key={c.college_code} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-electric-blue/30 shadow-sm p-4 rounded-xl flex justify-between items-start gap-4 relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-electric-blue"></div>
                      <div className="pl-2">
                        <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Code: {c.college_code}</div>
                        <div className="text-sm font-bold text-primary line-clamp-2 leading-snug">{c.college_name}</div>
                      </div>
                      <button onClick={() => removeCollege(c.college_code)} className="text-gray-400 hover:text-rose-500 bg-gray-50 hover:bg-rose-50 p-1.5 rounded-md transition-colors">
                        <X size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {selectedCodes.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 py-10 text-center flex flex-col items-center justify-center text-text-secondary border-2 border-dashed border-border rounded-xl bg-gray-50/50">
                    <Building2 className="mb-2 text-gray-300" size={32} />
                    <p className="font-medium">No colleges selected.</p>
                    <p className="text-sm">Search and select up to 4 colleges to compare.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="w-full md:w-72 flex flex-col justify-end space-y-6 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
              <div className="bg-soft-bg p-4 rounded-xl border border-border">
                <div className="flex gap-2 items-center text-sm font-bold text-primary mb-4">
                  <Info size={16} className="text-electric-blue"/> Settings
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Category</label>
                  <select 
                    value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-electric-blue outline-none text-sm bg-white"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              
              <button 
                onClick={runComparison} disabled={selectedCodes.length === 0 || loading}
                className="w-full bg-primary hover:bg-navy-800 disabled:opacity-50 text-white font-medium px-4 py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <><BarChart2 size={18} /> Generate Comparison</>}
              </button>
            </div>
          </div>
        </div>

        {/* Comparison Results Table */}
        {comparisonData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl border border-border overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="p-5 font-bold text-sm w-[250px] sticky left-0 z-10 bg-primary shadow-[1px_0_0_rgba(255,255,255,0.1)]">Branch Overview</th>
                    {selectedCodes.map(c => (
                      <th key={c.college_code} className="p-5 font-semibold min-w-[220px] border-l border-navy-700/50">
                        <div className="text-[10px] text-electric-blue font-bold uppercase tracking-widest mb-1">Code: {c.college_code}</div>
                        <div className="truncate text-sm leading-tight" title={c.college_name}>{c.college_name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Array.from(new Set(comparisonData.map(d => d.branch_name))).sort().map(branch => (
                    <tr key={branch} className="hover:bg-soft-bg/50 transition-colors">
                      <td className="p-5 text-sm font-bold text-primary sticky left-0 bg-white group-hover:bg-soft-bg/50 border-r border-border shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                        {branch}
                      </td>
                      {selectedCodes.map(c => {
                        const record = comparisonData.find(d => d.college_code === c.college_code && d.branch_name === branch);
                        return (
                          <td key={c.college_code} className="p-5">
                            {record ? (
                              <div>
                                <div className="text-xl font-extrabold text-primary mb-1">
                                  {record.percentile ? `${record.percentile.toFixed(3)}` : '-'} <span className="text-[10px] text-text-secondary font-medium">PERCENTILE</span>
                                </div>
                                <div className="text-xs font-medium text-text-secondary bg-gray-100 inline-block px-2 py-0.5 rounded">
                                  Rank: {record.merit_rank || 'N/A'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300 font-medium text-sm flex items-center gap-1">
                                <X size={14}/> Not offered
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-soft-bg border-t border-border flex justify-between items-center text-xs font-medium text-text-secondary">
              <span>Showing historically recorded cutoffs for the selected options.</span>
              <span className="bg-white px-3 py-1 rounded border border-border shadow-sm">
                Category: <strong className="text-primary">{category}</strong> &middot; Year: <strong>2025</strong> &middot; Round: <strong>3</strong>
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
