import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, BarChart2, Globe, Calendar, Layers, Activity, CheckCircle2, Megaphone, Ticket, Sparkles, Users, TrendingUp, Handshake, Target, FileText } from 'lucide-react';
import api from '../lib/api';
import UserNav from '../components/layout/UserNav';

const MOCK_NOTIFICATIONS = [
  { user: "Sarah J.", action: "just applied to a campaign by", target: "Nike." },
  { user: "CreativeStudio", action: "posted a new campaign:", target: "$10K Budget." },
  { user: "FashionBrand", action: "accepted 3 creators for", target: "Summer Collab." },
  { user: "David M.", action: "earned a payout of", target: "$4,250." },
  { user: "RedBull", action: "launched a new campaign in", target: "Sports & Fitness." }
];

const Landing: React.FC = () => {
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    ticker_enabled: 'true',
    ticker_text: '⚡ Spotify, ⚡ LVMH, ⚡ Epic Games, ⚡ Adidas, ⚡ RedBull, ⚡ Gymshark',
    notifications_enabled: 'true',
    notifications_mock_enabled: 'true',
    stats_use_real_data: 'false'
  });
  const [realActivity, setRealActivity] = useState<any[]>([]);
  const [platformStats, setPlatformStats] = useState<any>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    api.get('/public/settings').then(res => setSettings(res.data)).catch(console.error);
    api.get('/public/activity').then(res => setRealActivity(res.data)).catch(console.error);
    api.get('/public/platform-stats').then(res => setPlatformStats(res.data)).catch(console.error);
  }, []);

  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  useEffect(() => {
    api.get('/campaigns/active')
      .then(res => { setActiveCampaigns(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const notifyInterval = setInterval(() => {
      if (settings.notifications_enabled !== 'true') return;
      
      if (Math.random() > 0.4) {
        let notifToUse = null;
        
        if (settings.notifications_mock_enabled === 'true') {
          notifToUse = MOCK_NOTIFICATIONS[Math.floor(Math.random() * MOCK_NOTIFICATIONS.length)];
        } else if (realActivity && realActivity.length > 0) {
          notifToUse = realActivity[Math.floor(Math.random() * realActivity.length)];
        }

        if (notifToUse) {
          setToast(notifToUse);
          setTimeout(() => setToast(null), 4000);
        }
      }
    }, 7000);
    return () => clearInterval(notifyInterval);
  }, [settings, realActivity]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    heroRef.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    heroRef.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div className="min-h-screen bg-[#0b0514] font-sans selection:bg-fuchsia-500 selection:text-white overflow-x-hidden text-slate-100 flex flex-col">
      
      {/* Live Activity Toast */}
      <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-500 transform ${toast ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95 pointer-events-none'}`}>
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_0_40px_rgba(236,72,153,0.3)] rounded-2xl p-4 flex items-center gap-3 max-w-[90vw] sm:max-w-sm mx-auto">
           <div className="w-10 h-10 bg-fuchsia-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse text-white shadow-[0_0_15px_rgba(236,72,153,0.8)]">
             <Megaphone size={20} />
           </div>
           {toast && (
             <div className="text-sm leading-tight text-slate-100">
               <span className="font-bold font-heading text-white block whitespace-nowrap overflow-hidden text-ellipsis">{toast.user}</span>
               <span className="opacity-80">{toast.action}</span> <span className="font-extrabold text-fuchsia-400">{toast.target}</span>
             </div>
           )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0b0514]/70 backdrop-blur-3xl border-b border-white/10 shadow-2xl py-4' : 'bg-transparent py-6 lg:py-8'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group flex-shrink-0">
            <div className="relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-cyan-500 rounded-full shadow-[0_0_20px_rgba(236,72,153,0.5)] flex-shrink-0">
               <Megaphone className="text-white w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
            </div>
            <span className="font-heading font-black text-base sm:text-2xl lg:text-3xl tracking-tighter text-white uppercase italic ml-0.5">
              Campaign<span className="text-fuchsia-400">Hub</span>
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-8 flex-shrink-0">
            <Link to="/campaigns" className="hidden lg:block font-bold text-cyan-400 hover:text-cyan-300 transition-colors text-sm uppercase tracking-widest">
              Campaigns
            </Link>
            <UserNav />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main ref={heroRef} onMouseMove={handleMouseMove} className="relative pt-28 pb-16 lg:pt-48 lg:pb-40 px-4 sm:px-6 min-h-[90vh] flex flex-col justify-center overflow-hidden group/hero">
        <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] lg:w-[800px] lg:h-[800px] bg-fuchsia-600/30 blur-[100px] lg:blur-[150px] rounded-full pointer-events-none mix-blend-screen animate-pulse"></div>
        <div className="absolute top-[10%] right-[-10%] w-[300px] h-[300px] lg:w-[700px] lg:h-[700px] bg-cyan-500/20 blur-[100px] lg:blur-[150px] rounded-full pointer-events-none mix-blend-screen animate-[pulse_6s_infinite_ease-in-out]"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[300px] h-[300px] lg:w-[900px] lg:h-[600px] bg-violet-700/20 blur-[100px] lg:blur-[150px] rounded-[100%] pointer-events-none mix-blend-color-dodge animate-pulse"></div>

        <div className="pointer-events-none absolute inset-0 z-0 hidden lg:block opacity-0 group-hover/hero:opacity-100 transition-opacity duration-1000" style={{ background: `radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(236,72,153,0.15), transparent 50%)` }} />

        <div className="max-w-7xl mx-auto w-full relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 space-y-8 text-center lg:text-left z-20">
            {/* ADMIT ONE Badge */}
            <div className="inline-flex items-center justify-center lg:justify-start">
              <div className="relative border-2 border-dashed border-fuchsia-500/50 bg-fuchsia-500/10 backdrop-blur-xl px-6 py-3 rounded-lg transform -rotate-2 shadow-[0_0_30px_rgba(236,72,153,0.3)] cursor-default">
                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#0b0514] rounded-full"></div>
                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#0b0514] rounded-full"></div>
                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#0b0514] rounded-full"></div>
                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#0b0514] rounded-full"></div>
                <span className="text-[10px] lg:text-xs font-black text-fuchsia-300 uppercase tracking-[0.3em] font-heading">✦ Admit One ✦</span>
              </div>
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-[6rem] xl:text-[7rem] font-heading font-black tracking-tighter text-white leading-[0.95] uppercase italic">
              Where Brands <br className="hidden sm:block"/>
              <span className="text-stroke text-stroke-hover transition-all duration-300 mr-2 sm:mr-4">Meet</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 via-purple-400 to-cyan-400">Creators.</span>
            </h1>
            
            <p className="text-base sm:text-xl lg:text-2xl text-slate-300 font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed px-4 sm:px-0">
              The all-in-one platform for managing campaign collaborations. Create campaigns, find top creators, and track results all in one place.
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-6 px-0">
               {!token ? (
                 <>
                  <Link to="/register" className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white px-7 py-3.5 sm:px-10 sm:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(236,72,153,0.5)] border border-fuchsia-400">
                    Join as Creator <ArrowRight size={16} />
                  </Link>
                  <Link to="/register" className="border border-white/20 hover:bg-white/10 text-white px-7 py-3.5 sm:px-10 sm:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all backdrop-blur-sm">
                    I'm a Brand
                  </Link>
                 </>
               ) : (
                 <>
                  <Link to="/dashboard" className="bg-cyan-500 hover:bg-cyan-400 text-black px-7 py-3.5 sm:px-10 sm:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(6,182,212,0.5)]">
                    Go to Dashboard <ArrowRight size={16} />
                  </Link>
                  <Link to="/campaigns" className="border border-white/20 hover:bg-white/10 text-white px-7 py-3.5 sm:px-10 sm:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all backdrop-blur-sm">
                    Browse Campaigns
                  </Link>
                 </>
               )}
            </div>
          </div>

          {/* Visual Area */}
          <div className="flex-1 w-full relative hidden lg:flex items-center justify-center z-10">
             <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
                <div className="absolute top-[5%] right-[0%] bg-white/5 backdrop-blur-2xl border border-white/20 p-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-72 animate-float z-30 hover:scale-110 transition-transform cursor-pointer group">
                   <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-3xl pointer-events-none"></div>
                   <div className="flex justify-between items-center mb-4 relative z-10">
                      <div className="flex gap-2 items-center">
                         <Users size={18} className="text-cyan-400"/>
                         <span className="text-xs uppercase font-black font-heading text-slate-300 tracking-widest">Active Creators</span>
                      </div>
                      <span className="bg-cyan-500 text-black text-[10px] font-black px-2 py-1 rounded shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-pulse">LIVE</span>
                   </div>
                   <div className="text-5xl font-heading font-black text-white tracking-tighter relative z-10 group-hover:text-cyan-400 transition-colors">
                     {settings.stats_use_real_data === 'true' && platformStats
                       ? platformStats.creatorCount.toLocaleString()
                       : '2,847'}
                   </div>
                   <div className="text-sm text-slate-400 mt-2 font-bold relative z-10">Creators ready to collaborate.</div>
                </div>

                <div className="absolute bottom-[10%] left-[-10%] bg-black/40 backdrop-blur-2xl border border-fuchsia-500/30 p-6 rounded-3xl shadow-[0_20px_60px_rgba(236,72,153,0.3)] w-72 animate-float-delay z-20 hover:scale-110 transition-transform cursor-pointer group">
                   <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/40 to-transparent rounded-3xl pointer-events-none"></div>
                   <div className="flex gap-4 items-center mb-6 relative z-10">
                      <div className="w-12 h-12 bg-fuchsia-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(236,72,153,0.8)]">
                         <Handshake size={24} className="text-white"/>
                      </div>
                      <div>
                         <div className="text-white font-black font-heading uppercase tracking-widest text-xs">Collaborations</div>
                         <div className="text-fuchsia-400 font-bold text-sm">+34% this month</div>
                      </div>
                   </div>
                   <div className="w-full h-12 flex items-end gap-2 px-1 relative z-10">
                      {[40, 60, 45, 100, 55, 90, 75].map((h, i) => (
                        <div key={i} className="w-full bg-white/10 rounded-t-sm relative group/bar hover:bg-white/20 transition-colors">
                           <div className="absolute bottom-0 w-full bg-fuchsia-500 rounded-t-sm transition-all duration-300 ease-out shadow-[0_0_10px_rgba(236,72,153,0.8)] group-hover/bar:h-[100%]" style={{height: `${h}%`}}></div>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="w-48 h-48 bg-cyan-500 rounded-full blur-[80px] absolute z-0 opacity-40 animate-[pulse_4s_infinite]"></div>
             </div>
          </div>
        </div>
      </main>

      {/* Brand Marquee */}
      {settings.ticker_enabled === 'true' && (
        <section className="bg-brand-400 py-3 sm:py-4 overflow-hidden relative z-40 transform rotate-2 scale-105 shadow-[0_0_30px_rgba(250,204,21,0.4)] border-y-4 border-black flex-shrink-0">
          <div className="flex whitespace-nowrap animate-marquee-fast items-center text-black">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-8 sm:gap-12 px-4 sm:px-6 items-center font-heading font-black uppercase text-2xl sm:text-3xl tracking-[0.2em] italic">
                  {(settings.ticker_text || '⚡ Adidas, ⚡ Nike, ⚡ Apple, ⚡ Google').split(',').map((text: string, j: number) => (
                    <span key={j}>{text.trim()}</span>
                  ))}
                </div>
              ))}
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative z-10 bg-[#0b0514] max-w-7xl mx-auto flex-shrink-0">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-5xl md:text-7xl font-heading font-black text-white tracking-tighter uppercase italic mb-3">How It Works</h2>
          <p className="text-fuchsia-400 font-bold max-w-2xl mx-auto text-sm sm:text-xl tracking-widest uppercase px-4">Simple steps to powerful collaborations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 auto-rows-fr">
           <div className="glass-card rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between group hover:-translate-y-4 transition-all duration-500 border border-white/10 hover:border-cyan-500/50 hover:shadow-[0_30px_60px_rgba(6,182,212,0.3)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/20 rounded-full blur-[60px] group-hover:bg-cyan-500/40 transition-colors duration-500 pointer-events-none"></div>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-black/50 backdrop-blur-md rounded-2xl flex items-center justify-center mb-5 sm:mb-8 border border-white/10 group-hover:border-cyan-500 group-hover:bg-cyan-500/20 transition-all duration-300 relative z-10">
                 <FileText className="text-white group-hover:text-cyan-300 transition-colors" size={24}/>
              </div>
              <div className="relative z-10">
                 <h3 className="text-xl sm:text-3xl font-heading font-black text-white mb-2 sm:mb-3 tracking-tighter uppercase italic">1. Post a Campaign</h3>
                 <p className="text-slate-300 font-medium leading-relaxed text-sm sm:text-lg">Brands create campaigns with budgets, deadlines, and target audiences. Publish when ready for creators to see.</p>
              </div>
           </div>

           <div className="glass-card rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between group hover:-translate-y-4 transition-all duration-500 border border-white/10 hover:border-fuchsia-500/50 hover:shadow-[0_30px_60px_rgba(236,72,153,0.3)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-fuchsia-500/20 rounded-full blur-[60px] group-hover:bg-fuchsia-500/40 transition-colors duration-500 pointer-events-none"></div>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-black/50 backdrop-blur-md rounded-2xl flex items-center justify-center mb-5 sm:mb-8 border border-white/10 group-hover:border-fuchsia-500 group-hover:bg-fuchsia-500/20 transition-all duration-300 relative z-10">
                 <Handshake className="text-white group-hover:text-fuchsia-300 transition-colors" size={24}/>
              </div>
              <div className="relative z-10">
                 <h3 className="text-xl sm:text-3xl font-heading font-black text-white mb-2 sm:mb-3 tracking-tighter uppercase italic">2. Creators Apply</h3>
                 <p className="text-slate-300 font-medium leading-relaxed text-sm sm:text-lg">Creators browse campaigns, submit applications with a pitch, and brands review and accept the best fit.</p>
              </div>
           </div>

           <div className="glass-card rounded-2xl sm:rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between group hover:-translate-y-4 transition-all duration-500 border border-white/10 hover:border-violet-500/50 hover:shadow-[0_30px_60px_rgba(139,92,246,0.3)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/20 rounded-full blur-[60px] group-hover:bg-violet-500/40 transition-colors duration-500 pointer-events-none"></div>
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-black/50 backdrop-blur-md rounded-2xl flex items-center justify-center mb-5 sm:mb-8 border border-white/10 group-hover:border-violet-500 group-hover:bg-violet-500/20 transition-all duration-300 relative z-10">
                 <TrendingUp className="text-white group-hover:text-violet-300 transition-colors" size={24}/>
              </div>
              <div className="relative z-10">
                 <h3 className="text-xl sm:text-3xl font-heading font-black text-white mb-2 sm:mb-3 tracking-tighter uppercase italic">3. Track &amp; Earn</h3>
                 <p className="text-slate-300 font-medium leading-relaxed text-sm sm:text-lg">Track campaign progress, manage deliverables, and handle payouts all in one transparent dashboard.</p>
              </div>
           </div>
        </div>
      </section>

      {/* Active Campaigns */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-[#0b0514] relative z-20 border-t border-white/10 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 sm:gap-6 mb-10 sm:mb-16 border-b border-white/10 pb-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl sm:text-5xl md:text-7xl font-heading font-black text-white tracking-tighter uppercase leading-[0.9] mb-3">
                Open Campaigns
              </h2>
              <p className="text-base sm:text-2xl text-fuchsia-400 font-bold uppercase tracking-widest">Browse and apply to live opportunities.</p>
            </div>
            <Link to="/campaigns" className="inline-flex items-center justify-center w-full lg:w-auto gap-2 bg-white text-black px-5 sm:px-8 py-3 sm:py-4 rounded-full font-black uppercase tracking-widest transition-all hover:bg-cyan-400 hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.4)] text-xs sm:text-sm">
               View All <ArrowRight size={16} />
            </Link>
          </div>

          {loading ? (
             <div className="flex justify-center p-20">
                <div className="w-16 h-16 border-4 border-white/10 border-t-fuchsia-500 rounded-full animate-[spin_0.5s_linear_infinite]"></div>
             </div>
          ) : activeCampaigns.length === 0 ? (
             <div className="glass-card rounded-[3rem] p-10 sm:p-32 text-center max-w-4xl mx-auto border-dashed border-2 border-white/20">
                <Megaphone size={60} className="mx-auto text-white/30 mb-8" />
                <h3 className="text-3xl sm:text-4xl font-heading font-black text-white mb-4 tracking-tighter uppercase">No Campaigns Yet</h3>
                <p className="text-lg sm:text-xl text-slate-400 font-bold px-4">Be the first brand to post a campaign and start connecting with creators.</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
                {activeCampaigns.map((camp, idx) => (
                  <div key={camp.id} className="glass-card rounded-[2rem] border border-white/20 hover:border-fuchsia-500/80 transition-all duration-500 flex flex-col relative overflow-hidden group hover:shadow-[0_0_50px_rgba(236,72,153,0.3)] hover:-translate-y-2 cursor-pointer bg-black/40">
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                    
                    <div className="p-8 sm:p-10 pb-6 flex-1 flex flex-col z-10 relative">
                      <div className="flex justify-between items-start mb-8">
                        <span className="bg-white text-black text-[10px] sm:text-xs font-heading font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.6)]">{camp.platform}</span>
                        <div className="flex flex-col items-end">
                          <span className="text-cyan-400 font-heading font-black text-3xl sm:text-4xl tracking-tighter">${Number(camp.budget).toLocaleString()}</span>
                          <span className="text-[10px] sm:text-xs font-heading text-fuchsia-400 font-black uppercase tracking-wider mt-1">Budget</span>
                        </div>
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-heading font-black text-white mb-4 tracking-tighter uppercase leading-none group-hover:text-fuchsia-400 transition-colors">{camp.title}</h3>
                      <p className="text-slate-300 text-base sm:text-lg font-medium mb-10 leading-relaxed flex-1 line-clamp-3">{camp.description}</p>
                    </div>
                    
                    <div className="p-6 sm:p-8 pt-5 sm:pt-6 border-t border-white/10 bg-black/60 flex items-center justify-between z-10 relative overflow-hidden">
                      <div className="absolute inset-0 bg-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-heading font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">
                         <Calendar size={16} /> {camp.deadline ? new Date(camp.deadline).toLocaleDateString() : 'Open'}
                      </div>
                       <Link to={token ? "/campaigns" : "/login"} className="text-white hover:text-cyan-400 font-heading font-black text-sm uppercase flex items-center gap-2 group/btn relative z-10 transition-colors py-1">
                         {token ? "View to Apply" : "Apply"} <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform"/>
                       </Link>
                    </div>
                  </div>
                ))}
             </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-32 px-4 sm:px-6 text-center relative overflow-hidden group bg-black flex-shrink-0">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] sm:w-[1200px] sm:h-[600px] bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 blur-[80px] sm:blur-[150px] rounded-full opacity-30 pointer-events-none group-hover:opacity-50 transition-opacity duration-1000"></div>
         <div className="max-w-5xl mx-auto relative z-10">
             <h2 className="text-4xl sm:text-6xl md:text-8xl font-heading font-black tracking-tighter mb-6 leading-[0.9] uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 cursor-default px-2">
               Ready to Collaborate?
             </h2>
             <p className="text-base sm:text-2xl text-cyan-300 font-bold max-w-3xl mx-auto mb-8 sm:mb-14 uppercase tracking-widest px-2">
               Join thousands of brands and creators building partnerships that matter.
             </p>
             {token ? (
               <Link to="/campaigns" className="inline-flex items-center justify-center gap-3 bg-fuchsia-500 text-white hover:bg-cyan-400 hover:text-black px-8 sm:px-16 py-4 sm:py-6 rounded-full font-black text-sm uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-[0_0_50px_rgba(236,72,153,0.5)] border border-white w-full sm:w-auto">
                 Find Active Campaigns
               </Link>
             ) : (
               <Link to="/register" className="inline-flex items-center justify-center gap-3 bg-fuchsia-500 text-white hover:bg-cyan-400 px-8 sm:px-16 py-4 sm:py-6 rounded-full font-black text-sm uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 shadow-[0_0_50px_rgba(236,72,153,0.5)] border-2 border-white w-full sm:w-auto">
                  Create Free Account
               </Link>
             )}
         </div>
         <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#0b0514] to-transparent"></div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0b0514] pt-14 sm:pt-20 pb-10 px-4 sm:px-6 border-t border-white/5 relative z-10 flex-shrink-0">
         <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 mb-12 sm:mb-16">
               <div className="col-span-2 md:col-span-1">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-cyan-500 rounded-full flex items-center justify-center">
                       <Megaphone size={16} className="text-white" />
                    </div>
                    <span className="font-heading font-black text-xl tracking-tighter text-white uppercase italic">
                      Campaign<span className="text-fuchsia-400">Hub</span>
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                    The platform connecting brands with creators for impactful campaign collaborations.
                  </p>
                  <div className="flex items-center gap-4 text-slate-400">
                    <a href="#" className="hover:text-fuchsia-400 transition-colors font-bold uppercase text-xs tracking-widest">Twitter</a>
                    <a href="#" className="hover:text-cyan-400 transition-colors font-bold uppercase text-xs tracking-widest">Instagram</a>
                    <a href="#" className="hover:text-violet-400 transition-colors font-bold uppercase text-xs tracking-widest">LinkedIn</a>
                  </div>
               </div>
               <div>
                 <h4 className="text-white font-heading font-black uppercase tracking-widest text-xs sm:text-sm mb-4 sm:mb-6">For Creators</h4>
                 <ul className="space-y-3 text-slate-400 text-xs sm:text-sm font-medium">
                   <li><a href="#" className="hover:text-cyan-400 transition-colors">Browse Campaigns</a></li>
                   <li><a href="#" className="hover:text-cyan-400 transition-colors">Create Your Profile</a></li>
                   <li><a href="#" className="hover:text-cyan-400 transition-colors">Track Earnings</a></li>
                 </ul>
               </div>
               <div>
                 <h4 className="text-white font-heading font-black uppercase tracking-widest text-xs sm:text-sm mb-4 sm:mb-6">For Brands</h4>
                 <ul className="space-y-3 text-slate-400 text-xs sm:text-sm font-medium">
                   <li><a href="#" className="hover:text-fuchsia-400 transition-colors">Post a Campaign</a></li>
                   <li><a href="#" className="hover:text-fuchsia-400 transition-colors">Find Creators</a></li>
                   <li><a href="#" className="hover:text-fuchsia-400 transition-colors">Manage Applications</a></li>
                 </ul>
               </div>
               <div>
                 <h4 className="text-white font-heading font-black uppercase tracking-widest text-xs sm:text-sm mb-4 sm:mb-6">Company</h4>
                 <ul className="space-y-3 text-slate-400 text-xs sm:text-sm font-medium">
                   <li><a href="#" className="hover:text-violet-400 transition-colors">About Us</a></li>
                   <li><a href="#" className="hover:text-violet-400 transition-colors">Contact Support</a></li>
                   <li><a href="#" className="hover:text-violet-400 transition-colors">Privacy Policy</a></li>
                   <li><a href="#" className="hover:text-violet-400 transition-colors">Terms of Service</a></li>
                 </ul>
               </div>
            </div>
            <div className="pt-6 border-t border-white/5 flex items-center justify-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-600">
               <p>© {new Date().getFullYear()} CampaignHub. All rights reserved.</p>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default Landing;
