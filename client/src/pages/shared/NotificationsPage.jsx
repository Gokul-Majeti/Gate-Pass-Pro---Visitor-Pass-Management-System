import { Mail, MessageSquare, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, extractErrorMessage } from '../../api/client.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [channel, setChannel] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (channel) params.set('channel', channel);
      if (search) params.set('search', search);
      const { data } = await api.get(`/notifications?${params.toString()}`);
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [channel, search]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Email & SMS Notification Log</h1>
        <p className="text-sm text-slate-500">
          Inspect dispatched and simulated Email/SMS alerts for OTPs, approvals, passes, and check-ins.
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
              placeholder="Search recipient, subject, or message..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="">All Channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No notifications recorded.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {notifications.map((n) => (
              <div key={n._id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      n.channel === 'email'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {n.channel === 'email' ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {n.subject || n.eventType}
                      </span>
                      <StatusBadge status={n.status} />
                      <span className="text-[11px] font-mono-code text-slate-400">
                        {n.eventType}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{n.message}</p>
                    <p className="text-xs text-slate-400">
                      To: {n.recipient} • {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
