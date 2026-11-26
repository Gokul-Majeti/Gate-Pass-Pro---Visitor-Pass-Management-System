import { ArrowRight, Building2, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@apextech.com', badge: 'Full System & Analytics' },
  { label: 'Security', email: 'security@apextech.com', badge: 'QR Scanner & Passes' },
  { label: 'Host', email: 'host@apextech.com', badge: 'Invite & Approve' },
  { label: 'Visitor', email: 'visitor@example.com', badge: 'Pre-Register & Pass' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@apextech.com');
  const [password, setPassword] = useState('Password@123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const routeByRole = (role) => {
    if (role === 'admin') return '/admin';
    if (role === 'security') return '/security';
    if (role === 'host') return '/host';
    return '/visitor';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await login(email, password);
      navigate(routeByRole(data.user.role));
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to sign in'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password@123');
    setError('');
    setSubmitting(true);
    try {
      const data = await login(demoEmail, 'Password@123');
      navigate(routeByRole(data.user.role));
    } catch (err) {
      setError(extractErrorMessage(err, 'Demo login failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid md:grid-cols-5 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="md:col-span-2 bg-slate-900 text-white p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">GatePass Pro</div>
                <div className="text-xs text-slate-400">Digital Visitor Management</div>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold leading-snug">
                Smart, QR-Verified Access for Modern Campuses
              </h1>
              <p className="text-sm text-slate-300">
                Pre-registration, host approvals, signed QR badges, PDF passes, OTP security gates,
                and real-time analytics.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              One-Click Demo Sign-In (Apex Tech)
            </div>
            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickDemo(acc.email)}
                  className="text-left px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{acc.label}</div>
                    <div className="text-[11px] text-slate-300">{acc.badge}</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-blue-300" />
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 pt-1">
              Multi-org test: <span className="font-mono-code">admin@novabio.com</span>
            </p>
          </div>
        </div>

        <div className="md:col-span-3 p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Sign in to your account</h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your credentials or select a demo role on the left.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-600">Visiting or onboarding an organization?</span>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-700"
            >
              <Building2 className="h-4 w-4" />
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
