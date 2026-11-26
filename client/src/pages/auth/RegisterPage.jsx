import { Building2, ShieldCheck, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [organizations, setOrganizations] = useState([]);
  const [mode, setMode] = useState('visitor'); // 'visitor' | 'org'
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    company: '',
    organizationId: '',
    organizationName: '',
    industry: 'Corporate',
    locationName: 'Main Campus',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/organizations/public')
      .then(({ data }) => {
        setOrganizations(data.organizations || []);
        if (data.organizations?.length) {
          setForm((prev) => ({
            ...prev,
            organizationId: data.organizations[0]._id,
            locationName: data.organizations[0].locations?.[0]?.name || 'Main Campus',
          }));
        }
      })
      .catch(() => {});
  }, []);

  const selectedOrg = organizations.find((o) => o._id === form.organizationId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload =
        mode === 'org'
          ? {
              name: form.name,
              email: form.email,
              phone: form.phone,
              password: form.password,
              createOrganization: true,
              organizationName: form.organizationName,
              industry: form.industry,
              locationName: form.locationName || 'Main Campus',
            }
          : {
              name: form.name,
              email: form.email,
              phone: form.phone,
              password: form.password,
              company: form.company || 'Independent',
              organizationId: form.organizationId,
              locationName: form.locationName,
            };

      const data = await register(payload);
      navigate('/verify-otp', {
        state: {
          devOtpPreview: data.devOtpPreview || '',
          nextPath: data.user.role === 'admin' ? '/admin' : '/visitor',
        },
      });
    } catch (err) {
      setError(extractErrorMessage(err, 'Registration failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-lg border border-slate-200 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Create GatePass Account</h1>
              <p className="text-xs text-slate-500">Visitor registration or organization onboarding</p>
            </div>
          </div>
          <Link to="/login" className="text-sm font-semibold text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('visitor')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium cursor-pointer ${
              mode === 'visitor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Visitor Account
          </button>
          <button
            type="button"
            onClick={() => setMode('org')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium cursor-pointer ${
              mode === 'org' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Building2 className="h-4 w-4" />
            New Organization
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'visitor' ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization to Visit
                </label>
                <select
                  value={form.organizationId}
                  onChange={(e) => {
                    const org = organizations.find((o) => o._id === e.target.value);
                    setForm({
                      ...form,
                      organizationId: e.target.value,
                      locationName: org?.locations?.[0]?.name || 'Main Campus',
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name}
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
                  {(selectedOrg?.locations || [{ name: 'Main Campus' }]).map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  placeholder="Acme Robotics Inc."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Campus Name
                </label>
                <input
                  type="text"
                  required
                  value={form.locationName}
                  onChange={(e) => setForm({ ...form, locationName: e.target.value })}
                  placeholder="HQ Campus"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jordan Taylor"
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
                placeholder="+15550199999"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jordan@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          {mode === 'visitor' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Institution
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Independent / Acme Labs"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
          >
            {submitting
              ? 'Creating account...'
              : mode === 'org'
                ? 'Create Organization & Admin Account'
                : 'Register & Continue to OTP'}
          </button>
        </form>
      </div>
    </div>
  );
}
