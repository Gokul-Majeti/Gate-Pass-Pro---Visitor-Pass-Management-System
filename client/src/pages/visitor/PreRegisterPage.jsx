import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '../../api/client.js';
import { WebcamCapture } from '../../components/WebcamCapture.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

function toLocalDateTimeInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PreRegisterPage() {
  const { user, organization } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 30 * 60 * 1000);
  const defaultEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const [hosts, setHosts] = useState([]);
  const [form, setForm] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    company: '',
    idType: 'national_id',
    idNumber: '',
    vehicleNumber: '',
    hostId: '',
    locationName: organization?.locations?.[0]?.name || 'Main Campus',
    purpose: '',
    category: 'business_meeting',
    scheduledStart: toLocalDateTimeInput(defaultStart),
    scheduledEnd: toLocalDateTimeInput(defaultEnd),
    photoBase64: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    Promise.all([api.get('/users/hosts'), api.get('/visitors/me')])
      .then(([hostsRes, visitorRes]) => {
        const list = hostsRes.data.hosts || [];
        setHosts(list);
        const preferredHost = list.find((h) => h.email === 'host@apextech.com') || list[0];
        const v = visitorRes.data.visitor;
        setForm((prev) => ({
          ...prev,
          hostId: preferredHost?._id || '',
          fullName: v?.fullName || prev.fullName,
          phone: v?.phone && v.phone !== 'Not provided' ? v.phone : prev.phone,
          company: v?.company || prev.company,
          idType: v?.idType || prev.idType,
          idNumber: v?.idNumber || prev.idNumber,
          vehicleNumber: v?.vehicleNumber || prev.vehicleNumber,
        }));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/appointments/pre-register', {
        ...form,
        scheduledStart: new Date(form.scheduledStart).toISOString(),
        scheduledEnd: new Date(form.scheduledEnd).toISOString(),
      });
      setSuccessMsg('Pre-registration submitted! Your host has been notified.');
      setTimeout(() => navigate('/visitor'), 1000);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to submit pre-registration'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pre-Register Your Visit</h1>
        <p className="text-sm text-slate-500">
          Submit your details, photo, and meeting window to request host approval at{' '}
          <strong>{organization?.name}</strong>.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{successMsg}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6"
      >
        <WebcamCapture
          value={form.photoBase64}
          onChange={(val) => setForm((p) => ({ ...p, photoBase64: val }))}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Acme Corp"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Government / Org ID
            </label>
            <div className="flex gap-2">
              <select
                value={form.idType}
                onChange={(e) => setForm({ ...form, idType: e.target.value })}
                className="px-2.5 py-2.5 rounded-xl border border-slate-300 text-xs bg-white"
              >
                <option value="national_id">National ID</option>
                <option value="passport">Passport</option>
                <option value="driving_license">Driver License</option>
                <option value="employee_id">Employee ID</option>
              </select>
              <input
                type="text"
                value={form.idNumber}
                onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
                placeholder="ID Number"
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>
        </div>

        <hr className="border-slate-200" />

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Host / Employee Visiting
            </label>
            <select
              required
              value={form.hostId}
              onChange={(e) => setForm({ ...form, hostId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {hosts.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} ({h.department} • {h.locationName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Campus Location
            </label>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Visit Category
            </label>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vehicle Number (Optional)
            </label>
            <input
              type="text"
              value={form.vehicleNumber}
              onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
              placeholder="ABC-1234"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Scheduled Arrival
            </label>
            <input
              type="datetime-local"
              required
              value={form.scheduledStart}
              onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expected Departure
            </label>
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
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Purpose of Visit
          </label>
          <textarea
            required
            rows={2}
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            placeholder="Describe meeting topic or department visit..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
        >
          <CalendarCheck className="h-4 w-4" />
          {submitting ? 'Submitting...' : 'Submit Pre-Registration'}
        </button>
      </form>
    </div>
  );
}
