import { CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '../../api/client.js';
import { WebcamCapture } from '../../components/WebcamCapture.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

function toLocalDateTimeInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function InviteVisitorPage() {
  const { organization, user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    idType: 'national_id',
    idNumber: '',
    locationName: user?.locationName || organization?.locations?.[0]?.name || 'Main Campus',
    purpose: '',
    category: 'business_meeting',
    scheduledStart: toLocalDateTimeInput(now),
    scheduledEnd: toLocalDateTimeInput(defaultEnd),
    requireOtp: Boolean(organization?.settings?.requireOtpAtGate),
    approvalNote: '',
    photoBase64: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resultInfo, setResultInfo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/appointments/invite', {
        ...form,
        scheduledStart: new Date(form.scheduledStart).toISOString(),
        scheduledEnd: new Date(form.scheduledEnd).toISOString(),
      });
      setResultInfo(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send invitation'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invite a Visitor</h1>
        <p className="text-sm text-slate-500">
          Pre-approve a guest immediately and send an Email/SMS invitation.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {resultInfo && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Invitation Sent & Pre-Approved
          </div>
          <p className="text-sm text-emerald-800">
            Visitor <strong>{resultInfo.appointment?.visitorId?.fullName}</strong> has been invited
            and notified.
          </p>
          {resultInfo.devGateOtpPreview && (
            <p className="text-xs text-emerald-900 bg-white/70 rounded-lg px-3 py-2 inline-block">
              Gate OTP (Dev Preview):{' '}
              <strong className="font-mono-code">{resultInfo.devGateOtpPreview}</strong>
            </p>
          )}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/host')}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer"
            >
              Back to Host Dashboard
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5"
      >
        <WebcamCapture
          value={form.photoBase64}
          onChange={(val) => setForm((p) => ({ ...p, photoBase64: val }))}
          label="Visitor Photo (Optional)"
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Samira Al-Mansoor"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="samira@partner.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+15552223344"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Partner Consulting"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
            <select
              value={form.locationName}
              onChange={(e) => setForm({ ...form, locationName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {(organization?.locations || [{ name: 'Main Campus' }]).map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="business_meeting">Business Meeting</option>
              <option value="interview">Interview</option>
              <option value="vendor">Vendor / Contractor</option>
              <option value="delivery">Delivery</option>
              <option value="maintenance">Maintenance</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
            <input
              type="datetime-local"
              required
              value={form.scheduledStart}
              onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
            <input
              type="datetime-local"
              required
              value={form.scheduledEnd}
              onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose</label>
          <input
            type="text"
            required
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            placeholder="Quarterly Roadmap Sync"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.requireOtp}
            onChange={(e) => setForm({ ...form, requireOtp: e.target.checked })}
            className="rounded border-slate-300 h-4 w-4 text-blue-600"
          />
          <span>Require 6-digit Gate OTP verification at security check-in</span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Sending Invitation...' : 'Send Invite & Approve'}
        </button>
      </form>
    </div>
  );
}
