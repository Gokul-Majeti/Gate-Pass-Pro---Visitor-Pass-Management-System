import { Activity, Clock, QrCode, ShieldAlert, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const PIE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#64748b'];

export function AdminDashboardPage() {
  const { organization } = useAuth();
  const [locationFilter, setLocationFilter] = useState('');
  const [days, setDays] = useState(14);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: String(days) });
    if (locationFilter) params.set('locationName', locationFilter);

    api
      .get(`/reports/analytics?${params.toString()}`)
      .then(({ data }) => setAnalytics(data))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [locationFilter, days]);

  const kpis = analytics?.kpis || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Executive Analytics Dashboard</h1>
          <p className="text-sm text-slate-500">
            Live occupancy, visitor volume trends, peak entry hours, and campus metrics for{' '}
            <strong>{organization?.name}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white"
          >
            <option value="">All Locations</option>
            {(organization?.locations || []).map((loc) => (
              <option key={loc.name} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>

          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white"
          >
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>On-Site Now</span>
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-2">
            {loading ? '—' : kpis.currentlyOnSite ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Today Check-Ins</span>
            <Activity className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {loading ? '—' : kpis.todayCheckIns ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pending Approvals</span>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            {loading ? '—' : kpis.pendingApprovals ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Passes</span>
            <QrCode className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-2">
            {loading ? '—' : kpis.activePasses ?? 0}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Avg Stay Duration</span>
            <Clock className="h-4 w-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '—' : `${kpis.avgVisitDurationMinutes ?? 0}m`}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">
            Daily Appointments & Check-Ins ({days} Days)
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.dailyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="appointments"
                  name="Appointments"
                  stroke="#2563eb"
                  fill="#dbeafe"
                />
                <Area
                  type="monotone"
                  dataKey="checkIns"
                  name="Check-Ins"
                  stroke="#10b981"
                  fill="#d1fae5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Visits by Status</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.byStatus || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {(analytics?.byStatus || []).map((entry, idx) => (
                    <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  formatter={(value) => String(value).replace(/_/g, ' ')}
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Peak Check-In Hours</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.peakHours || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="checkIns" name="Check-Ins" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Visits by Campus Location</h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.byLocation || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="Visits" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
