import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Search, MapPin, Users, ArrowRight, ShieldCheck, SlidersHorizontal, X, TrendingUp, ChevronDown } from 'lucide-react';
import LandingNav from './landing/sections/LandingNav';
import Footer from './landing/sections/Footer';
import api from '../lib/api';

const NICHES = ['All', 'Fashion', 'Tech', 'Food', 'Fitness', 'Beauty', 'Travel', 'Gaming', 'Lifestyle', 'Music', 'Education', 'Business', 'Finance', 'Sports', 'Comedy'];
const FOLLOWER_RANGES = [
  { label: 'Any Size', min: 0, max: 0 },
  { label: 'Nano (1K–10K)', min: 1000, max: 10000 },
  { label: 'Micro (10K–100K)', min: 10000, max: 100000 },
  { label: 'Mid-Tier (100K–1M)', min: 100000, max: 1000000 },
  { label: 'Macro (1M+)', min: 1000000, max: 0 },
];

const formatFollowers = (n: number) => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
};

const PublicCreators: React.FC = () => {
  const [creators, setCreators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('All');
  const [selectedFollowers, setSelectedFollowers] = useState(0); // index into FOLLOWER_RANGES
  const [location, setLocation] = useState('');
  const [sort, setSort] = useState('followers_desc');
  const [showFilters, setShowFilters] = useState(false);

  const fetchCreators = useCallback(() => {
    setLoading(true);
    const params: any = { sort };
    if (search) params.search = search;
    if (selectedNiche !== 'All') params.category = selectedNiche;
    if (location.trim()) params.location = location.trim();
    const range = FOLLOWER_RANGES[selectedFollowers];
    if (range.min) params.minFollowers = String(range.min);
    if (range.max) params.maxFollowers = String(range.max);

    api.get('/creators/public-list', { params })
      .then(res => {
        setCreators(res.data || []);
        setTotal((res.data || []).length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, selectedNiche, selectedFollowers, location, sort]);

  useEffect(() => {
    const timer = setTimeout(fetchCreators, 300);
    return () => clearTimeout(timer);
  }, [fetchCreators]);

  const clearFilters = () => {
    setSearch('');
    setSelectedNiche('All');
    setSelectedFollowers(0);
    setLocation('');
    setSort('followers_desc');
  };

  const hasActiveFilters = search || selectedNiche !== 'All' || selectedFollowers > 0 || location;

  return (
    <div className="landing-visitors min-h-screen flex flex-col">
      <LandingNav />
      <main className="flex-1">
      {/* Hero */}
      <div className="relative pt-16 pb-16 overflow-hidden bg-surface">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-brand-50 -z-10" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-100/40 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-10 w-64 h-64 bg-brand-100/30 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold uppercase tracking-wider mb-6 animate-fade-in shadow-sm">
            <Camera size={14} /> Verified Creators
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-surface-900 tracking-tight leading-tight mb-5 animate-fade-up">
            Discover Top <span className="text-violet-600">Content Creators</span>
          </h1>
          <p className="text-lg md:text-xl text-surface-500 max-w-2xl mx-auto font-medium mb-10 leading-relaxed animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Browse our verified network of influencers and content creators across every niche and platform.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative animate-fade-up shadow-xl rounded-2xl" style={{ animationDelay: '0.15s' }}>
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-violet-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-4 rounded-2xl bg-white border-2 border-surface-200 focus:ring-4 focus:ring-violet-50 focus:border-violet-500 text-surface-900 font-medium transition-all shadow-sm"
              placeholder="Search by name, username, niche..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-24 z-40 bg-white/95 backdrop-blur-sm border-b border-surface-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Niche Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
              {NICHES.map(n => (
                <button
                  key={n}
                  onClick={() => setSelectedNiche(n)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    selectedNiche === n
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-surface text-surface-600 border-surface-200 hover:border-violet-300 hover:text-violet-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Sort */}
              <div className="relative">
                <select
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 bg-surface border border-surface-200 rounded-xl text-xs font-bold text-surface-700 focus:outline-none focus:ring-2 focus:ring-violet-200 cursor-pointer"
                >
                  <option value="followers_desc">Most Followers</option>
                  <option value="followers_asc">Least Followers</option>
                  <option value="name">A–Z Name</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
              </div>
              {/* Advanced Filters Toggle */}
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${showFilters ? 'bg-violet-600 text-white border-violet-600' : 'bg-surface border-surface-200 text-surface-700 hover:border-violet-300'}`}
              >
                <SlidersHorizontal size={14} /> Filters
                {hasActiveFilters && <span className="w-2 h-2 bg-red-500 rounded-full" />}
              </button>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-wrap gap-4 py-3 border-t border-surface-100 animate-fade-in">
              {/* Follower Range */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">Follower Range</label>
                <div className="flex gap-2 flex-wrap">
                  {FOLLOWER_RANGES.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedFollowers(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        selectedFollowers === i
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-surface border-surface-200 text-surface-600 hover:border-violet-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-surface-500 uppercase tracking-wider">Location</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="e.g. New York, London..."
                    className="pl-8 pr-4 py-2 bg-surface border border-surface-200 rounded-xl text-xs font-medium text-surface-900 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500 w-52"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-semibold text-surface-500">
            {loading ? 'Searching...' : <><span className="text-surface-900 font-bold">{total}</span> creators found</>}
          </p>
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-600">
              <TrendingUp size={14} /> Filtered results
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-12 h-12 border-4 border-surface-200 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : creators.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-surface-200 shadow-sm">
            <div className="w-20 h-20 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Camera size={32} className="text-violet-400" />
            </div>
            <h3 className="text-2xl font-bold text-surface-900 mb-2">No creators found</h3>
            <p className="text-surface-500 max-w-md mx-auto mb-6">Try adjusting your filters or broadening your search.</p>
            <button onClick={clearFilters} className="px-6 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors">
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {creators.map((creator, idx) => (
              <div
                key={creator.id}
                className="bg-white rounded-3xl border border-surface-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group animate-fade-up"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                {/* Card Top Accent */}
                <div className="h-1 w-full bg-gradient-to-r from-violet-400 to-brand-400 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="p-6 flex flex-col flex-1">
                  {/* Avatar + Verified */}
                  <div className="flex items-center gap-4 mb-4">
                    {creator.avatar_url ? (
                      <img src={creator.avatar_url} alt={creator.full_name} className="w-16 h-16 rounded-2xl object-cover shadow-sm border border-surface-100 flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-brand-50 text-violet-600 font-extrabold text-xl flex items-center justify-center shadow-sm border border-violet-100 flex-shrink-0">
                        {creator.full_name?.charAt(0)?.toUpperCase() || creator.username?.charAt(0)?.toUpperCase() || 'C'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-surface-900 text-base group-hover:text-violet-600 transition-colors truncate leading-tight">
                          {creator.full_name || creator.username || 'Creator'}
                        </h3>
                        <ShieldCheck size={15} className="text-blue-500 flex-shrink-0" />
                      </div>
                      {creator.username && (
                        <p className="text-xs text-surface-400 font-medium">@{creator.username}</p>
                      )}
                    </div>
                  </div>

                  {/* Category & Location */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {creator.category && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-lg text-xs font-bold">
                        {creator.category}
                      </span>
                    )}
                    {creator.location && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-50 text-surface-600 border border-surface-100 rounded-lg text-xs font-semibold">
                        <MapPin size={10} /> {creator.location}
                      </span>
                    )}
                  </div>

                  {/* Bio */}
                  <p className="text-surface-500 text-sm leading-relaxed line-clamp-2 flex-1 mb-4">
                    {creator.bio || 'Verified content creator ready to bring authentic storytelling to your brand campaigns.'}
                  </p>

                  {/* Follower count */}
                  <div className="flex items-center gap-2 pt-3 border-t border-surface-100">
                    <div className="flex items-center gap-1.5 flex-1">
                      <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                        <Users size={13} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-surface-900 leading-none">{formatFollowers(creator.follower_count)}</p>
                        <p className="text-[10px] text-surface-400 font-medium">followers</p>
                      </div>
                    </div>
                    <Link to="/register" className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors">
                      Collab <ArrowRight size={11} />
                    </Link>
                  </div>
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

export default PublicCreators;
