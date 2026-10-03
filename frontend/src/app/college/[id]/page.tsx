"use client";

import { useState, useEffect, use } from 'react';
import axios from 'axios';
import { MapPin, Building2, BookOpen, ExternalLink, GraduationCap, Users, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export default function CollegeDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const collegeId = resolvedParams.id;
  const [college, setCollege] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/colleges/${collegeId}`)
      .then(res => setCollege(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [collegeId]);

  if (loading) {
    return (
      <div className="flex-1 w-full bg-soft-bg py-32 flex justify-center items-center">
        <Loader2 className="animate-spin text-electric-blue" size={48} />
      </div>
    );
  }

  if (!college) {
    return (
      <div className="flex-1 w-full bg-soft-bg py-32 text-center">
        <h2 className="text-2xl font-bold text-primary">College Not Found</h2>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-soft-bg py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-primary text-white rounded-3xl p-8 md:p-12 mb-8 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-electric-blue/20 blur-3xl transform translate-x-1/3 -translate-y-1/3 rounded-full"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="bg-white/10 backdrop-blur-md border border-white/20 text-electric-blue font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={14} /> Code {college.college_code}
                </span>
                <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium px-3 py-1 rounded-full text-xs flex items-center gap-1.5">
                  <MapPin size={14} /> {college.city}
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2 leading-tight">
                {college.college_name}
              </h1>
            </div>
            <button className="bg-electric-blue hover:bg-electric-blue/90 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-lg flex items-center gap-2">
              <ExternalLink size={18} /> Official Website
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Branches Section */}
            <div className="bg-white p-8 rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-electric-blue/10 rounded-lg text-electric-blue">
                  <BookOpen size={20} />
                </div>
                <h2 className="text-xl font-bold text-primary">Available Engineering Branches</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {college.branches.map((branch: string, i: number) => (
                  <div key={i} className="p-4 border border-border rounded-xl bg-soft-bg hover:border-electric-blue/50 transition-colors">
                    <h3 className="font-semibold text-primary">{branch}</h3>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Cutoffs Table */}
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-8 border-b border-border flex items-center gap-2">
                <div className="p-2 bg-electric-blue/10 rounded-lg text-electric-blue">
                  <GraduationCap size={20} />
                </div>
                <h2 className="text-xl font-bold text-primary">Recent Admission Data</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-soft-bg border-b border-border">
                      <th className="p-4 font-semibold text-sm text-text-secondary">Branch</th>
                      <th className="p-4 font-semibold text-sm text-text-secondary">Category</th>
                      <th className="p-4 font-semibold text-sm text-text-secondary">Round</th>
                      <th className="p-4 font-semibold text-sm text-text-secondary">Percentile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {college.recent_cutoffs.slice(0, 15).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-soft-bg/50 transition-colors">
                        <td className="p-4 text-sm font-medium text-primary">{r.branch_name}</td>
                        <td className="p-4 text-sm text-text-secondary">
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-primary">{r.category}</span>
                        </td>
                        <td className="p-4 text-sm text-text-secondary">CAP {r.round_number} ({r.year})</td>
                        <td className="p-4 text-sm font-bold text-electric-blue">
                          {r.percentile ? `${r.percentile.toFixed(2)} %ile` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-soft-bg border-t border-border text-center text-sm text-electric-blue font-semibold">
                <a href="/analytics">View full cutoff analytics &rarr;</a>
              </div>
            </div>

          </div>

          {/* Right Side Panel */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
              <h3 className="font-bold text-primary text-lg mb-4 flex items-center gap-2">
                <Users size={18} className="text-electric-blue" /> Admission Insights
              </h3>
              <ul className="space-y-4 text-sm text-text-secondary">
                <li className="flex flex-col gap-1 pb-4 border-b border-border">
                  <span className="font-semibold text-primary">Institution Type</span>
                  <span>Engineering College (AICTE Approved)</span>
                </li>
                <li className="flex flex-col gap-1 pb-4 border-b border-border">
                  <span className="font-semibold text-primary">Counselling Authority</span>
                  <span>State CET Cell, Maharashtra</span>
                </li>
                <li className="flex flex-col gap-1 pb-4 border-b border-border">
                  <span className="font-semibold text-primary">Recorded Branches</span>
                  <span>{college.branches.length} Specializations</span>
                </li>
                <li className="flex flex-col gap-1">
                  <span className="font-semibold text-primary">Historical Data</span>
                  <span>2023 - 2025 CAP Rounds 1, 2 & 3</span>
                </li>
              </ul>
            </div>
            
            <a href="/analytics" className="block w-full bg-primary hover:bg-navy-800 text-white text-center py-4 rounded-xl font-medium transition-all shadow-md">
              Run Cutoff Analytics
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
