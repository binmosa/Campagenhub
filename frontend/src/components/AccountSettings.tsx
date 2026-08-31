import React, { useState } from 'react';
import { Lock, Mail, Check, AlertCircle, Shield, MessageCircle, Copy, Link as LinkIcon, Loader2 } from 'lucide-react';
import api from '../lib/api';

const AccountSettings: React.FC = () => {
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pwMessage, setPwMessage] = useState('');

  // Email change
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState('');

  const [telegramStatus, setTelegramStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [telegramUser, setTelegramUser] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramBotLink, setTelegramBotLink] = useState('');
  const [generatingTbLink, setGeneratingTbLink] = useState(false);
  
  // Gamification Status
  const [points, setPoints] = useState(0);
  const [referralCode, setReferralCode] = useState('');

  React.useEffect(() => {
    checkTelegramStatus();
  }, []);

  const checkTelegramStatus = async () => {
    try {
      const res = await api.get('/telegram/status');
      if (res.data.connected) {
        setTelegramStatus('connected');
        setTelegramUser(res.data.username || 'User');
        setPoints(res.data.points || 0);
        setReferralCode(res.data.referral_code || '');
      } else {
        setTelegramStatus('disconnected');
      }
    } catch {
      setTelegramStatus('disconnected');
    }
  };

  const generateTelegramToken = async () => {
    setGeneratingTbLink(true);
    try {
      const res = await api.post('/telegram/generate-token');
      setTelegramToken(res.data.token);
      setTelegramBotLink(res.data.botLink);
    } catch {
      alert("Failed to generate token");
    } finally {
      setGeneratingTbLink(false);
    }
  };

  const disconnectTelegram = async () => {
    try {
      await api.post('/telegram/disconnect');
      setTelegramStatus('disconnected');
      setTelegramUser('');
    } catch {
      alert("Failed to disconnect");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwStatus('error');
      setPwMessage('Passwords do not match');
      setTimeout(() => { setPwStatus('idle'); setPwMessage(''); }, 3000);
      return;
    }
    if (newPassword.length < 6) {
      setPwStatus('error');
      setPwMessage('Password must be at least 6 characters');
      setTimeout(() => { setPwStatus('idle'); setPwMessage(''); }, 3000);
      return;
    }
    setPwStatus('loading');
    try {
      const res = await api.post('/auth/change-password', { currentPassword, newPassword });
      setPwStatus('success');
      setPwMessage(res.data.message || 'Password updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setPwStatus('idle'); setPwMessage(''); }, 3000);
    } catch (err: any) {
      setPwStatus('error');
      setPwMessage(err.response?.data?.message || 'Failed to update password');
      setTimeout(() => { setPwStatus('idle'); setPwMessage(''); }, 3000);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes('@')) {
      setEmailStatus('error');
      setEmailMessage('Enter a valid email');
      setTimeout(() => { setEmailStatus('idle'); setEmailMessage(''); }, 3000);
      return;
    }
    setEmailStatus('loading');
    try {
      const res = await api.post('/auth/change-email', { newEmail, currentPassword: emailPassword });
      setEmailStatus('success');
      setEmailMessage('Email updated! You may need to re-login.');
      if (res.data.access_token) {
        localStorage.setItem('token', res.data.access_token);
      }
      setNewEmail('');
      setEmailPassword('');
      setTimeout(() => { setEmailStatus('idle'); setEmailMessage(''); }, 3000);
    } catch (err: any) {
      setEmailStatus('error');
      setEmailMessage(err.response?.data?.message || 'Failed to update email');
      setTimeout(() => { setEmailStatus('idle'); setEmailMessage(''); }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="card p-6 md:p-8 relative">
        <h2 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2 border-b border-surface-100 pb-3">
          <Shield size={20} className="text-brand-500"/>
          Security Settings
        </h2>
        
        <div className="mb-8">
          <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
            <Lock size={16} className="text-surface-400"/> Change Password
          </h3>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-surface-600">Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                className="w-full bg-surface border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition-all text-surface-900 shadow-sm" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-surface-600">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
                  className="w-full bg-surface border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition-all text-surface-900 shadow-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-surface-600">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                  className="w-full bg-surface border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition-all text-surface-900 shadow-sm" />
              </div>
            </div>
            {pwMessage && (
              <div className={`flex items-center gap-2 text-sm font-bold p-3 rounded-lg ${pwStatus === 'success' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {pwStatus === 'success' ? <Check size={16} /> : <AlertCircle size={16} />} {pwMessage}
              </div>
            )}
            <button type="submit" disabled={pwStatus === 'loading'}
              className="bg-surface-900 hover:bg-surface-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 flex items-center gap-2">
              {pwStatus === 'loading' ? 'Updating...' : <><Lock size={14} /> Update Password</>}
            </button>
          </form>
        </div>

        <div className="border-t border-surface-100 pt-8">
          <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
            <Mail size={16} className="text-surface-400"/> Change Email Address
          </h3>
          <form onSubmit={handleEmailChange} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-surface-600">New Email</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                  className="w-full bg-surface border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition-all text-surface-900 shadow-sm" placeholder="new@email.com" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-surface-600">Current Password</label>
                <input type="password" value={emailPassword} onChange={e => setEmailPassword(e.target.value)} required
                  className="w-full bg-surface border border-surface-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-500 transition-all text-surface-900 shadow-sm" placeholder="Your current password" />
              </div>
            </div>
            {emailMessage && (
              <div className={`flex items-center gap-2 text-sm font-bold p-3 rounded-lg ${emailStatus === 'success' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {emailStatus === 'success' ? <Check size={16} /> : <AlertCircle size={16} />} {emailMessage}
              </div>
            )}
            <button type="submit" disabled={emailStatus === 'loading'}
              className="bg-surface-900 hover:bg-surface-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 flex items-center gap-2">
              {emailStatus === 'loading' ? 'Updating...' : <><Mail size={14} /> Update Email</>}
            </button>
          </form>
        </div>

        {/* Telegram Integration */}
        <div className="border-t border-surface-100 pt-8">
          <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
            <MessageCircle size={16} className="text-[#0088cc]"/> Telegram Integration
          </h3>
          <p className="text-sm text-surface-500 mb-4">Connect your Telegram account to instantly receive campaign alerts, application updates, and interaction challenges.</p>
          
          {telegramStatus === 'loading' ? (
            <div className="flex items-center gap-2 text-sm text-surface-500"><Loader2 className="animate-spin" size={16}/> Checking status...</div>
          ) : telegramStatus === 'connected' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">
                  <Check size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-green-800">Connected to Telegram</div>
                  <div className="text-xs text-green-700 font-medium">As @{telegramUser}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.open('https://t.me/official_CampaignHub_bot', '_blank')} 
                  className="text-xs font-bold text-[#0088cc] hover:text-[#0077b5] bg-blue-50 px-4 py-2 rounded-lg transition-colors border border-blue-100">
                  Open Bot
                </button>
                <button onClick={disconnectTelegram} className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 px-4 py-2 rounded-lg transition-colors border border-red-100">
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!telegramToken ? (
                <button onClick={generateTelegramToken} disabled={generatingTbLink} className="bg-[#0088cc] hover:bg-[#0077b5] text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 disabled:opacity-50">
                  {generatingTbLink ? <Loader2 className="animate-spin" size={16}/> : <LinkIcon size={16} />}
                  Connect Telegram Account
                </button>
              ) : (
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-5 space-y-4 animate-fade-in">
                  <div className="text-sm font-bold text-surface-900">Follow these steps to connect:</div>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                      <div className="text-sm text-surface-700 mt-0.5">Click the link below to open the CampaignHub bot in Telegram.</div>
                    </div>
                    <a href={telegramBotLink} target="_blank" rel="noreferrer" className="ml-9 inline-flex text-sm font-bold text-[#0088cc] hover:text-[#0077b5] gap-1 items-center">
                      Open Telegram Bot <LinkIcon size={14} />
                    </a>
                    
                    <div className="flex items-start gap-3 mt-2">
                      <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                      <div className="text-sm text-surface-700 mt-0.5">Click <strong>START</strong> in the bot chat. Your account will automatically link!</div>
                    </div>
                    <div className="flex items-start gap-3 mt-2">
                      <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                      <div className="text-sm text-surface-700 mt-0.5">Return here and click the button below to verify.</div>
                    </div>
                  </div>
                  <div className="pt-4 mt-2 border-t border-surface-200">
                     <button onClick={checkTelegramStatus} className="bg-surface-900 text-white hover:bg-surface-800 px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow flex items-center gap-2">
                        <Check size={16} /> I've connected the bot
                     </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Gamification Dashboard */}
        <div className="border-t border-surface-100 pt-8">
          <h3 className="text-sm font-bold text-surface-900 mb-4 flex items-center gap-2">
            <Shield size={16} className="text-brand-500"/> Gamification & Rewards
          </h3>
          <p className="text-sm text-surface-500 mb-6">Earn points by completing daily challenges and inviting friends via the Telegram Bot.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-brand-50 dark:bg-brand-500/10 p-6 rounded-xl border border-brand-200 dark:border-brand-500/20 flex flex-col items-center text-center">
               <div className="w-14 h-14 bg-surface dark:bg-surface-800 rounded-full flex items-center justify-center shadow-sm text-brand-500 mb-3 border border-brand-100 dark:border-brand-500/20">
                  <span className="text-xl font-extrabold">{points}</span>
               </div>
               <div className="font-bold text-brand-900">Total Points</div>
               <div className="text-xs text-brand-700 mt-1">Check Telegram `/challenge` for more.</div>
            </div>
            
            <div className="bg-surface-50 p-6 rounded-xl border border-surface-200">
               <div className="font-bold text-surface-900 mb-2">Refer & Earn</div>
               <div className="text-xs text-surface-600 mb-4">Invite users to the platform through your referral link. You earn 250 points for every new user!</div>
               {referralCode ? (
                 <div className="flex items-center gap-2 bg-surface dark:bg-surface-800 border border-surface-200 rounded-lg p-2">
                    <input 
                      readOnly 
                      value={`https://t.me/official_CampaignHub_bot?start=REF_${referralCode}`}
                      className="bg-transparent text-xs text-surface-600 w-full outline-none px-2"
                    />
                    <button 
                      onClick={() => {
                         navigator.clipboard.writeText(`https://t.me/official_CampaignHub_bot?start=REF_${referralCode}`);
                         alert('Link Copied!');
                      }}
                      className="p-1.5 bg-surface-100 hover:bg-surface-200 rounded text-surface-600 transition-colors"
                    >
                      <Copy size={14}/>
                    </button>
                 </div>
               ) : (
                 <div className="text-sm text-surface-500 italic bg-surface dark:bg-surface-800 p-3 rounded-lg border border-surface-200 text-center">
                    Generate an invite link via `/invite` in the Telegram bot to start earning!
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
