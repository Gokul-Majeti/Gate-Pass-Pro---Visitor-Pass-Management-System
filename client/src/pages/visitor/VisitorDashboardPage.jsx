import { CalendarPlus, Download, QrCode, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, extractErrorMessage, getPassPdfUrl } from '../../api/client.js';
import { PassCardModal } from '../../components/PassCardModal.jsx';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function VisitorDashboardPage() {
  const { user, organization } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPass, setSelectedPass] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aptRes, passRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/passes'),
      ]);
      setAppointments(aptRes.data.appointments || []);
      setPasses(passRes.data.passes || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancel = async (appointmentId) => {
    try {
      await api.patch(`/appointments/${appointmentId}/status`, {
        status: 'cancelled',
        approvalNote: 'Cancelled by visitor',
      });
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const passByApt = new Map(passes.map((p) => [String(p.appointmentId?._id || p.appointmentId), p]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name}</h1>
          <p className="text-sm text-slate-500">
            Track your visit requests, view digital QR passes, and download PDF badges.
          </p>
        </div>
        <Link
          to="/visitor/pre-register"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          <CalendarPlus className="h-4 w-4" />
          Pre-Register a Visit
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-medium text-slate-500">Total Visits</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{appointments.length}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-medium text-slate-500">Active Digital Passes</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {passes.filter((p) => ['active', 'checked_in'].includes(p.status)).length}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-medium text-slate-500">Pending Host Approval</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {appointments.filter((a) => a.status === 'pending').length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">My Appointments & Passes</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading your visits...</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No scheduled visits yet. Click <strong>Pre-Register a Visit</strong> to book one.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {appointments.map((apt) => {
              const pass = passByApt.get(String(apt._id));
              return (
                <div
                  key={apt._id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{apt.purpose}</span>
                      <StatusBadge status={apt.status} />
                    </div>
                    <div className="text-xs text-slate-500">
                      Host: <strong className="text-slate-700">{apt.hostId?.name}</strong> •{' '}
                      {apt.locationName} •{' '}
                      {new Date(apt.scheduledStart).toLocaleString()} –{' '}
                      {new Date(apt.scheduledEnd).toLocaleTimeString()}
                    </div>
                    {apt.approvalNote && (
                      <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1 inline-block">
                        Note: {apt.approvalNote}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {pass ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedPass(pass)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                          View QR ({pass.passCode})
                        </button>
                        <a
                          href={getPassPdfUrl(pass._id, true)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF Badge
                        </a>
                      </>
                    ) : (
                      apt.status === 'approved' && (
                        <span className="text-xs text-slate-500 italic">
                          Approved — Security will issue pass at check-in
                        </span>
                      )
                    )}

                    {['pending', 'approved'].includes(apt.status) && (
                      <button
                        type="button"
                        onClick={() => handleCancel(apt._id)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PassCardModal
        pass={selectedPass}
        organization={organization}
        onClose={() => setSelectedPass(null)}
      />
    </div>
  );
}
