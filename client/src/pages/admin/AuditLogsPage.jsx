import { Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, extractErrorMessage } from '../../api/client.js';

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const { data } = await api.get(`/audit-logs?limit=50&${params.toString()}`);
      setLogs(data.logs || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Audit Trail</h1>
        <p className="text-sm text-slate-500">
          Immutable log of logins, OTP verifications, staff changes, approvals, passes, and gate scans.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, actor name, or entity..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No audit entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{log.actorName}</div>
                      <div className="text-xs text-slate-400 capitalize">{log.actorRole}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono-code text-xs font-semibold text-blue-700">
                      {log.action}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{log.entityType}</td>
                    <td className="px-5 py-3.5 text-xs font-mono-code text-slate-500 max-w-xs truncate">
                      {JSON.stringify(log.metadata || {})}
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
