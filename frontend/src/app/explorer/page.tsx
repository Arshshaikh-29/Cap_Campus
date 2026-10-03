"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, MapPin, ChevronRight, Loader2, Filter, X, ArrowUpDown } from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function Explorer() {
  const [colleges, setColleges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<any>({ cities: [], branches: [] });
  const [cityFilter, setCityFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const fetchColleges = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/colleges`, {
        params: { search, city: cityFilter, branch: branchFilter, limit: 100 }
      });
      setColleges(res.data.results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios.get(`${API_BASE}/filters`).then(res => setFilters(res.data)).catch(console.error);
    fetchColleges();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchColleges();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search, cityFilter, branchFilter]);

  const clearFilters = () => {
    setCityFilter('');
    setBranchFilter('');
    setSearch('');
  };

  return (
    <div className="flex-1 w-full bg-soft-bg py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Left Sidebar Filters */}
        <div className="w-full lg:w-72 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-border sticky top-24">
            <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
              <h2 className="font-bold text-primary flex items-center gap-2">
                <Filter size={18} /> Filters
              </h2>
              {(cityFilter || branchFilter || search) && (
                <button onClick={clearFilters} className="text-xs font-semibold text-electric-blue hover:text-primary">Clear all</button>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" placeholder="College name or code"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none text-sm"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">City</label>
                <select 
                  value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-electric-blue outline-none text-sm bg-white"
                >
                  <option value="">All Cities</option>
                  {filters.cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">Branch</label>
                <select 
                  value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border focus:border-electric-blue outline-none text-sm bg-white"
                >
                  <option value="">All Branches</option>
                  {filters.branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-1">College Explorer</h1>
              <p className="text-text-secondary text-sm">Discover and research {colleges.length} engineering colleges across Maharashtra.</p>
            </div>
            <button className="hidden sm:flex bg-white border border-border text-primary px-4 py-2 rounded-lg items-center gap-2 font-medium text-sm hover:bg-gray-50">
              <ArrowUpDown size={16} /> Sort by Name
            </button>
          </div>

          {/* Active Filter Chips */}
          {(cityFilter || branchFilter) && (
            <div className="flex flex-wrap gap-2 mb-6">
              {cityFilter && (
                <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                  City: {cityFilter} <button onClick={() => setCityFilter('')}><X size={12}/></button>
                </span>
              )}
              {branchFilter && (
                <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                  Branch: {branchFilter} <button onClick={() => setBranchFilter('')}><X size={12}/></button>
                </span>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-32 text-electric-blue">
              <Loader2 className="animate-spin" size={40} />
            </div>
          ) : colleges.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {colleges.map((c, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-electric-blue/40 transition-all flex flex-col group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-soft-bg text-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                      Code {c.college_code}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-primary mb-4 flex-1 group-hover:text-electric-blue transition-colors line-clamp-2">
                    {c.college_name}
                  </h3>
                  <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
                    <div className="flex items-center gap-1.5 text-text-secondary text-sm font-medium">
                      <MapPin size={16} className="text-electric-blue" /> {c.city}
                    </div>
                    <a href={`/college/${c.college_code}`} className="text-gray-300 group-hover:text-electric-blue transition-colors">
                      <ChevronRight size={18} />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl p-16 text-center shadow-sm">
              <Search className="mx-auto text-gray-300 mb-4" size={48} />
              <h3 className="text-xl font-bold text-primary mb-2">No colleges found</h3>
              <p className="text-text-secondary">Try adjusting your filters or search query.</p>
              <button onClick={clearFilters} className="mt-6 bg-primary text-white px-6 py-2 rounded-lg font-medium">Clear All Filters</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
