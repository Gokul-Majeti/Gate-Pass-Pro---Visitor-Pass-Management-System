import { Camera, RefreshCw, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function WebcamCapture({ value, onChange, label = 'Visitor Photo' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch (err) {
      setCameraError(err?.message || 'Camera access denied or unavailable. Upload a file instead.');
    }
  };

  const captureSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth || 400, video.videoHeight || 400);
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const sx = ((video.videoWidth || 400) - size) / 2;
    const sy = ((video.videoHeight || 400) - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onChange(dataUrl);
    stopCamera();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>

      <div className="flex flex-wrap items-center gap-4">
        <div className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 relative">
          {value ? (
            <>
              <img src={value} alt="Visitor preview" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange('')}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-slate-900/75 text-white flex items-center justify-center hover:bg-slate-900"
                title="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <Camera className="h-7 w-7 text-slate-400" />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5" />
                Capture Webcam
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                Cancel Camera
              </button>
            )}

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              Upload Photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            JPEG, PNG, or WebP (max 5 MB). Used on your printable PDF visitor badge.
          </p>
        </div>
      </div>

      {cameraError && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          {cameraError}
        </p>
      )}

      {cameraActive && (
        <div className="mt-3 p-3 bg-slate-900 rounded-xl inline-flex flex-col items-center gap-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-64 h-64 object-cover rounded-lg bg-black"
          />
          <button
            type="button"
            onClick={captureSnapshot}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Snap Photo
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
