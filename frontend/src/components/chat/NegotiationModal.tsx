import React, { useEffect, useState, useCallback } from 'react';
import { 
  DollarSign, Calendar, Clock, Edit, FileText, 
  CheckCircle, RefreshCw, MessageCircle,
  AlertCircle, X
} from 'lucide-react';
import api, { serverOrigin } from '../../lib/api';
import { ChatWindow } from './ChatWindow';
import { VideoPitchRecorder } from '../common/VideoPitchRecorder';
import { Video } from 'lucide-react';

interface NegotiationModalProps {
  inviteId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export const NegotiationModal: React.FC<NegotiationModalProps> = ({ inviteId, onClose, onUpdate }) => {
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [negotiationForm, setNegotiationForm] = useState({
    payment_amount: '',
    payment_frequency: 'monthly',
    currency: 'NGN',
    contract_content: ''
  });

  const token = localStorage.getItem('token');
  const currentUserId = token
    ? (() => {
        try {
          return JSON.parse(atob(token.split('.')[1])).sub;
        } catch {
          return '';
        }
      })()
    : '';

  const fetchInvite = useCallback(async () => {
    try {
      const res = await api.get(`/invitations/${inviteId}`);
      setInvite(res.data);
      setNegotiationForm({
        payment_amount: res.data.payment_amount?.toString() || '',
        payment_frequency: res.data.payment_frequency || 'monthly',
        currency: res.data.currency || 'NGN',
        contract_content: res.data.contract_content || ''
      });
    } catch (e) {
      console.error('Failed to load invitation', e);
    } finally {
      setLoading(false);
    }
  }, [inviteId]);

  useEffect(() => {
    fetchInvite();
    
    // Mark relevant notifications as read
    api.post(`/notifications/read-by-reference/${inviteId}`).catch(() => {});

    // Poll for live updates every 5 seconds
    const interval = setInterval(fetchInvite, 5000);
    return () => clearInterval(interval);
  }, [fetchInvite, inviteId]);

  const handleNegotiate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/invitations/${inviteId}/negotiate`, {
        payment_amount: parseFloat(negotiationForm.payment_amount),
        payment_frequency: negotiationForm.payment_frequency,
        currency: negotiationForm.currency,
        contract_content: negotiationForm.contract_content
      });
      setIsNegotiating(false);
      fetchInvite();
      onUpdate();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to update offer');
    }
  };

  const handleVideoComplete = async (base64: string | null) => {
    if (!base64) {
      // Logic for deleting video could go here if needed
      return;
    }
    try {
      const uploadRes = await api.post('/uploads', {
        file: base64,
        filename: `negotiation-pitch-${Date.now()}.webm`
      });
      const videoUrl = uploadRes.data.url;
      
      // Update invitation video link
      await api.patch(`/invitations/${inviteId}/negotiate`, {
        video_link: videoUrl
      });
      fetchInvite();
    } catch (e) {
      alert('Failed to upload video pitch');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl">
          <RefreshCw size={32} className="animate-spin text-brand-500" />
          <p className="text-sm font-bold text-surface-900">Syncing negotiation terms...</p>
        </div>
      </div>
    );
  }

  const role = localStorage.getItem('role') || 'creator';
  const isSender = invite?.sender?.id === currentUserId;
  const counterparty = isSender ? invite?.receiver : invite?.sender;

  return (
    <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-0 md:p-6 lg:p-12" onClick={onClose}>
      <div 
        className="bg-white w-full h-full max-w-6xl md:h-[85vh] rounded-none md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-lg shadow-lg">
              {(counterparty?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-extrabold text-surface-900 leading-tight">Negotiation with {counterparty?.email?.split('@')[0]}</h2>
              <p className="text-[10px] text-surface-400 font-bold uppercase tracking-widest">{invite?.type?.replace('_', ' ')} • Real-time Sync</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl bg-surface-50 text-surface-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-surface-50">
          {/* Sidebar: Details */}
          <div className="w-full md:w-80 border-r border-surface-200 bg-white overflow-y-auto p-6 space-y-8 shrink-0">
            {/* Financial Terms */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-surface-400 uppercase tracking-[0.2em]">Financial Terms</span>
                {invite?.status === 'pending' && (
                  <button 
                    onClick={() => setIsNegotiating(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg text-[10px] font-bold transition-colors border border-brand-100"
                  >
                    <Edit size={12} />
                    {role === 'brand' ? 'Edit Terms' : 'Counter Offer'}
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="p-4 bg-surface-50 border border-surface-100 rounded-2xl space-y-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <DollarSign size={40} className="text-brand-500" />
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-surface-400 uppercase">Amount</p>
                      <p className="text-sm font-extrabold text-surface-900">
                        {invite?.currency} {Number(invite?.payment_amount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-surface-400 uppercase">Frequency</p>
                      <p className="text-sm font-bold text-surface-700 capitalize">
                        {invite?.payment_frequency}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
                  invite?.status === 'accepted' ? 'bg-green-50 border-green-100 text-green-700' : 
                  invite?.status === 'pending' ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-surface-50 border-surface-200 text-surface-500'
                }`}>
                  <div className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center shrink-0">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-60">Status</p>
                    <p className="text-xs font-extrabold capitalize">{invite?.status}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Approval Logic */}
            {invite?.status === 'pending' && (
              <div className="space-y-3">
                {role === 'brand' && !invite?.payment_approved && (
                  <button 
                    onClick={async () => {
                      try {
                        await api.patch(`/invitations/${inviteId}/approve-payment`);
                        fetchInvite();
                        onUpdate();
                      } catch (e) {
                        alert('Failed to approve payment');
                      }
                    }}
                    className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={14} /> Approve Terms
                  </button>
                )}

                {role === 'creator' && !invite?.payment_approved && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-2">
                    <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 font-medium leading-tight">Waiting for brand to approve these payment terms before you can sign.</p>
                  </div>
                )}

                {role === 'creator' && invite.payment_approved && (
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        try {
                          await api.patch(`/invitations/${inviteId}/accept`);
                          fetchInvite();
                          onUpdate();
                        } catch (e: any) {
                          alert(e?.response?.data?.message || 'Failed to accept invitation');
                        }
                      }}
                      className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-green-100"
                    >
                      Accept Invite
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          await api.patch(`/invitations/${inviteId}/decline`);
                          fetchInvite();
                          onUpdate();
                        } catch (e: any) {
                          alert(e?.response?.data?.message || 'Failed to decline invitation');
                        }
                      }}
                      className="flex-1 py-3 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl text-xs font-bold transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-surface-400 uppercase tracking-[0.2em]">Personal Note</span>
                {role === 'brand' && invite?.status === 'pending' && (
                  <button 
                    onClick={async () => {
                      const newMsg = prompt('Edit invitation message:', invite?.message || '');
                      if (newMsg !== null) {
                        try {
                          await api.patch(`/invitations/${inviteId}/message`, { message: newMsg });
                          fetchInvite();
                        } catch (e: any) {
                          alert(e?.response?.data?.message || 'Failed to edit invitation');
                        }
                      }
                    }}
                    className="text-brand-600 hover:text-brand-800 text-[10px] font-bold"
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="p-3 bg-brand-50/30 border border-brand-100/50 rounded-xl text-[11px] text-surface-600 italic leading-relaxed">
                "{invite?.message || 'No message provided.'}"
              </div>
            </div>

            {invite?.video_link && (
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-surface-400 uppercase tracking-[0.2em]">Video Introduction</span>
                <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-sm border border-surface-200">
                  <video 
                    src={invite.video_link.startsWith('http') ? invite.video_link : `${serverOrigin}${invite.video_link}`} 
                    controls 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {invite?.status === 'pending' && !invite.video_link && (
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-surface-400 uppercase tracking-[0.2em]">Record Pitch</span>
                <VideoPitchRecorder 
                  onRecordingComplete={handleVideoComplete}
                  maxDuration={60}
                />
              </div>
            )}

            {invite?.contract_content && (
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-surface-400 uppercase tracking-[0.2em]">Contract snippet</span>
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-3 text-[10px] text-surface-500 leading-relaxed font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {invite?.contract_content}
                </div>
              </div>
            )}
          </div>

          {/* Main: Chat */}
          <div className="flex-1 flex flex-col relative bg-surface-50 p-2 md:p-4">
            <div className="flex-1 bg-white rounded-3xl border border-surface-200 shadow-inner overflow-hidden relative">
              <ChatWindow
                applicationId={inviteId}
                currentUserId={currentUserId}
                onClose={() => {}} // Inline chat should not close the negotiation modal
                brandName={invite?.brand?.email || invite?.sender?.email}
                creatorName={invite?.receiver?.email}
                isInline={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Internal Negotiation Modal */}
      {isNegotiating && (
        <div 
          className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={(e) => { e.stopPropagation(); setIsNegotiating(false); }}
        >
          <div 
            className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-surface-100 flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-surface-900 uppercase tracking-tight">Edit Proposed Terms</h3>
              <button 
                onClick={() => setIsNegotiating(false)}
                className="w-8 h-8 rounded-lg bg-surface-50 text-surface-400 flex items-center justify-center hover:bg-surface-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleNegotiate} className="p-6 space-y-5">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-extrabold text-surface-400 uppercase tracking-widest">Amount</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 font-bold text-sm">
                      {negotiationForm.currency}
                    </div>
                    <input
                      type="number"
                      value={negotiationForm.payment_amount}
                      onChange={e => setNegotiationForm(v => ({...v, payment_amount: e.target.value}))}
                      className="w-full pl-14 pr-4 py-3 bg-surface-50 border border-surface-200 rounded-2xl font-bold text-surface-900 focus:border-brand-500 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-extrabold text-surface-400 uppercase tracking-widest">Frequency</label>
                  <select
                    value={negotiationForm.payment_frequency}
                    onChange={e => setNegotiationForm(v => ({...v, payment_frequency: e.target.value}))}
                    className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-2xl font-bold text-surface-900 focus:border-brand-500 outline-none transition-all appearance-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="project">Per Project</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-extrabold text-surface-400 uppercase tracking-widest">Contract Content</label>
                  <button 
                    type="button"
                    onClick={() => {
                      const newContent = `${negotiationForm.contract_content}\n\n[UPDATE]: Terms adjusted to ${negotiationForm.currency} ${negotiationForm.payment_amount} paid ${negotiationForm.payment_frequency}.`;
                      setNegotiationForm(v => ({ ...v, contract_content: newContent }));
                    }}
                    className="text-[10px] text-brand-600 font-bold hover:underline"
                  >
                    Auto-append terms
                  </button>
                </div>
                <textarea
                  value={negotiationForm.contract_content}
                  onChange={e => setNegotiationForm(v => ({...v, contract_content: e.target.value}))}
                  rows={6}
                  className="w-full px-4 py-3 bg-surface-50 border border-surface-200 rounded-2xl font-mono text-[11px] text-surface-700 focus:border-brand-500 outline-none transition-all resize-none shadow-inner"
                  placeholder="Enter full contract text here..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-2xl shadow-xl shadow-brand-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle size={18} /> Update Terms & Contract
              </button>
              
              <p className="text-[10px] text-surface-400 text-center px-4 font-medium italic">
                Updating terms will notify the other party and reset current segment approvals.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
