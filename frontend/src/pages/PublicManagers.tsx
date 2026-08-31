import React, { useEffect, useState, useCallback } from 'react';
import { Users, Star, Search, CheckCircle, ShieldCheck, SlidersHorizontal, X, ChevronDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';
import api from '../lib/api';

const SORT_OPTIONS = [
  { value: 'rating_desc', label: 'Highest Rated' },
  { value: 'name', label: 'A–Z Name' },
];

const RATING_OPTIONS = [
  { label: 'Any Rating', value: '' },
  { label: '4.0+', value: '4' },
  { label: '4.5+', value: '4.5' },
  { label: '5.0 Only', value: '5' },
];

const PublicManagers: React.FC = () => {
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('rating_desc');
  const [minRating, setMinRating] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchManagers = useCallback(() => {
    setLoading(true);
    const params: any = { sort };
    if (search) params.search = search;
    if (minRating) params.minRating = minRating;

    api.get('/managers/public', { params })
      .then(res => {
        setManagers(res.data || []);
        setTotal((res.data || []).length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, sort, minRating]);

  useEffect(() => {
    const t = setTimeout(fetchManagers, 300);
    return () => clearTimeout(t);
  }, [fetchManagers]);

  const clearFilters = () => { setSearch(''); setSort('rating_desc'); setMinRating(''); };
  const hasActive = search || minRating;

  const renderStars = (rating: number) => {
    const r = Math.round(Number(rating) * 2) / 2;
    return (
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <Star key={i} size={13}
            className={i <= r ? 'fill-amber-400 text-amber-400' : i - 0.5 === r ? 'fill-amber-200 text-amber-400' : 'text-surface-200 fill-surface-200'}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      <LandingNav />
      <main className="flex-1">
      {/* Hero */}
      <div className="relative pt-16 pb-16 overflow-hidden bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-amber-50 -z-10" />
        <div className="absolute top-20 right-10 w-80 h-80 bg-brand-100/30 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-amber-100/20 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
            <Users size={14} /> Expert Managers
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-surface-900 tracking-tight leading-tight mb-5">
            Find Top-Tier <span className="text-brand-500">Social Managers</span>
          </h1>
          <p className="text-lg md:text-xl text-surface-500 max-w-2xl mx-auto font-medium mb-10 leading-relaxed">
            Browse verified digital marketing experts and campaign managers ready to scale your enterprise brand.
          </p>

          <div className="max-w-2xl mx-auto relative shadow-xl rounded-2xl">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-brand-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-4 rounded-2xl bg-white border-2 border-surface-200 focus:ring-4 focus:ring-brand-50 focus:border-brand-500 text-surface-900 font-medium transition-all"
              placeholder="Search by name or expertise (e.g. SaaS, Fashion)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-24 z-40 bg-white/95 backdrop-blur-sm border-b border-surface-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 flex-wrap justify-between">
          <div className="flex items-center gap-2">
            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-surface border border-surface-200 rounded-xl text-xs font-bold text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-200 cursor-pointer"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${showFilters ? 'bg-brand-500 text-white border-brand-500' : 'bg-surface border-surface-200 text-surface-700 hover:border-brand-300'}`}
            >
              <SlidersHorizontal size={14} /> Filters
              {hasActive && <span className="w-2 h-2 bg-red-500 rounded-full" />}
            </button>

            {hasActive && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
                <X size={12} /> Clear
              </button>
            )}
          </div>

          <p className="text-sm font-semibold text-surface-500">
            {loading ? 'Searching...' : <><span className="text-surface-900 font-bold">{total}</span> managers available</>}
          </p>
        </div>

        {/* Rating Filter (expanded) */}
        {showFilters && (
          <div className="max-w-7xl mx-auto px-6 pb-4 flex flex-wrap gap-4 animate-fade-in border-t border-surface-100 pt-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">Minimum Rating</label>
              <div className="flex gap-2">
                {RATING_OPTIONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setMinRating(r.value)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      minRating === r.value
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'bg-surface border-surface-200 text-surface-600 hover:border-brand-300'
                    }`}
                  >
                    {r.value && <Star size={11} className="fill-amber-400 text-amber-400" />}
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-surface-200 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : managers.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-surface-200 shadow-sm">
            <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search size={32} className="text-brand-400" />
            </div>
            <h3 className="text-2xl font-bold text-surface-900 mb-2">No managers found</h3>
            <p className="text-surface-500 max-w-md mx-auto mb-6">Try adjusting your search or filters.</p>
            <button onClick={clearFilters} className="px-6 py-3 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-colors">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {managers.map((manager, idx) => (
              <div
                key={manager.id}
                className="bg-white rounded-3xl p-6 border border-surface-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative overflow-hidden animate-fade-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-300 to-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-4">
                    {manager.avatar_url ? (
                      <img src={manager.avatar_url} alt={manager.full_name} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-surface-100" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-amber-50 text-brand-600 font-extrabold text-xl flex items-center justify-center shadow-sm border border-brand-100">
                        {manager.full_name?.charAt(0) || 'M'}
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-surface-900 group-hover:text-brand-600 transition-colors leading-tight flex items-center gap-1.5">
                        {manager.full_name || 'Verified Manager'}
                        <ShieldCheck size={15} className="text-blue-500 flex-shrink-0" />
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 w-max">
                        {renderStars(manager.rating)}
                        <span className="text-xs font-bold text-amber-700 ml-0.5">{Number(manager.rating || 5.0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-surface-500 text-sm mb-5 line-clamp-3 leading-relaxed flex-1">
                  {manager.bio || 'An experienced campaign manager dedicated to driving ROI and managing elite creator networks.'}
                </p>

                <div className="pt-4 border-t border-surface-100 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                    <CheckCircle size={13} className="text-green-500" /> Available for Hire
                  </div>
                  <Link to="/register" className="flex items-center gap-1 text-brand-600 font-bold text-sm bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors">
                    Work with me <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </main>
      <Footer />
    </div>
  );
};

export default PublicManagers;
