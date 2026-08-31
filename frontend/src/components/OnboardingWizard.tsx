import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Sparkles, BarChart2, Users, Zap, CheckCircle } from 'lucide-react';

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  tip: string;
}

const STEPS: Record<string, Step[]> = {
  creator: [
    { icon: Sparkles, title: 'Welcome to CampaignHub!', description: 'Your journey to brand collaborations starts here. Let us show you around.', tip: 'Complete your profile to get discovered by top brands.' },
    { icon: Users, title: 'Browse Campaigns', description: 'Explore live campaigns from brands looking for creators just like you. Apply with a compelling pitch.', tip: 'Campaigns with higher budgets get more applicants. Stand out!' },
    { icon: BarChart2, title: 'Track Your Progress', description: 'Monitor your applications, accepted deals, and earnings all in one dashboard.', tip: 'Use the Dashboard tab to see real-time stats.' },
    { icon: Zap, title: 'You\'re All Set!', description: 'Start exploring campaigns and land your first collaboration. Good luck!', tip: 'Keep your profile updated for better matching.' },
  ],
  brand: [
    { icon: Sparkles, title: 'Welcome to CampaignHub!', description: 'Connect with high-impact creators and scale your campaigns effortlessly.', tip: 'Create your first campaign to start receiving applications.' },
    { icon: Users, title: 'Create a Campaign', description: 'Define your brief, set a budget, and choose content types. Our platform will help you find the perfect creators.', tip: 'Detailed briefs attract more qualified creators.' },
    { icon: BarChart2, title: 'Review Applications', description: 'View creator profiles, followers, and reach. Accept the best fit and process payments securely.', tip: 'Check creator stats before accepting.' },
    { icon: Zap, title: 'You\'re All Set!', description: 'Launch your first campaign and watch your brand grow with creators. Let\'s go!', tip: 'Use the analytics dashboard to track campaign performance.' },
  ],
  admin: [
    { icon: Sparkles, title: 'Welcome, Admin!', description: 'You have full control over the CampaignHub platform.', tip: 'Check the dashboard for an overview of all activity.' },
    { icon: Users, title: 'Manage Users & Campaigns', description: 'View all users, campaigns, applications, and payouts from your admin panel.', tip: 'Use the Users tab to manage accounts.' },
    { icon: BarChart2, title: 'Site Control', description: 'Configure landing page sections, trusted brands, and more from Site Settings.', tip: 'The Site Control page lets you manage public-facing content.' },
    { icon: Zap, title: 'You\'re All Set!', description: 'You have everything you need to manage the platform. Let\'s go!', tip: 'Monitor payouts to ensure timely creator payments.' },
  ],
};

const OnboardingWizard: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const role = localStorage.getItem('role') || 'creator';
  const steps = STEPS[role] || STEPS.creator;

  useEffect(() => {
    const completed = localStorage.getItem('onboarding_completed');
    if (!completed) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setVisible(false);
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  if (!visible) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-up">
      <div className="bg-surface rounded-2xl shadow-premium max-w-lg w-full overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-surface-100">
          <div
            className="h-full bg-brand-500 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-6">
          <span className="text-xs font-bold text-surface-400 uppercase tracking-widest">
            Step {step + 1} of {steps.length}
          </span>
          <button
            onClick={handleComplete}
            className="text-surface-400 hover:text-surface-600 transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-8 text-center">
          <div className="w-16 h-16 bg-brand-50 border border-brand-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Icon size={28} className="text-brand-500" />
          </div>
          <h3 className="text-2xl font-extrabold text-surface-900 tracking-tight mb-3">
            {current.title}
          </h3>
          <p className="text-surface-500 text-sm leading-relaxed mb-6 max-w-sm mx-auto">
            {current.description}
          </p>
          <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-sm text-brand-700 font-medium">
            💡 {current.tip}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? 'bg-brand-500 w-6' : i < step ? 'bg-brand-300' : 'bg-surface-200'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleNext}
            className="bg-brand-400  hover:bg-brand-500  text-surface-900 px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
          >
            {isLast ? (
              <>
                Get Started <CheckCircle size={16} />
              </>
            ) : (
              <>
                Next <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
