import { Download, ExternalLink, MapPin, QrCode, ShieldAlert, User, X } from 'lucide-react';
import { getPassPdfUrl } from '../api/client.js';
import { StatusBadge } from './StatusBadge.jsx';

export function PassCardModal({ pass, organization, onClose, onRevoke }) {
  if (!pass) return null;

  const visitor = pass.visitorId || {};
  const host = pass.hostId || {};
  const appointment = pass.appointmentId || {};
  const primaryColor = organization?.settings?.primaryColor || '#2563eb';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div
          className="px-6 py-4 text-white flex items-center justify-between"
          style={{ backgroundColor: primaryColor }}
        >
          <div>
            <h3 className="font-bold text-lg leading-tight">
              {organization?.name || 'Digital Visitor Pass'}
            </h3>
            <p className="text-xs text-white/85 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5" />
              {pass.locationName || 'Main Campus'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              {visitor.photoUrl ? (
                <img
                  src={visitor.photoUrl}
                  alt={visitor.fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-slate-900 truncate">{visitor.fullName}</h4>
                <StatusBadge status={pass.status} />
              </div>
              <p className="text-sm text-slate-600 truncate">{visitor.company || 'Independent'}</p>
              <p className="text-xs text-slate-500 truncate">
                Host: {host.name || 'Reception'} {host.department ? `(${host.department})` : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 rounded-xl p-3.5 border border-slate-200">
            <div>
              <div className="text-slate-500">Valid From</div>
              <div className="font-semibold text-slate-800 mt-0.5">
                {new Date(pass.validFrom).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Valid Until</div>
              <div className="font-semibold text-slate-800 mt-0.5">
                {new Date(pass.validUntil).toLocaleString()}
              </div>
            </div>
            {appointment.purpose && (
              <div className="col-span-2 pt-1 border-t border-slate-200">
                <div className="text-slate-500">Purpose</div>
                <div className="font-medium text-slate-800 mt-0.5">{appointment.purpose}</div>
              </div>
            )}
          </div>

          {appointment.requireOtp && (
            <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Gate OTP verification is required during security check-in.</span>
            </div>
          )}

          <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-5">
            {pass.qrDataUrl ? (
              <img
                src={pass.qrDataUrl}
                alt={`QR Code for ${pass.passCode}`}
                className="w-44 h-44 rounded-lg bg-white p-2 border border-slate-200"
              />
            ) : (
              <div className="w-44 h-44 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                <QrCode className="h-16 w-16 text-slate-300" />
              </div>
            )}
            <div className="mt-3 font-mono-code text-base font-bold tracking-wider text-slate-900">
              {pass.passCode}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Scan this QR code at the security reception desk
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={getPassPdfUrl(pass._id, true)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Download PDF Badge
            </a>
            <a
              href={getPassPdfUrl(pass._id, false)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
              title="Preview PDF in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            {onRevoke && ['active', 'checked_in'].includes(pass.status) && (
              <button
                type="button"
                onClick={() => onRevoke(pass)}
                className="px-3.5 py-2.5 rounded-xl text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
              >
                Revoke
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
