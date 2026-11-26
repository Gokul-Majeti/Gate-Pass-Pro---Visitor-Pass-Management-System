import { BadgePlus, Download, QrCode, Search, ShieldOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, extractErrorMessage, getPassPdfUrl } from '../../api/client.js';
import { PassCardModal } from '../../components/PassCardModal.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function PassesPage() {
  const { user, organization } = useAuth();
  const canIssue = ['admin', 'security'].includes(user?.role);

  const [passes, setPasses] = useState([]);
  const [approvedQueue, setApprovedQueue] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPass, setSelectedPass] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const requests = [api.get(`/passes?${params.toString()}`)];
      if (canIssue) {
        requests.push(api.get('/appointments?status=approved&limit=50'));
      }

      const [passRes, aptRes] = await Promise.all(requests);
      setPasses(passRes.data.passes || []);
      if (aptRes) {
        const withoutActivePass = (aptRes.data.appointments || []).filter(
          (a) => !a.pass || !['active', 'checked_in'].includes(a.pass.status)
        );
        setApprovedQueue(withoutActivePass);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [canIssue, search, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleIssuePass = async (appointmentId) => {
    setError('');
    try {
      const { data } = await api.post('/passes/issue', { appointmentId });
      setSelectedPass(data.pass);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to issue pass'));
    }
  };

  const handleRevoke = async (pass) => {
    const reason = window.prompt(`Reason for revoking ${pass.passCode}:`, 'Security revocation');
    if (!reason) return;
    try {
      await api.patch(`/passes/${pass._id}/revoke`, { reason });
      setSelectedPass(null);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err, 'Revoke failed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Digital Passes & Badges</h1>
          <p className="text-sm text-slate-500">
            View QR passes, download printable PDF badges, and issue badges for approved visits.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {canIssue && approvedQueue.length > 0 && (
        <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-blue-900">
            Approved Appointments Ready for Pass Issuance ({approvedQueue.length})
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {approvedQueue.map((apt) => (
              <div
                key={apt._id}
                className="bg-white rounded-xl border border-blue-200 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-900 truncate">
                    {apt.visitorId?.fullName}
                  </div>
                  <div className="text-xs text-slate-700 truncate">{apt.purpose}</div>
                  <div className="text-xs text-slate-500 truncate">
                    Host: {apt.hostId?.name} • {apt.locationName}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(apt.scheduledStart).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleIssuePass(apt._id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shrink-0 cursor-pointer"
                >
                  <BadgePlus className="h-3.5 w-3.5" />
                  Issue Pass
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by pass code, visitor name, or company..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="checked_in">Checked In</option>
            <option value="used">Used (Checked Out)</option>
            <option value="revoked">Revoked</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading passes...</div>
        ) : passes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No passes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Pass Code</th>
                  <th className="px-5 py-3">Visitor</th>
                  <th className="px-5 py-3">Host & Location</th>
                  <th className="px-5 py-3">Valid Window</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {passes.map((pass) => (
                  <tr key={pass._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-mono-code font-semibold text-slate-900">
                      {pass.passCode}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{pass.visitorId?.fullName}</div>
                      <div className="text-xs text-slate-500">{pass.visitorId?.company}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-slate-800">{pass.hostId?.name}</div>
                      <div className="text-xs text-slate-500">{pass.locationName}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {new Date(pass.validFrom).toLocaleDateString()}{' '}
                      {new Date(pass.validFrom).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      –{' '}
                      {new Date(pass.validUntil).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={pass.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPass(pass)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          QR
                        </button>
                        <a
                          href={getPassPdfUrl(pass._id, true)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </a>
                        {canIssue && ['active', 'checked_in'].includes(pass.status) && (
                          <button
                            type="button"
                            onClick={() => handleRevoke(pass)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Revoke Pass"
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PassCardModal
        pass={selectedPass}
        organization={organization}
        onClose={() => setSelectedPass(null)}
        onRevoke={canIssue ? handleRevoke : null}
      />
    </div>
  );
}
