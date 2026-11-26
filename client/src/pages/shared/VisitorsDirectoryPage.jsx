import { Search, ShieldAlert, ShieldCheck, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, extractErrorMessage, resolveAssetUrl } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function VisitorsDirectoryPage() {
  const { user } = useAuth();
  const canManageWatchlist = ['admin', 'security'].includes(user?.role);

  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState('');
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (watchlistOnly) params.set('isWatchlisted', 'true');
      const { data } = await api.get(`/visitors?${params.toString()}`);
      setVisitors(data.visitors || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, watchlistOnly]);

  useEffect(() => {
    loadVisitors();
  }, [loadVisitors]);

  const toggleWatchlist = async (visitor) => {
    const nextState = !visitor.isWatchlisted;
    const reason = nextState
      ? window.prompt(`Reason for watchlisting ${visitor.fullName}:`, 'Security review') || 'Security flag'
      : '';
    try {
      await api.patch(`/visitors/${visitor._id}`, {
        isWatchlisted: nextState,
        watchlistReason: reason,
      });
      await loadVisitors();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visitor Directory & Watchlist</h1>
        <p className="text-sm text-slate-500">
          Search registered visitors, verify IDs, and manage security watchlist flags.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search visitor name, email, phone, company, or ID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={watchlistOnly}
              onChange={(e) => setWatchlistOnly(e.target.checked)}
              className="rounded border-slate-300 h-4 w-4"
            />
            Watchlisted only
          </label>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading visitors...</div>
        ) : visitors.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No visitors matched.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Visitor</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Company & ID</th>
                  <th className="px-5 py-3">Security Status</th>
                  {canManageWatchlist && <th className="px-5 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visitors.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                          {v.photoUrl ? (
                            <img src={resolveAssetUrl(v.photoUrl)} alt={v.fullName} className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="font-semibold text-slate-900">{v.fullName}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      <div>{v.email}</div>
                      <div className="text-slate-400">{v.phone}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">{v.company}</div>
                      <div className="uppercase text-slate-400">
                        {v.idType?.replace('_', ' ')} {v.idNumber ? `• ${v.idNumber}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {v.isWatchlisted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Watchlisted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Cleared
                        </span>
                      )}
                    </td>
                    {canManageWatchlist && (
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => toggleWatchlist(v)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            v.isWatchlisted
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {v.isWatchlisted ? 'Clear Flag' : 'Flag Watchlist'}
                        </button>
                      </td>
                    )}
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
