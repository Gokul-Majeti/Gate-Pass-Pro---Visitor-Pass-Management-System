import { BadgeCheck, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, extractErrorMessage } from '../../api/client.js';
import { PassCardModal } from '../../components/PassCardModal.jsx';
import { WebcamCapture } from '../../components/WebcamCapture.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function WalkInPage() {
  const { organization, user } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    idType: 'national_id',
    idNumber: '',
    vehicleNumber: '',
    hostId: '',
    locationName: user?.locationName || organization?.locations?.[0]?.name || 'Main Campus',
    purpose: '',
    category: 'business_meeting',
    durationHours: organization?.settings?.defaultPassDurationHours || 8,
    photoBase64: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [issuedPass, setIssuedPass] = useState(null);

  useEffect(() => {
    api
      .get('/users/hosts')
      .then(({ data }) => {
        const list = data.hosts || [];
        setHosts(list);
        if (list[0]?._id) {
          setForm((prev) => ({ ...prev, hostId: list[0]._id }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/passes/walk-in', form);
      setIssuedPass(data.pass);
      setForm((prev) => ({
        ...prev,
        fullName: '',
        email: '',
        phone: '',
        company: '',
        idNumber: '',
        vehicleNumber: '',
        purpose: '',
        photoBase64: '',
      }));
    } catch (err) {
      setError(extractErrorMessage(err, 'Walk-in pass issuance failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Walk-In Visitor Desk</h1>
        <p className="text-sm text-slate-500">
          Capture visitor photo & details and generate an instant QR badge at reception.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5"
      >
        <WebcamCapture
          value={form.photoBase64}
          onChange={(val) => setForm((p) => ({ ...p, photoBase64: val }))}
          label="Capture or Upload Visitor Photo"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
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
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="Walk-In Guest"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ID Type & Number</label>
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
                placeholder="ID #"
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Host</label>
            <select
              required
              value={form.hostId}
              onChange={(e) => setForm({ ...form, hostId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {hosts.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} ({h.department})
                </option>
              ))}
            </select>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Validity (Hours)
            </label>
            <input
              type="number"
              min={1}
              max={72}
              value={form.durationHours}
              onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Purpose of Visit</label>
          <input
            type="text"
            required
            value={form.purpose}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            placeholder="Courier dropoff, impromptu client meeting, etc."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
        >
          {submitting ? (
            'Issuing Pass...'
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Register & Issue QR Badge
            </>
          )}
        </button>
      </form>

      {issuedPass && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-emerald-600" />
          <span>
            Walk-in pass <strong className="font-mono-code">{issuedPass.passCode}</strong> issued!
          </span>
        </div>
      )}

      <PassCardModal
        pass={issuedPass}
        organization={organization}
        onClose={() => setIssuedPass(null)}
      />
    </div>
  );
}
