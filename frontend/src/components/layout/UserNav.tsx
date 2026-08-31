import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, ArrowRight, LayoutDashboard, Briefcase, ChevronDown, Users, Moon, Sun, Bell } from 'lucide-react';
import api from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';
import { NotificationsDropdown } from './NotificationsDropdown';

interface UserNavProps {
  scrolled?: boolean;
}

const UserNav: React.FC<UserNavProps> = ({ scrolled = true }) => {
  const [user, setUser] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileImg, setProfileImg] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const role = localStorage.getItem('role') || 'creator';
  const { darkMode, toggleDarkMode } = useTheme();
  const displayName = profileName || user?.display_name || user?.email?.split('@')[0] || role;
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me').then(res => {
        if(res.data) setUser(res.data);
      }).catch(err => {
        if (err.response && err.response.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
        }
      });

      const fetchProfile = () => {
        if (role === 'creator') {
          api.get('/creators/profile').then(res => {
            if (res.data && res.data.avatar_url) setProfileImg(res.data.avatar_url);
          }).catch(() => {});
        } else if (role === 'brand') {
          api.get('/brands/profile').then(res => {
            if (res.data && res.data.logo_url) setProfileImg(res.data.logo_url);
            if (res.data?.company_name) setProfileName(res.data.company_name);
          }).catch(() => {});
        } else if (role === 'manager') {
          api.get('/managers/profile').then(res => {
            if (res.data && res.data.avatar_url) setProfileImg(res.data.avatar_url);
            if (res.data?.full_name) setProfileName(res.data.full_name);
          }).catch(() => {});
        }
      };

      fetchProfile();
      window.addEventListener('profileUpdated', fetchProfile);
      return () => window.removeEventListener('profileUpdated', fetchProfile);
    }
  }, [role]);

  const DarkModeToggle = () => (
    <button
      onClick={toggleDarkMode}
      className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center border transition-all active:scale-90 shadow-sm ${
        scrolled 
          ? 'border-surface-200 bg-surface-50 hover:bg-surface-100' 
          : 'border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur-md'
      }`}
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {darkMode ? <Sun size={16} className="text-brand-400" /> : <Moon size={16} className={scrolled ? "text-surface-500" : "text-white"} />}
    </button>
  );

  if (!user && !localStorage.getItem('token')) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-3">
        <Link to="/campaigns" className={`hidden lg:block text-sm font-bold transition-colors ${scrolled ? 'text-surface-600 hover:text-brand-500' : 'text-slate-200 hover:text-white'}`}>Campaigns</Link>
        <Link to="/talent" className={`hidden lg:block text-sm font-bold transition-colors pr-2 border-r border-surface-200/20 ${scrolled ? 'text-surface-600 hover:text-brand-500' : 'text-slate-200 hover:text-white'}`}>Talent Network</Link>
        <DarkModeToggle />

        <Link to="/login" className={`hidden sm:block font-semibold transition-colors text-sm ${scrolled ? 'text-surface-600 hover:text-surface-900' : 'text-slate-200 hover:text-white'}`}>
          Sign In
        </Link>
        <Link to="/register" className="bg-brand-400 hover:bg-brand-500 text-surface-900 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl font-semibold transition-all text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 shadow-sm active:scale-95 whitespace-nowrap">
          <span className="hidden sm:inline">Get Started</span>
          <span className="sm:hidden">Join</span>
          <ArrowRight size={14} className="flex-shrink-0" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <></>
      <DarkModeToggle />
      <NotificationsDropdown scrolled={scrolled} />
      <div className="relative">
        <div 
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group" 
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <div className="hidden lg:flex flex-col text-right mr-1">
            <div className={`text-sm font-bold capitalize transition-colors ${scrolled ? 'text-surface-900 group-hover:text-brand-500' : 'text-white'}`}>
              {displayName}
            </div>
            <div className={`text-xs font-medium capitalize ${scrolled ? 'text-surface-500' : 'text-slate-300'}`}>{role}</div>
          </div>
          
          <div className="h-8 w-8 sm:h-10 sm:w-10 bg-brand-50 rounded-full flex items-center justify-center text-brand-700 border border-brand-100 group-hover:scale-105 transition-transform overflow-hidden shadow-sm">
             {profileImg ? (
               <img src={profileImg} alt="Profile" className="w-full h-full object-cover" />
             ) : (
               <User size={16} />
             )}
          </div>
          <ChevronDown size={16} className={`hidden sm:block transition-transform ${scrolled ? 'text-surface-400' : 'text-slate-300'} ${dropdownOpen ? 'rotate-180' : ''}`} />
        </div>

        {dropdownOpen && (
          <div className="absolute right-0 mt-3 w-56 bg-surface border border-surface-200 rounded-xl shadow-lg overflow-hidden z-50 animate-fade-in">
            <div className="px-4 py-3 border-b border-surface-100 bg-surface-50">
              <span className="block text-xs font-bold text-surface-500 uppercase tracking-wider">My Account</span>
            </div>
            <div className="flex flex-col py-2">
              <Link to="/dashboard" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 hover:text-brand-500 transition-colors">
                <LayoutDashboard size={16} className="text-surface-400" /> Main Dashboard
              </Link>
              <Link to="/dashboard/campaigns" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 hover:text-brand-500 transition-colors">
                <Briefcase size={16} className="text-surface-400" /> {role === 'brand' ? 'Campaigns' : 'My Applications'}
              </Link>
              {role === 'brand' && (
                <Link to="/dashboard/applications" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 hover:text-brand-500 transition-colors">
                  <Users size={16} className="text-surface-400" /> Applications
                </Link>
              )}
              <Link to="/dashboard/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 hover:text-brand-500 transition-colors">
                <User size={16} className="text-surface-400" /> Profile Settings
              </Link>
            </div>
            <div className="border-t border-surface-100 p-2">
              <button 
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('role');
                  window.location.href = '/login';
                }} 
                className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserNav;