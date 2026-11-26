import { Check, User, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, extractErrorMessage, resolveAssetUrl } from '../../api/client.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function HostDashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/appointments');
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleDecision = async (id, status) => {
    const note =
      status === 'rejected' ? window.prompt('Reason for rejection (optional):', '') || '' : 'Approved by host';
    try {
      await api.patch(`/appointments/${id}/status`, { status, approvalNote: note });
      await loadAppointments();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const pendingList = appointments.filter((a) => a.status === 'pending');
  const filtered =
    filter === 'all' ? appointments : appointments.filter((a) => a.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Host Portal — {user?.name}</h1>
          <p className="text-sm text-slate-500">
            Approve pre-registered guests, invite new visitors, and monitor arrivals.
          </p>
        </div>
        <Link
          to="/host/invite"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          Invite Visitor
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {pendingList.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-amber-900 text-sm">
            Pending Approval Queue ({pendingList.length})
          </h2>
          <div className="grid gap-3">
            {pendingList.map((apt) => (
              <div
                key={apt._id}
                className="bg-white rounded-xl border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                    {apt.visitorId?.photoUrl ? (
                      <img
                        src={resolveAssetUrl(apt.visitorId.photoUrl)}
                        alt={apt.visitorId.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">
                      {apt.visitorId?.fullName}{' '}
                      <span className="font-normal text-slate-500">
                        ({apt.visitorId?.company})
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">{apt.purpose}</div>
                    <div className="text-xs text-slate-400">
                      {apt.locationName} • {new Date(apt.scheduledStart).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDecision(apt._id, 'approved')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(apt._id, 'rejected')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900">All My Visitors</h2>
          <div className="flex flex-wrap gap-1.5">
            {['all', 'pending', 'approved', 'checked_in', 'checked_out', 'rejected'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize cursor-pointer ${
                  filter === s
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading appointments...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No visits match this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Visitor</th>
                  <th className="px-5 py-3">Purpose & Location</th>
                  <th className="px-5 py-3">Schedule</th>
                  <th className="px-5 py-3">Pass</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((apt) => (
                  <tr key={apt._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{apt.visitorId?.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {apt.visitorId?.company} • {apt.visitorId?.email}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-slate-800">{apt.purpose}</div>
                      <div className="text-xs text-slate-500">{apt.locationName}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {new Date(apt.scheduledStart).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-mono-code text-xs text-slate-700">
                      {apt.pass?.passCode || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={apt.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
