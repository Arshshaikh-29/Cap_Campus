"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line } from 'recharts';
import { Search, Loader2, TrendingUp, BarChart3, Building2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function Analytics() {
  const [search, setSearch] = useState('');
  const [colleges, setColleges] = useState<any[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<any>(null);
  
  const [category, setCategory] = useState('GOPENS');
  const [branch, setBranch] = useState('');
  
  const [globalFilters, setGlobalFilters] = useState({ categories: [], branches: [] });
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/filters`).then(res => setGlobalFilters(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (search.length > 2) {
      axios.get(`${API_BASE}/colleges`, { params: { search, limit: 8 } })
        .then(res => setColleges(res.data.results));
    } else {
      setColleges([]);
    }
  }, [search]);
  
  // Fetch college details to get available branches when a college is selected
  useEffect(() => {
    if (selectedCollege) {
      axios.get(`${API_BASE}/colleges/${selectedCollege.college_code}`)
        .then(res => {
          const branches = res.data.branches || [];
          setAvailableBranches(branches);
          if (branches.length > 0 && !branches.includes(branch)) {
            setBranch(branches[0]);
          }
        })
        .catch(console.error);
    } else {
      setAvailableBranches(globalFilters.branches);
    }
  }, [selectedCollege]);

  useEffect(() => {
    if (selectedCollege && branch && category) {
      setLoading(true);
      axios.get(`${API_BASE}/analytics/cutoffs`, {
        params: { college_code: selectedCollege.college_code, branch, category }
      })
      .then(res => {
        const trends = res.data.trends.map((t: any) => ({
          name: `20${String(t.year).slice(-2)} R${t.round_number}`,
          percentile: t.percentile || 0,
          rank: t.merit_rank || 0,
          year: t.year,
          round: t.round_number
        }));
        setAnalyticsData(trends);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    }
  }, [selectedCollege, branch, category]);

  return (
    <div className="flex-1 w-full bg-soft-bg py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-3">Cutoff Analytics</h1>
          <p className="text-text-secondary text-lg">Analyze historical admission trends and closing ranks over time.</p>
        </div>

        {/* Global Controls */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border flex flex-col md:flex-row gap-6 items-end relative z-20">
          
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Target Institution</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" placeholder="Search college..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-border focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all text-primary font-medium"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
              <AnimatePresence>
                {colleges.length > 0 && search.length > 2 && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                    className="absolute w-full mt-2 bg-white rounded-xl shadow-xl border border-border overflow-hidden"
                  >
                    {colleges.map((c, i) => (
                      <button key={i} onClick={() => { setSelectedCollege(c); setSearch(''); setColleges([]); }}
                        className="w-full text-left px-5 py-3 hover:bg-soft-bg border-b border-border last:border-0 truncate text-sm font-semibold text-primary"
                      >
                        {c.college_name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="w-full md:w-64">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Branch</label>
            <select 
              value={branch} onChange={(e) => setBranch(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-electric-blue outline-none text-sm font-medium bg-white"
            >
              {availableBranches.map((b: any) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="w-full md:w-48">
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Category</label>
            <select 
              value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border focus:border-electric-blue outline-none text-sm font-medium bg-white"
            >
              {globalFilters.categories.map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Dashboard Panels */}
        {!selectedCollege ? (
          <div className="bg-white border border-border rounded-2xl p-24 text-center shadow-sm">
            <BarChart3 className="mx-auto text-gray-300 mb-4" size={48} strokeWidth={1.5} />
            <h3 className="text-xl font-bold text-primary mb-2">Awaiting Selection</h3>
            <p className="text-text-secondary">Search and select an institution to visualize its historical cutoffs.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            
            <div className="bg-primary text-white p-6 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 w-64 h-full bg-electric-blue/20 blur-3xl transform translate-x-1/2"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-electric-blue font-bold text-xs uppercase tracking-wider mb-2">
                  <Building2 size={14} /> {selectedCollege.college_code} &middot; {selectedCollege.city}
                </div>
                <h2 className="text-2xl font-bold">{selectedCollege.college_name}</h2>
                <div className="flex items-center gap-2 text-gray-300 mt-2 text-sm">
                  <BookOpen size={16} /> {branch} &middot; {category}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Line Chart Panel */}
              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-primary text-lg">Percentile Trajectory</h3>
                  <TrendingUp className="text-text-secondary" size={20} />
                </div>
                {loading ? <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-electric-blue" /></div> : 
                  analyticsData.length === 0 ? <div className="flex-1 flex justify-center items-center text-text-secondary text-sm">No data available for this combination.</div> :
                  (
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3978F6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3978F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecf0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#667085' }} dy={10} />
                        <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#667085' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: '1px solid #eaecf0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ color: '#101828', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="percentile" stroke="#3978F6" strokeWidth={3} fill="url(#colorPct)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Bar Chart Panel */}
              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-primary text-lg">Merit Rank Movement</h3>
                  <BarChart3 className="text-text-secondary" size={20} />
                </div>
                {loading ? <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-electric-blue" /></div> : 
                  analyticsData.length === 0 ? <div className="flex-1 flex justify-center items-center text-text-secondary text-sm">No data available for this combination.</div> :
                  (
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData} margin={{ top: 5, right: 0, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecf0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#667085' }} dy={10} />
                        <YAxis domain={[0, 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#667085' }} reversed />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: '1px solid #eaecf0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          cursor={{ fill: '#F6F8FC' }}
                        />
                        <Bar dataKey="rank" fill="#173B70" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-4 text-center text-[10px] uppercase font-bold text-text-secondary tracking-widest">
                  Lower rank is better (Y-Axis reversed)
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
