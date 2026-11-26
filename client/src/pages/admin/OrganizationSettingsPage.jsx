import { Building2, CheckCircle2, MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { api, extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function OrganizationSettingsPage() {
  const { organization, updateOrganizationState } = useAuth();

  const [settingsForm, setSettingsForm] = useState({
    name: organization?.name || '',
    industry: organization?.industry || '',
    requireHostApproval: organization?.settings?.requireHostApproval ?? true,
    requireOtpAtGate: organization?.settings?.requireOtpAtGate ?? false,
    defaultPassDurationHours: organization?.settings?.defaultPassDurationHours ?? 8,
    primaryColor: organization?.settings?.primaryColor || '#2563eb',
  });

  const [locForm, setLocForm] = useState({
    name: '',
    code: '',
    address: '',
    gatesText: 'Main Reception, Side Gate',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const { data } = await api.patch('/organizations/current', {
        name: settingsForm.name,
        industry: settingsForm.industry,
        settings: {
          requireHostApproval: settingsForm.requireHostApproval,
          requireOtpAtGate: settingsForm.requireOtpAtGate,
          defaultPassDurationHours: Number(settingsForm.defaultPassDurationHours),
          primaryColor: settingsForm.primaryColor,
        },
      });
      updateOrganizationState(data.organization);
      setMessage('Organization settings saved.');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const gates = locForm.gatesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const { data } = await api.post('/organizations/current/locations', {
        name: locForm.name,
        code: locForm.code,
        address: locForm.address,
        gates: gates.length ? gates : ['Main Reception'],
      });
      updateOrganizationState(data.organization);
      setLocForm({ name: '', code: '', address: '', gatesText: 'Main Reception' });
      setMessage('Campus location added.');
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Organization & Multi-Location Setup</h1>
        <p className="text-sm text-slate-500">
          Configure security gates, OTP policies, pass defaults, and branding for{' '}
          <strong>{organization?.name}</strong>.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{message}</span>
        </div>
      )}

      <form
        onSubmit={handleSaveSettings}
        className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5"
      >
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600" />
          General & Security Policies
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              required
              value={settingsForm.name}
              onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
            <input
              type="text"
              value={settingsForm.industry}
              onChange={(e) => setSettingsForm({ ...settingsForm, industry: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Default Walk-In Pass Duration (Hours)
            </label>
            <input
              type="number"
              min={1}
              max={72}
              value={settingsForm.defaultPassDurationHours}
              onChange={(e) =>
                setSettingsForm({ ...settingsForm, defaultPassDurationHours: e.target.value })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Badge Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settingsForm.primaryColor}
                onChange={(e) => setSettingsForm({ ...settingsForm, primaryColor: e.target.value })}
                className="h-10 w-14 rounded-lg border border-slate-300 cursor-pointer"
              />
              <span className="font-mono-code text-xs text-slate-600">
                {settingsForm.primaryColor}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={settingsForm.requireHostApproval}
              onChange={(e) =>
                setSettingsForm({ ...settingsForm, requireHostApproval: e.target.checked })
              }
              className="rounded border-slate-300 h-4 w-4"
            />
            <span>Require Host approval before pre-registered visitors can receive passes</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={settingsForm.requireOtpAtGate}
              onChange={(e) =>
                setSettingsForm({ ...settingsForm, requireOtpAtGate: e.target.checked })
              }
              className="rounded border-slate-300 h-4 w-4"
            />
            <span>Enforce 6-digit Gate OTP verification by default at security check-in</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          Campus Locations & Checkpoints ({organization?.locations?.length || 0})
        </h2>

        <div className="grid sm:grid-cols-2 gap-3">
          {(organization?.locations || []).map((loc) => (
            <div
              key={loc._id || loc.code}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-sm">{loc.name}</span>
                <span className="font-mono-code text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                  {loc.code}
                </span>
              </div>
              {loc.address && <p className="text-xs text-slate-500">{loc.address}</p>}
              <p className="text-xs text-slate-600">
                Gates: <strong>{(loc.gates || []).join(', ')}</strong>
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddLocation} className="pt-4 border-t border-slate-200 space-y-3">
          <h3 className="text-xs font-semibold uppercase text-slate-600">Add New Location</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Location Name (e.g. West Wing)"
              value={locForm.name}
              onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <input
              type="text"
              required
              placeholder="Code (e.g. WEST)"
              value={locForm.code}
              onChange={(e) => setLocForm({ ...locForm, code: e.target.value.toUpperCase() })}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono-code"
            />
            <input
              type="text"
              placeholder="Street Address"
              value={locForm.address}
              onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <input
              type="text"
              placeholder="Gates (comma separated)"
              value={locForm.gatesText}
              onChange={(e) => setLocForm({ ...locForm, gatesText: e.target.value })}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Location
          </button>
        </form>
      </div>
    </div>
  );
}
