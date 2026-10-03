"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, Search, MapPin, Building2, ChevronRight, CheckCircle2, 
  BarChart3, Compass, Crosshair, BookOpen, AlertCircle, Download, ExternalLink, Bookmark
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function Home() {
  const [step, setStep] = useState(1);
  const [filters, setFilters] = useState({ categories: [], branches: [], cities: [] });
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [predictionMode, setPredictionMode] = useState('percentile');
  const [apiError, setApiError] = useState('');
  const [fallbackUsed, setFallbackUsed] = useState(false);
  
  const [form, setForm] = useState({
    percentile: '',
    rank: '',
    category: 'GOPENS',
    gender: 'All',
    candidature: 'Maharashtra State',
    branch: '',
    city: '',
    collegeType: 'All',
    round: 'All'
  });

  useEffect(() => {
    axios.get(`${API_BASE}/filters`)
      .then(res => { setFilters(res.data); setApiError(''); })
      .catch(() => setApiError('Cannot reach the CAP Compass API. Make sure the backend is running.'));
  }, []);

  const handlePredict = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        percentile: predictionMode === 'percentile' && form.percentile ? parseFloat(form.percentile) : null,
        rank: predictionMode === 'rank' && form.rank ? parseFloat(form.rank) : null,
        category: form.category,
        branch: form.branch || null,
        city: form.city || null
      };
      
      const res = await axios.post(`${API_BASE}/predict`, payload);
      setPredictions(res.data.predictions || []);
      setFallbackUsed(!!res.data.fallback_used);
      setApiError('');
      setStep(4);
    } catch (err: any) {
      console.error(err);
      setApiError(err?.response
        ? `Prediction failed: ${err.response.data?.detail || err.response.statusText}`
        : 'Cannot reach the CAP Compass API. Make sure the backend is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const dashboardData = [
    { name: 'R1', value: 92 }, { name: 'R2', value: 94 }, { name: 'R3', value: 96 }
  ];

  return (
    <div className="w-full flex-1 flex flex-col bg-soft-bg">
      
      {/* LANDING PAGE HERO */}
      {step === 1 && (
        <>
          <section className="relative overflow-hidden bg-white border-b border-border">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #3978F6 0%, transparent 50%)' }} />
            
            <div className="max-w-7xl mx-auto px-6 py-24 md:py-32 grid lg:grid-cols-2 gap-16 items-center relative z-10">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <span className="text-sm font-bold tracking-widest text-text-secondary uppercase mb-4 block">
                  Maharashtra Engineering Admissions
                </span>
                <h1 className="text-5xl md:text-6xl font-bold text-primary tracking-tight leading-[1.1] mb-6">
                  Your CET Score.<br/>
                  <span className="text-electric-blue">Your College Possibilities.</span>
                </h1>
                <p className="text-lg text-text-secondary mb-10 leading-relaxed max-w-lg">
                  Navigate Maharashtra engineering admissions with data-driven college discovery, historical cutoff insights, and personalized CAP counselling support.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => setStep(2)} className="bg-primary hover:bg-navy-800 text-white font-medium px-8 py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                    Find My Colleges <ArrowRight size={18} />
                  </button>
                  <a href="/explorer" className="bg-white hover:bg-gray-50 text-primary border border-border font-medium px-8 py-4 rounded-xl flex items-center justify-center transition-all">
                    Explore Colleges
                  </a>
                </div>
                <p className="text-xs text-text-secondary mt-6 font-medium">Built for MHT-CET aspirants &middot; Updated for 2025 Data</p>
              </motion.div>

              {/* Sophisticated Dashboard Preview */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
                className="relative hidden lg:block"
              >
                <div className="bg-white rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4 relative z-10 w-full max-w-lg ml-auto">
                  <div className="flex justify-between items-center pb-4 border-b border-border">
                    <div>
                      <div className="text-xs text-text-secondary font-medium mb-1">Your Score</div>
                      <div className="text-2xl font-bold text-primary">96.8420 %ile</div>
                    </div>
                    <div className="bg-success/10 text-success px-3 py-1 rounded-full text-xs font-bold">Strong Match</div>
                  </div>
                  
                  <div className="space-y-3 mt-2">
                    <div className="flex justify-between items-center p-3 rounded-xl border border-border hover:border-electric-blue/50 transition-colors bg-soft-bg/50">
                      <div>
                        <div className="font-bold text-sm text-primary">VJTI Mumbai</div>
                        <div className="text-xs text-text-secondary">Computer Eng</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">99.42 %ile</div>
                        <div className="text-[10px] font-bold text-warning">Ambitious</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl border border-electric-blue/30 bg-electric-blue/5 shadow-sm">
                      <div>
                        <div className="font-bold text-sm text-primary">COEP Pune</div>
                        <div className="text-xs text-text-secondary">Electrical Eng</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">96.12 %ile</div>
                        <div className="text-[10px] font-bold text-success">Within Range</div>
                      </div>
                    </div>
                  </div>

                  <div className="h-32 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboardData}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3978F6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3978F6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#3978F6" fillOpacity={1} fill="url(#colorValue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -top-6 -right-6 w-24 h-24 bg-electric-blue/10 rounded-full blur-2xl"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-warning/10 rounded-full blur-3xl"></div>
              </motion.div>
            </div>
          </section>

          {/* TRUST & VALUE SECTION */}
          <section className="bg-soft-bg py-20 border-b border-border">
            <div className="max-w-7xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {[
                  { icon: Crosshair, title: "01 — Personalized College Discovery", desc: "Input your exact scores to find deeply relevant college options." },
                  { icon: BarChart3, title: "02 — Historical Cutoff Intelligence", desc: "Analyze past trends to understand round-wise closing ranks." },
                  { icon: MapPin, title: "03 — City & Branch Exploration", desc: "Filter across the entire state based on your precise preferences." },
                  { icon: BookOpen, title: "04 — Informed CAP Planning", desc: "Build a data-backed preference list for your CAP rounds." }
                ].map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <item.icon className="text-electric-blue mb-4" strokeWidth={1.5} size={28} />
                    <h3 className="font-bold text-primary mb-2 text-sm">{item.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* MULTI-STEP WIZARD (Steps 2, 3) */}
      {(step === 2 || step === 3) && (
        <div className="flex-1 flex items-center justify-center py-12 px-6">
          <div className="w-full max-w-3xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-primary mb-3">Find colleges that match your score.</h2>
              <p className="text-text-secondary">Enter your details to explore historical admission possibilities.</p>
            </div>

            {apiError && (
              <div id="api-error-banner" className="mb-6 flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm font-medium">
                <AlertCircle size={18} className="mt-0.5 shrink-0" /> {apiError}
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-border flex flex-col md:flex-row overflow-hidden min-h-[500px]">
              
              {/* Left Sidebar Steps */}
              <div className="w-full md:w-64 bg-soft-bg border-b md:border-b-0 md:border-r border-border p-8">
                <nav className="space-y-8">
                  {[
                    { s: 2, label: 'Exam Details', sub: '01' },
                    { s: 2, label: 'Admission Profile', sub: '02' },
                    { s: 3, label: 'College Preferences', sub: '03' },
                    { s: 4, label: 'Your Results', sub: '04' }
                  ].map((item, i) => (
                    <div key={i} className={`flex items-start gap-4 ${step === item.s ? 'opacity-100' : step > item.s ? 'opacity-70' : 'opacity-40'}`}>
                      <div className="mt-0.5">
                        {step > item.s ? <CheckCircle2 size={18} className="text-success" /> : <div className={`w-4 h-4 rounded-full border-2 ${step === item.s ? 'border-electric-blue bg-white' : 'border-text-secondary'}`} />}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-text-secondary mb-0.5">{item.sub}</div>
                        <div className={`text-sm font-semibold ${step === item.s ? 'text-primary' : 'text-text-secondary'}`}>{item.label}</div>
                      </div>
                    </div>
                  ))}
                </nav>
              </div>

              {/* Right Form Area */}
              <div className="flex-1 p-8 md:p-12 relative">
                <form onSubmit={step === 3 ? handlePredict : (e) => { e.preventDefault(); setStep(3); }} className="h-full flex flex-col">
                  <AnimatePresence mode="wait">
                    
                    {step === 2 && (
                      <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8 flex-1">
                        <div>
                          <h3 className="text-xl font-bold text-primary mb-6">Exam & Profile</h3>
                          
                          <div className="space-y-6">
                            
                            <div className="flex p-1 bg-soft-bg rounded-xl border border-border">
                              <button type="button" onClick={() => setPredictionMode('percentile')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${predictionMode === 'percentile' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary'}`}>
                                By Percentile
                              </button>
                              <button type="button" onClick={() => setPredictionMode('rank')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${predictionMode === 'rank' ? 'bg-white text-primary shadow-sm' : 'text-text-secondary'}`}>
                                By State Rank
                              </button>
                            </div>
                            
                            {predictionMode === 'percentile' ? (
                              <div>
                                <label className="block text-sm font-semibold text-primary mb-2">MHT-CET Percentile <span className="text-warning">*</span></label>
                                <input 
                                  type="number" step="0.0000001" min="0" max="100" required={predictionMode === 'percentile'}
                                  value={form.percentile} onChange={(e) => setForm({...form, percentile: e.target.value})}
                                  className="w-full text-lg px-4 py-3 rounded-xl border border-border focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all placeholder:text-gray-300"
                                  placeholder="95.5000000"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-sm font-semibold text-primary mb-2">State Merit Rank <span className="text-warning">*</span></label>
                                <input 
                                  type="number" min="1" required={predictionMode === 'rank'}
                                  value={form.rank} onChange={(e) => setForm({...form, rank: e.target.value})}
                                  className="w-full text-lg px-4 py-3 rounded-xl border border-border focus:border-electric-blue focus:ring-1 focus:ring-electric-blue outline-none transition-all placeholder:text-gray-300"
                                  placeholder="e.g. 15430"
                                />
                              </div>
                            )}
                            
                            <div>
                              <label className="block text-sm font-semibold text-primary mb-2">Category <span className="text-warning">*</span></label>
                              <select 
                                value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-border focus:border-electric-blue outline-none bg-white"
                              >
                                {filters.categories.map((c: any) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {step === 3 && (
                      <motion.div key="step3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8 flex-1">
                        <div>
                          <h3 className="text-xl font-bold text-primary mb-6">Preferences</h3>
                          
                          <div className="space-y-6">
                            <div>
                              <label className="block text-sm font-semibold text-primary mb-2">Preferred Branch</label>
                              <select 
                                value={form.branch} onChange={(e) => setForm({...form, branch: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-border focus:border-electric-blue outline-none bg-white"
                              >
                                <option value="">Any Branch</option>
                                {filters.branches.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-semibold text-primary mb-2">Preferred City</label>
                              <select 
                                value={form.city} onChange={(e) => setForm({...form, city: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-border focus:border-electric-blue outline-none bg-white"
                              >
                                <option value="">Any City</option>
                                {filters.cities.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>

                  <div className="pt-8 mt-auto flex justify-between items-center border-t border-border">
                    {step === 3 ? (
                      <button type="button" onClick={() => setStep(2)} className="text-text-secondary hover:text-primary font-medium px-4 py-2">
                        Back
                      </button>
                    ) : <div></div>}
                    <button 
                      type="submit" disabled={loading}
                      className="bg-primary hover:bg-navy-800 disabled:opacity-70 text-white font-medium px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-sm"
                    >
                      {loading ? 'Processing...' : step === 2 ? 'Continue' : 'Discover My Colleges'}
                      {!loading && <ArrowRight size={16} />}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS DASHBOARD (Step 4) */}
      {step === 4 && (
        <div className="flex-1 w-full bg-soft-bg py-12 px-6">
          <div className="max-w-7xl mx-auto space-y-8">
            
            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold text-primary mb-2">Your College Discovery Report</h1>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="bg-white border border-border px-3 py-1 rounded-full font-medium text-primary">
                    {predictionMode === 'percentile' ? `Score: ${form.percentile} %ile` : `Rank: ${form.rank}`}
                  </span>
                  <span className="bg-white border border-border px-3 py-1 rounded-full font-medium text-primary">Cat: {form.category}</span>
                  {form.branch && <span className="bg-white border border-border px-3 py-1 rounded-full font-medium text-primary">{form.branch}</span>}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="bg-white border border-border text-primary font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                  Edit Profile
                </button>
                <button className="bg-primary text-white font-medium px-4 py-2 rounded-lg hover:bg-navy-800 transition-colors flex items-center gap-2">
                  <Download size={16} /> Export PDF
                </button>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['Historically Within Range', 'Moderate', 'Ambitious'].map(type => {
                const count = predictions.filter(p => p.prediction_category === type).length;
                const colors = type === 'Historically Within Range' ? 'text-success' : type === 'Moderate' ? 'text-warning' : 'text-electric-blue';
                return (
                  <div key={type} className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                    <div className="text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">{type}</div>
                    <div className={`text-4xl font-extrabold ${colors}`}>{count}</div>
                  </div>
                )
              })}
            </div>

            {fallbackUsed && (
              <div className="flex items-start gap-3 bg-warning/10 border border-warning/30 text-primary rounded-xl p-4 text-sm">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-warning" />
                No course was within reach for this exact filter, so these are the closest options. Try removing the branch or city filter to see more.
              </div>
            )}

            {/* College List */}
            <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="p-6 border-b border-border bg-gray-50/50">
                <h3 className="font-bold text-primary">All Matching Institutions</h3>
              </div>
              <div className="divide-y divide-border">
                {predictions.length > 0 ? predictions.map((p, i) => {
                  const isAmbitious = p.prediction_category === 'Ambitious';
                  const isMod = p.prediction_category === 'Moderate';
                  const marginIsGood = p.prediction_category === 'Historically Within Range';
                  
                  return (
                    <div key={i} className="p-6 hover:bg-soft-bg/50 transition-colors flex flex-col md:flex-row justify-between gap-6 group">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider
                            ${isAmbitious ? 'bg-electric-blue/10 text-electric-blue' : isMod ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                            {p.prediction_category}
                          </span>
                          <span className="text-xs font-medium text-text-secondary">Code: {p.college_code}</span>
                        </div>
                        <h4 className="text-lg font-bold text-primary mb-2 group-hover:text-electric-blue transition-colors">
                          {p.college_name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
                          <span className="flex items-center gap-1"><MapPin size={14} /> {p.city}</span>
                          <span className="flex items-center gap-1"><BookOpen size={14} /> {p.branch}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${p.is_estimate ? 'bg-warning/10 text-warning' : 'bg-gray-100 text-primary'}`}
                            title={p.is_estimate ? `No ${form.category} cutoff published for this course; estimated from the ${p.basis_category} cutoff.` : undefined}>
                            {p.basis_category} · CAP {p.round} ({p.year}){p.is_estimate ? ' · estimate' : ''}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:items-end justify-center min-w-[180px] border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
                        <div className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-1">Historical Cutoff</div>
                        <div className="text-2xl font-extrabold text-primary">
                          {predictionMode === 'percentile' ? `${p.historical_percentile?.toFixed(2)} %ile` : `Rank ${p.historical_rank}`}
                        </div>
                        <div className={`text-xs font-bold mt-1 ${marginIsGood ? 'text-success' : 'text-rose-500'}`}>
                          Margin: {predictionMode === 'rank' ? (p.margin > 0 ? '+' : '') + Math.round(p.margin) : (p.margin > 0 ? '+' : '') + p.margin?.toFixed(2)}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-4 w-full justify-end">
                          <button className="text-text-secondary hover:text-primary transition-colors p-2"><Bookmark size={18} /></button>
                          <a href={`/college/${p.college_code}`} className="text-sm font-medium text-electric-blue hover:text-primary flex items-center gap-1 transition-colors">
                            Details <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="p-16 text-center">
                    <AlertCircle className="mx-auto text-warning mb-4" size={48} strokeWidth={1.5} />
                    <h4 className="text-xl font-bold text-primary mb-2">No Matching Options Found</h4>
                    <p className="text-text-secondary">Try adjusting your percentile, branch, or city preferences.</p>
                    <button onClick={() => setStep(3)} className="mt-6 bg-primary text-white px-6 py-2 rounded-lg font-medium">Edit Preferences</button>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
