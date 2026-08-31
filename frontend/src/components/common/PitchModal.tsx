import React, { useState } from 'react';
import { X, Sparkles, Copy, CheckCircle } from 'lucide-react';
import api from '../../lib/api';

interface PitchModalProps {
  onClose: () => void;
  defaultCampaignName?: string;
  defaultCreatorName?: string;
}

export const PitchModal: React.FC<PitchModalProps> = ({ onClose, defaultCampaignName = '', defaultCreatorName = '' }) => {
  const [campaignName, setCampaignName] = useState(defaultCampaignName);
  const [creatorName, setCreatorName] = useState(defaultCreatorName);
  const [targetAudience, setTargetAudience] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [tone, setTone] = useState('Professional');
  
  const [loading, setLoading] = useState(false);
  const [pitchResult, setPitchResult] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState('');

  const generatePitch = async () => {
    if (!campaignName || !targetAudience) {
      setError('Please fill in required fields (Campaign Name, Target Audience)');
      return;
    }
    setError('');
    setLoading(true);
    setPitchResult([]);
    
    try {
      const res = await api.post('/pitch', {
        campaignName,
        creatorName,
        targetAudience,
        keyPoints,
        tone
      });
      
      if (res.data && res.data.pitches) {
        setPitchResult(res.data.pitches);
      } else {
        setPitchResult(['Received an empty response, please try again.']);
      }
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Failed to generate pitch.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-surface-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-surface-200 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-surface-100 flex-shrink-0">
          <h2 className="text-xl font-extrabold text-surface-900 flex items-center gap-2">
            <Sparkles className="text-brand-500" size={24} /> AI Pitch Generator
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-xl transition-colors">
            <X size={20} className="text-surface-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 font-medium text-sm space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1">Campaign/Offer Name *</label>
              <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Summer Tech Launch"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200" />
            </div>
            <div>
              <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1">Your Name/Brand *</label>
              <input value={creatorName} onChange={e => setCreatorName(e.target.value)} placeholder="e.g. Alex (Tech Reviewer)"
                className="w-full px-4 py-2.5 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1">Target Audience *</label>
            <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g. Gen Z Gamers, Tech Enthusiasts"
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200" />
          </div>

          <div>
            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1">Key Points / Details</label>
            <textarea rows={3} value={keyPoints} onChange={e => setKeyPoints(e.target.value)} placeholder="Why are you a good fit? Any specific metrics or ideas?"
              className="w-full px-4 py-3 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200 resize-none" />
          </div>

          <div>
            <label className="text-xs font-bold text-surface-500 uppercase tracking-wider block mb-1">Tone of Voice</label>
            <select value={tone} onChange={e => setTone(e.target.value)}
              className="w-full px-4 py-2.5 border border-surface-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200">
              <option value="Professional">Professional & Formal</option>
              <option value="Casual">Casual & Friendly</option>
              <option value="Enthusiastic">Enthusiastic & High Energy</option>
              <option value="Humorous">Humorous & Witty</option>
              <option value="Persuasive">Persuasive & Value-Driven</option>
            </select>
          </div>

          <button onClick={generatePitch} disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-brand-500 to-violet-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex items-center justify-center gap-2 group disabled:opacity-50">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Sparkles size={18} className="group-hover:scale-110 transition-transform" /> Generate Professional Pitch</>
            )}
          </button>

          {pitchResult.length > 0 && (
            <div className="mt-8 space-y-4">
              <h3 className="font-extrabold text-surface-900 border-b border-surface-100 pb-2">Generated Options</h3>
              {pitchResult.map((pitch, idx) => (
                <div key={idx} className="relative group bg-surface-50 border border-surface-200 rounded-xl p-4 pr-12 hover:border-brand-300 transition-colors">
                  <p className="whitespace-pre-wrap text-surface-700 leading-relaxed text-sm">{pitch}</p>
                  <button 
                    onClick={() => copyToClipboard(pitch, idx)}
                    className="absolute top-4 right-4 p-2 bg-white border border-surface-200 rounded-lg text-surface-500 hover:text-brand-600 hover:border-brand-300 transition-colors shadow-sm"
                    title="Copy to clipboard"
                  >
                    {copiedIndex === idx ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
