import { CheckCircle2, KeyRound, Send } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function VerifyOtpPage() {
  const { user, updateUserState } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const initialPreview = location.state?.devOtpPreview || '';
  const nextPath =
    location.state?.nextPath || (user?.role === 'admin' ? '/admin' : '/visitor');

  const [otp, setOtp] = useState(initialPreview);
  const [devPreview, setDevPreview] = useState(initialPreview);
  const [channel, setChannel] = useState('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/send-otp', { channel });
      setMessage('A new 6-digit OTP has been dispatched.');
      if (data.devOtpPreview) {
        setDevPreview(data.devOtpPreview);
        setOtp(data.devOtpPreview);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { otp });
      updateUserState(data.user);
      navigate(nextPath);
    } catch (err) {
      setError(extractErrorMessage(err, 'OTP verification failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg border border-slate-200 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">OTP Verification</h1>
            <p className="text-xs text-slate-500">Verify {user?.email}</p>
          </div>
        </div>

        {devPreview && (
          <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-xs text-sky-900">
            <strong>Dev Notification Preview:</strong> Your OTP code is{' '}
            <span className="font-mono-code font-bold">{devPreview}</span>
          </div>
        )}

        {message && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Enter 6-Digit OTP
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono-code text-center text-xl tracking-[0.4em]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
          >
            <option value="email">Send via Email</option>
            <option value="sms">Send via SMS</option>
            <option value="both">Send Both</option>
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={handleSendOtp}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            Resend OTP
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate(nextPath)}
          className="w-full text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
