const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  checked_in: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  check_in: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  checked_out: 'bg-slate-100 text-slate-700 border-slate-200',
  check_out: 'bg-slate-100 text-slate-700 border-slate-200',
  used: 'bg-slate-100 text-slate-700 border-slate-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  revoked: 'bg-rose-50 text-rose-700 border-rose-200',
  denied: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  expired: 'bg-orange-50 text-orange-700 border-orange-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  simulated: 'bg-sky-50 text-sky-700 border-sky-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function StatusBadge({ status }) {
  const key = String(status || 'unknown').toLowerCase();
  const style = STATUS_STYLES[key] || 'bg-slate-100 text-slate-700 border-slate-200';
  const label = key.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${style}`}
    >
      {label}
    </span>
  );
}
