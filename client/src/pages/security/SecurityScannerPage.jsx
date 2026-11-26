import { Html5Qrcode } from 'html5-qrcode';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  KeyRound,
  LogIn,
  LogOut,
  QrCode,
  Search,
  ShieldAlert,
  Upload,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, extractErrorMessage, resolveAssetUrl } from '../../api/client.js';
import { StatusBadge } from '../../components/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function SecurityScannerPage() {
  const { organization, user } = useAuth();
  const scannerRef = useRef(null);
  const scannerRegionId = 'qr-reader-region';

  const [cameraOn, setCameraOn] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [gateName, setGateName] = useState(
    organization?.locations?.[0]?.gates?.[0] || 'Main Reception'
  );
  const [otpCode, setOtpCode] = useState('');
  const [notes, setNotes] = useState('');

  const [verification, setVerification] = useState(null);
  const [activePasses, setActivePasses] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');

  const allGates = (organization?.locations || []).flatMap((loc) =>
    (loc.gates || ['Main Reception']).map((g) => `${loc.name} — ${g}`)
  );

  const loadBoard = useCallback(async () => {
    try {
      const [onSiteRes, logsRes] = await Promise.all([
        api.get('/passes?status=checked_in&limit=20'),
        api.get('/checklogs?limit=8'),
      ]);
      setActivePasses(onSiteRes.data.passes || []);
      setRecentLogs(logsRes.data.logs || []);
    } catch {
      // ignore transient refresh failure
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignore cleanup error
      }
      scannerRef.current = null;
    }
    setCameraOn(false);
  }, []);

  useEffect(() => () => {
    stopCamera();
  }, [stopCamera]);

  const verifyCode = async (rawValue) => {
    const trimmed = String(rawValue || scanInput).trim();
    if (!trimmed) return;
    setError('');
    setBanner('');
    setBusy(true);
    try {
      const isSigned = trimmed.startsWith('VPM1:') || trimmed.startsWith('{');
      const { data } = await api.post('/checklogs/verify', {
        ...(isSigned ? { qrToken: trimmed } : { passCode: trimmed }),
      });
      setVerification(data);
    } catch (err) {
      setVerification(null);
      setError(extractErrorMessage(err, 'Pass lookup failed'));
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    setError('');
    try {
      await stopCamera();
      const html5QrCode = new Html5Qrcode(scannerRegionId);
      scannerRef.current = html5QrCode;
      setCameraOn(true);
      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        async (decodedText) => {
          setScanInput(decodedText);
          await stopCamera();
          await verifyCode(decodedText);
        },
        () => {}
      );
    } catch (err) {
      setCameraOn(false);
      setError(err?.message || 'Unable to start camera. Use manual pass code or QR image upload.');
    }
  };

  const handleQrImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const tempScanner = new Html5Qrcode('qr-file-temp');
      const decodedText = await tempScanner.scanFile(file, false);
      tempScanner.clear();
      setScanInput(decodedText);
      await verifyCode(decodedText);
    } catch {
      setError('Could not detect a valid QR code in that image.');
    } finally {
      e.target.value = '';
    }
  };

  const executeScanAction = async (overrideAction = 'auto', overrideCode = '') => {
    const raw = overrideCode || scanInput || verification?.pass?.qrToken || verification?.pass?.passCode;
    if (!raw) return;
    setError('');
    setBanner('');
    setBusy(true);
    try {
      const isSigned = String(raw).startsWith('VPM1:') || String(raw).startsWith('{');
      const { data } = await api.post('/checklogs/scan', {
        ...(isSigned ? { qrToken: raw } : { passCode: raw }),
        action: overrideAction,
        gateName,
        otpCode: otpCode || undefined,
        notes,
      });

      setBanner(
        `${data.action === 'check_in' ? 'Checked In' : 'Checked Out'} successfully: ${
          data.pass?.visitorId?.fullName || data.pass?.passCode
        }`
      );
      setVerification(null);
      setScanInput('');
      setOtpCode('');
      setNotes('');
      await loadBoard();
    } catch (err) {
      setError(extractErrorMessage(err, 'Check-in / Check-out failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Security Gate & QR Scanner</h1>
          <p className="text-sm text-slate-500">
            Scan digital QR passes, verify gate OTPs, and manage active on-site visitors at{' '}
            <strong>{user?.locationName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Checkpoint:</label>
          <select
            value={gateName}
            onChange={(e) => setGateName(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium bg-white"
          >
            {(allGates.length ? allGates : ['Main Reception']).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {banner && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-blue-600" />
                QR Scanner & Pass Verification
              </h2>
              <div className="flex flex-wrap gap-2">
                {!cameraOn ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Start Camera Scan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                  >
                    Stop Camera
                  </button>
                )}

                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  Scan QR Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div
              id={scannerRegionId}
              className={`rounded-xl overflow-hidden bg-slate-950 ${cameraOn ? 'min-h-[260px]' : 'hidden'}`}
            />
            <div id="qr-file-temp" className="hidden" />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyCode();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Enter Pass Code (e.g. VP-2026-100001) or paste QR payload..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono-code"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !scanInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Checking...' : 'Verify Pass'}
              </button>
            </form>

            {verification && (
              <div
                className={`rounded-2xl border p-5 space-y-4 ${
                  verification.valid
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-rose-50/50 border-rose-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {verification.pass?.visitorId?.photoUrl ? (
                        <img
                          src={resolveAssetUrl(verification.pass.visitorId.photoUrl)}
                          alt={verification.pass.visitorId.fullName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-7 w-7 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        {verification.pass?.visitorId?.fullName}
                      </div>
                      <div className="text-xs text-slate-600">
                        {verification.pass?.visitorId?.company} • Host:{' '}
                        {verification.pass?.hostId?.name}
                      </div>
                      <div className="text-xs font-mono-code text-slate-500 mt-0.5">
                        {verification.pass?.passCode}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={verification.pass?.status} />
                </div>

                {!verification.valid ? (
                  <div className="text-sm font-medium text-rose-700 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{verification.reason}</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {verification.requireGateOtp && verification.recommendedAction === 'check_in' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                        <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5" />
                          Gate OTP Required for Check-In
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter visitor's 6-digit OTP"
                          className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white font-mono-code text-sm"
                        />
                      </div>
                    )}

                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional gate notes (e.g. Lanyard #14 issued)"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                    />

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => executeScanAction(verification.recommendedAction)}
                      className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white inline-flex items-center justify-center gap-2 cursor-pointer ${
                        verification.recommendedAction === 'check_in'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {verification.recommendedAction === 'check_in' ? (
                        <>
                          <LogIn className="h-4 w-4" />
                          Confirm Visitor Check-In
                        </>
                      ) : (
                        <>
                          <LogOut className="h-4 w-4" />
                          Confirm Visitor Check-Out
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-sm">
                Currently On-Site ({activePasses.length})
              </h2>
            </div>
            {activePasses.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No visitors currently checked in.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {activePasses.map((p) => (
                  <div key={p._id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 truncate">
                        {p.visitorId?.fullName}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        Host: {p.hostId?.name} •{' '}
                        <span className="font-mono-code">{p.passCode}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => executeScanAction('check_out', p.passCode)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 shrink-0 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Check Out
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900 text-sm">Recent Gate Activity</h2>
            </div>
            {recentLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No recent scans yet.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {recentLogs.map((log) => (
                  <div key={log._id} className="p-3.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {log.visitorId?.fullName || 'Visitor'}
                      </div>
                      <div className="text-slate-500 truncate">
                        {log.gateName} • {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <StatusBadge status={log.action} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
