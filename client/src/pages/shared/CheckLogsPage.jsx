import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, extractErrorMessage } from '../../api/client.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function CheckLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (actionFilter) params.set('action', actionFilter);
      const { data } = await api.get(`/checklogs?${params.toString()}`);
      setLogs(data.logs || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Check-In & Check-Out Logs</h1>
        <p className="text-sm text-slate-500">
          Complete timestamped audit of QR scans, manual entries, and denied gate attempts.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search visitor, pass code, or gate..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="">All Actions</option>
            <option value="check_in">Check-In</option>
            <option value="check_out">Check-Out</option>
            <option value="denied">Denied</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading gate logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No check logs recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Visitor</th>
                  <th className="px-5 py-3">Pass Code</th>
                  <th className="px-5 py-3">Location & Gate</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Scanned By</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">
                        {log.visitorId?.fullName || 'Visitor'}
                      </div>
                      <div className="text-xs text-slate-500">{log.visitorId?.company}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono-code text-xs text-slate-800">
                      {log.passId?.passCode || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700">
                      <div>{log.locationName}</div>
                      <div className="text-slate-400">{log.gateName}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs capitalize text-slate-600">
                      {log.method?.replace('_', ' ')}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {log.scannedBy?.name || 'Security'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={log.action} />
                      {log.notes && <div className="text-[11px] text-slate-500 mt-1">{log.notes}</div>}
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
