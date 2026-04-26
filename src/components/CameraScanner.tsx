import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, X, ZoomIn } from 'lucide-react';

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
  buttonClassName?: string;
}

type ScannerEngine = 'native' | 'fallback' | null;

type NativeBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

const NATIVE_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'code_93',
  'itf',
] as const;

const HTML5_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
];

function getNativeBarcodeDetector() {
  return (window as any).BarcodeDetector as
    | (new (options?: { formats?: readonly string[] }) => NativeBarcodeDetector)
    | undefined;
}

function normalizeScannedBarcode(decodedText: string) {
  const value = decodedText.trim();

  // Some camera APIs report UPC-A as EAN-13 by prepending a leading zero.
  // Keep GTIN-14 and other longer codes unchanged.
  if (/^0\d{12}$/.test(value)) {
    return value.slice(1);
  }

  return value;
}

export function CameraScanner({ onScan, isScanning, setIsScanning, buttonClassName }: CameraScannerProps) {
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 5, step: 0.1 });
  const [showZoom, setShowZoom] = useState(false);
  const [scannerEngine, setScannerEngine] = useState<ScannerEngine>(null);
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeStreamRef = useRef<MediaStream | null>(null);
  const nativeFrameRef = useRef<number | null>(null);
  const lastNativeDetectRef = useRef(0);
  const lastScanRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });
  const onScanRef = useRef(onScan);
  const readerId = useRef(`reader-${Math.random().toString(36).substring(2, 9)}`).current;

  const applyZoomToVideo = useCallback((videoEl: HTMLVideoElement | null, newZoom: number) => {
    if (!videoEl || !videoEl.srcObject) return;

    const stream = videoEl.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];

    if (track?.applyConstraints) {
      track.applyConstraints({ advanced: [{ zoom: newZoom } as any] }).catch(() => {
        videoEl.style.transform = `scale(${newZoom})`;
        videoEl.style.transformOrigin = 'center center';
      });
      return;
    }

    videoEl.style.transform = `scale(${newZoom})`;
    videoEl.style.transformOrigin = 'center center';
  }, []);

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);

    try {
      const videoEl = videoRef.current || document.querySelector(`#${readerId} video`) as HTMLVideoElement;
      applyZoomToVideo(videoEl, newZoom);
    } catch (err) {
      console.error("Zoom error", err);
    }
  }, [applyZoomToVideo, readerId]);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const playBeep = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1); // 100ms beep
    } catch (e) {
      console.error("Audio beep failed", e);
    }
  }, []);

  const handleDecodedText = useCallback((decodedText: string) => {
    const normalizedText = normalizeScannedBarcode(decodedText);
    const now = Date.now();
    if (lastScanRef.current.text === normalizedText && (now - lastScanRef.current.time) < 3000) {
      return;
    }
    lastScanRef.current = { text: normalizedText, time: now };
    playBeep();
    onScanRef.current(normalizedText);
    setIsScanning(false);
  }, [playBeep, setIsScanning]);

  const configureCameraTrack = useCallback((videoEl: HTMLVideoElement | null) => {
    if (!videoEl?.srcObject) return;
    const stream = videoEl.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    let targetZoom = 1;
    let hasNativeZoom = false;

    try {
      if (track.getCapabilities) {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.zoom) {
          hasNativeZoom = true;
          const min = capabilities.zoom.min || 1;
          const max = capabilities.zoom.max || 5;
          setZoomRange({
            min,
            max,
            step: capabilities.zoom.step || 0.1
          });

          // 1D barcodes scan faster when the camera is a little zoomed, but too much zoom hurts laptops.
          targetZoom = Math.max(min, Math.min(1.6, max));
        }
      }

      if (track.applyConstraints) {
        track.applyConstraints({
          advanced: [
            { focusMode: 'continuous' } as any,
            { exposureMode: 'continuous' } as any,
            { whiteBalanceMode: 'continuous' } as any,
          ],
        }).catch(() => {});
      }
    } catch (e) {
      console.error("Could not read camera capabilities", e);
    }

    setZoom(targetZoom);
    applyZoomToVideo(videoEl, targetZoom);
    setShowZoom(hasNativeZoom || Boolean(videoEl));
  }, [applyZoomToVideo]);

  const stopNativeScanner = useCallback(() => {
    if (nativeFrameRef.current !== null) {
      window.cancelAnimationFrame(nativeFrameRef.current);
      nativeFrameRef.current = null;
    }

    nativeStreamRef.current?.getTracks().forEach(track => track.stop());
    nativeStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startNativeScanner = useCallback(async () => {
    const BarcodeDetector = getNativeBarcodeDetector();
    const videoEl = videoRef.current;

    if (!BarcodeDetector || !navigator.mediaDevices?.getUserMedia || !videoEl) {
      return false;
    }

    const detector = new BarcodeDetector({ formats: NATIVE_BARCODE_FORMATS });
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    nativeStreamRef.current = stream;
    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', 'true');
    await videoEl.play();

    setScannerEngine('native');
    configureCameraTrack(videoEl);

    const detectLoop = async (timestamp: number) => {
      if (!nativeStreamRef.current || !videoRef.current) return;

      // Native detection is fast, but throttling avoids burning battery and keeps the UI smooth.
      if (timestamp - lastNativeDetectRef.current >= 80) {
        lastNativeDetectRef.current = timestamp;
        try {
          const barcodes = await detector.detect(videoRef.current);
          const decodedText = barcodes.find(barcode => barcode.rawValue)?.rawValue;
          if (decodedText) {
            handleDecodedText(decodedText);
            return;
          }
        } catch {
          // Detection errors are expected while frames are blurry or still loading.
        }
      }

      nativeFrameRef.current = window.requestAnimationFrame(detectLoop);
    };

    nativeFrameRef.current = window.requestAnimationFrame(detectLoop);
    return true;
  }, [configureCameraTrack, handleDecodedText]);

  useEffect(() => {
    let isMounted = true;
    let html5QrCode: Html5Qrcode | null = null;
    let startPromise: Promise<any> | null = null;

    if (isScanning) {
      setError('');
      setShowZoom(false);
      setScannerEngine(null);
      setZoom(1);

      const startFallbackScanner = () => {
        if (!isMounted) return;

        setScannerEngine('fallback');
        html5QrCode = new Html5Qrcode(readerId, {
          verbose: false,
          formatsToSupport: HTML5_BARCODE_FORMATS,
        });

        scannerInstanceRef.current = html5QrCode;

        startPromise = html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 24,
            qrbox: { width: 320, height: 140 },
            aspectRatio: 1.777778,
          },
          handleDecodedText,
          () => {}
        ).then(() => {
          setTimeout(() => {
            const videoEl = document.querySelector(`#${readerId} video`) as HTMLVideoElement;
            configureCameraTrack(videoEl);
          }, 300);
        }).catch((err) => {
          if (isMounted) {
            console.error("Camera start error:", err);
            setError("Camera access denied or unavailable.");
            setIsScanning(false);
          }
        });
      };

      startNativeScanner()
        .then(started => {
          if (!started) startFallbackScanner();
        })
        .catch(err => {
          console.warn("Native barcode scanner unavailable, using fallback scanner.", err);
          stopNativeScanner();
          startFallbackScanner();
        });
    }

    return () => {
      isMounted = false;
      stopNativeScanner();
      if (html5QrCode && startPromise) {
        // Wait for start to finish before stopping to prevent transition errors
        startPromise.then(() => {
          if (html5QrCode && html5QrCode.getState() === 2) { // 2 = SCANNING
            html5QrCode.stop().then(() => {
              html5QrCode?.clear();
            }).catch((err) => {
              console.error("Failed to stop scanner", err);
            });
          }
        }).catch(() => {
          // Ignore start errors here, already handled
        });
      }
    };
  }, [configureCameraTrack, handleDecodedText, isScanning, readerId, setIsScanning, startNativeScanner, stopNativeScanner]);

  return (
    <div className="flex items-center gap-2 relative">
      <button
        type="button"
        onClick={() => setIsScanning(!isScanning)}
        className={buttonClassName || `p-3 rounded-xl flex items-center justify-center transition-colors ${
          isScanning 
            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
            : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
        }`}
        title={isScanning ? "Stop Camera Scanner" : "Start Camera Scanner"}
      >
        {isScanning ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
      </button>
      
      {error && (
        <span className="absolute top-full mt-2 left-0 text-xs text-red-500 flex items-center gap-1 bg-red-50 p-1 rounded whitespace-nowrap z-10">
          <AlertCircle className="w-3 h-3" /> {error}
        </span>
      )}
      
      {/* Camera Box Overlay */}
      <div className={`fixed inset-0 z-[70] grid h-[100dvh] place-items-center overflow-y-auto p-4 transition-opacity duration-200 ${isScanning ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsScanning(false)}></div>
        
        {/* Modal */}
        <div role="dialog" aria-modal="true" aria-label="Barcode scanner" className="relative z-10 my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-sm transform flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-transform duration-200 scale-100">
          <div className="p-4 bg-stone-100 border-b border-stone-200 flex justify-between items-center">
            <h3 className="font-bold text-stone-800">Scan Barcode</h3>
            <button onClick={() => setIsScanning(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-stone-600" />
            </button>
          </div>
          <div className="flex justify-center overflow-hidden bg-black p-4">
            <div className="relative aspect-[4/3] w-full max-w-[340px] overflow-hidden rounded-xl bg-black">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`absolute inset-0 h-full w-full object-cover ${scannerEngine === 'native' ? 'block' : 'hidden'}`}
              />
              <div
                id={readerId}
                className={`min-h-[255px] w-full ${scannerEngine === 'fallback' ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              />
              <div className="pointer-events-none absolute inset-x-6 top-1/2 h-28 -translate-y-1/2 rounded-2xl border-2 border-lime-300/90 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
            </div>
          </div>
          
          {showZoom && (
            <div className="px-6 py-3 bg-stone-50 border-b border-stone-200 flex items-center gap-3">
              <ZoomIn className="w-5 h-5 text-stone-500" />
              <input 
                type="range" 
                min={zoomRange.min} 
                max={zoomRange.max} 
                step={zoomRange.step} 
                value={zoom} 
                onChange={handleZoomChange}
                className="flex-1 h-2 bg-stone-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs font-bold text-stone-600 w-8 text-right">{zoom.toFixed(1)}x</span>
            </div>
          )}

          <div className="p-4 text-center text-sm text-stone-500 bg-stone-50">
            Align the UPC horizontally inside the green box. Native scanning is used first when your device supports it.
          </div>
        </div>
      </div>
    </div>
  );
}
