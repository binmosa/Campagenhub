import React, { useState, useEffect } from 'react';
import { X, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import api from '../../lib/api';

interface Contract {
  id: string;
  status: string;
  terms: string;
  payment_amount: number;
  contract_length: string;
}

interface ContractManagerProps {
  applicationId: string;
  isBrand: boolean;
  onClose: () => void;
}

export function ContractManager({ applicationId, isBrand, onClose }: ContractManagerProps) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [contractLength, setContractLength] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchContract();
  }, [applicationId]);

  const fetchContract = async () => {
    try {
      const res = await api.get(`/contracts/application/${applicationId}`);
      if (res.data) {
        setContract(res.data);
        setTerms(res.data.terms || '');
        setPaymentAmount(res.data.payment_amount || '');
        setContractLength(res.data.contract_length || '');
      }
    } catch (err) {
      console.error('Failed to fetch contract', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setError('');
      await api.post(`/contracts/application/${applicationId}`, {
        terms,
        paymentAmount: Number(paymentAmount),
        contractLength,
      });
      await fetchContract();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save contract');
    }
  };

  const handleRespond = async (status: 'approved' | 'rejected') => {
    try {
      setError('');
      await api.put(`/contracts/application/${applicationId}/respond`, { status });
      await fetchContract();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to respond to contract');
    }
  };

  if (loading) {
    return null; // Or a spinner
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-white/10 border-b border-white/10 p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Deal Contract</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {contract?.status && (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm">Target Status:</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                ['approved', 'active'].includes(contract.status) ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
                contract.status === 'pending_signature' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                'bg-white/10 text-white/70 border border-white/20'
              }`}>
                {contract.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Deliverables & Terms</label>
              {isBrand && !['approved', 'active'].includes(contract?.status ?? '') ? (
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 min-h-[150px]"
                  placeholder="Specify what the creator needs to do..."
                />
              ) : (
                <div className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-white/90 min-h-[150px] whitespace-pre-wrap">
                  {terms || 'No terms specified yet.'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Payment Amount ($)</label>
              {isBrand && !['approved', 'active'].includes(contract?.status ?? '') ? (
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g. 500"
                />
              ) : (
                <div className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-white/90 font-mono text-lg">
                  ${paymentAmount || '0.00'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Contract Length</label>
              {isBrand && !['approved', 'active'].includes(contract?.status ?? '') ? (
                <input
                  type="text"
                  value={contractLength}
                  onChange={(e) => setContractLength(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500/50"
                  placeholder="e.g. 3 Months, 1 Year..."
                />
              ) : (
                <div className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-white/90 font-mono text-lg">
                  {contractLength || 'N/A'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-black/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-white font-medium hover:bg-white/5 transition-colors border border-white/10"
          >
            Close
          </button>

          {isBrand && !['approved', 'active'].includes(contract?.status ?? '') && (
            <button
              onClick={handleSaveDraft}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <CheckCircle className="w-4 h-4" />
              Propose Contract
            </button>
          )}

          {!isBrand && contract?.status === 'pending_signature' && (
            <>
              <button
                onClick={() => handleRespond('rejected')}
                className="px-5 py-2.5 rounded-xl bg-red-500/20 text-red-300 font-medium hover:bg-red-500/30 transition-colors border border-red-500/30"
              >
                Decline
              </button>
              <button
                onClick={() => handleRespond('approved')}
                className="px-5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium transition-colors flex items-center gap-2 shadow-lg shadow-green-500/20"
              >
                <CheckCircle className="w-4 h-4" />
                Sign & Accept
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
