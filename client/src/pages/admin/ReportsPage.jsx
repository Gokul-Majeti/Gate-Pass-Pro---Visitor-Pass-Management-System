import { Download, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, extractErrorMessage, getStoredToken } from '../../api/client.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function ReportsPage() {
  const { organization } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [locationName, setLocationName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (locationName) params.set('locationName', locationName);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [search, status, locationName, from, to]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString();
      const { data } = await api.get(`/appointments?limit=100&${qs}`);
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExportCsv = () => {
    const qs = buildQueryString();
    const token = encodeURIComponent(getStoredToken());
    window.open(`/api/reports/export?token=${token}&${qs}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visitor Reports & Export</h1>
          <p className="text-sm text-slate-500">
            Search, filter by date range, location, or status, and export records to CSV.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 cursor-pointer"
        >
          <Download className="h-4 w-4" />
          Export CSV Report
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 grid sm:grid-cols-2 lg:grid-cols-12 gap-3">
        <div className="relative lg:col-span-4">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visitor, company, email, purpose..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="lg:col-span-2 px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="checked_in">Checked In</option>
          <option value="checked_out">Checked Out</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          className="lg:col-span-2 px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
        >
          <option value="">All Locations</option>
          {(organization?.locations || []).map((loc) => (
            <option key={loc.name} value={loc.name}>
              {loc.name}
            </option>
          ))}
        </select>
        <div className="lg:col-span-4 grid grid-cols-2 gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
            title="From date"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full min-w-0 px-2.5 py-2 rounded-xl border border-slate-300 text-xs"
            title="To date"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Generating report...</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No records match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Visitor</th>
                  <th className="px-5 py-3">Host</th>
                  <th className="px-5 py-3">Location & Purpose</th>
                  <th className="px-5 py-3">Scheduled Window</th>
                  <th className="px-5 py-3">Pass</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {appointments.map((apt) => (
                  <tr key={apt._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{apt.visitorId?.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {apt.visitorId?.company} • {apt.visitorId?.email}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">
                      <div className="font-medium">{apt.hostId?.name}</div>
                      <div className="text-slate-400">{apt.hostId?.department}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <div className="text-slate-800">{apt.purpose}</div>
                      <div className="text-slate-400">
                        {apt.locationName} • {apt.type?.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(apt.scheduledStart).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-mono-code text-xs text-slate-800">
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
