import React from 'react';
import { Settings, Wrench } from 'lucide-react';

interface MaintenanceProps {
  message?: string;
}

const Maintenance: React.FC<MaintenanceProps> = ({ message }) => {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat">
      <div className="text-center max-w-2xl bg-white p-12 rounded-3xl shadow-premium border border-surface-200">
        <div className="w-24 h-24 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-8 relative animate-pulse">
           <Wrench size={48} className="absolute rotate-45" />
           <Settings size={32} className="absolute -top-2 -right-2 animate-spin text-brand-400" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-surface-900 mb-4 tracking-tight">System Maintenance</h1>
        <p className="text-lg md:text-xl text-surface-600 font-medium mb-8 leading-relaxed">
          {message || "We are currently upgrading the platform to bring you a better experience. We'll be back online shortly!"}
        </p>
        <div className="pt-8 border-t border-surface-100 flex flex-col sm:flex-row items-center justify-center gap-4">
           <a href="/" className="px-6 py-3 bg-surface-100 text-surface-700 hover:bg-surface-200 rounded-xl font-bold transition-all text-sm">
             Reload Page
           </a>
           <a href="/login" className="px-6 py-3 bg-brand-500 text-white hover:bg-brand-600 rounded-xl font-bold transition-all shadow-sm text-sm">
             Admin Access
           </a>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
