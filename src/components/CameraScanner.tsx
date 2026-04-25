import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, X, ZoomIn } from 'lucide-react';

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
  buttonClassName?: string;
}

export function CameraScanner({ onScan, isScanning, setIsScanning, buttonClassName }: CameraScannerProps) {
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 5, step: 0.1 });
  const [showZoom, setShowZoom] = useState(false);
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; time: number }>({ text: '', time: 0 });
  const onScanRef = useRef(onScan);
  const readerId = useRef(`reader-${Math.random().toString(36).substring(2, 9)}`).current;

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    
    try {
      const videoEl = document.querySelector(`#${readerId} video`) as HTMLVideoElement;
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track && track.applyConstraints) {
          track.applyConstraints({ advanced: [{ zoom: newZoom } as any] }).catch(err => {
            console.error("Native zoom failed", err);
            // Fallback to CSS zoom if native fails
            videoEl.style.transform = `scale(${newZoom})`;
            videoEl.style.transformOrigin = 'center center';
          });
          return;
        }
      }
      
      // Fallback to CSS zoom if no track/applyConstraints
      if (videoEl) {
        videoEl.style.transform = `scale(${newZoom})`;
        videoEl.style.transformOrigin = 'center center';
      }
    } catch (err) {
      console.error("Zoom error", err);
    }
  }, [readerId]);

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

  useEffect(() => {
    let isMounted = true;
    let html5QrCode: Html5Qrcode | null = null;
    let startPromise: Promise<any> | null = null;

    if (isScanning) {
      setError('');
      setShowZoom(false);
      setZoom(2);
      
      html5QrCode = new Html5Qrcode(readerId, {
        verbose: false,
        // Removed formatsToSupport to allow scanning ALL supported barcode types
      });

      scannerInstanceRef.current = html5QrCode;

      startPromise = html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 30, // Increased FPS for faster capture
          qrbox: { width: 280, height: 120 }, // Wider, shorter box is much better for 1D UPC barcodes on bottles
        },
        (decodedText) => {
          const now = Date.now();
          if (lastScanRef.current.text === decodedText && (now - lastScanRef.current.time) < 3000) {
            return;
          }
          lastScanRef.current = { text: decodedText, time: now };
          playBeep();
          onScanRef.current(decodedText);
          setIsScanning(false); // Auto-close on successful scan
        },
        () => {} // ignore parse errors
      ).then(() => {
        setShowZoom(true);
        setTimeout(() => {
          try {
            const videoEl = document.querySelector(`#${readerId} video`) as HTMLVideoElement;
            if (videoEl && videoEl.srcObject) {
              const stream = videoEl.srcObject as MediaStream;
              const track = stream.getVideoTracks()[0];
              
              let targetZoom = 2; // Default to 2x
              let hasNativeZoom = false;

              if (track && track.getCapabilities) {
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
                  
                  // Ensure 2x is within bounds
                  targetZoom = Math.max(min, Math.min(2, max));
                }
              }
              
              setZoom(targetZoom);
              
              if (hasNativeZoom && track && track.applyConstraints) {
                track.applyConstraints({ advanced: [{ zoom: targetZoom } as any] }).catch(err => {
                  console.error("Native zoom failed on init", err);
                  videoEl.style.transform = `scale(${targetZoom})`;
                  videoEl.style.transformOrigin = 'center center';
                });
              } else {
                // Fallback to CSS zoom
                videoEl.style.transform = `scale(${targetZoom})`;
                videoEl.style.transformOrigin = 'center center';
              }
            }
          } catch (e) {
            console.error("Could not get camera capabilities", e);
          }
        }, 500); // Wait a bit for video element to be fully ready
      }).catch((err) => {
        if (isMounted) {
          console.error("Camera start error:", err);
          setError("Camera access denied or unavailable.");
          setIsScanning(false);
        }
      });
    }

    return () => {
      isMounted = false;
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
  }, [isScanning, playBeep, setIsScanning, readerId]);

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
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${isScanning ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsScanning(false)}></div>
        
        {/* Modal */}
        <div role="dialog" aria-modal="true" aria-label="Barcode scanner" className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative z-10 transform transition-transform duration-200 scale-100">
          <div className="p-4 bg-stone-100 border-b border-stone-200 flex justify-between items-center">
            <h3 className="font-bold text-stone-800">Scan Barcode</h3>
            <button onClick={() => setIsScanning(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-stone-600" />
            </button>
          </div>
          <div className="p-4 bg-black flex justify-center">
            <div id={readerId} className="w-full max-w-[300px] min-h-[300px] overflow-hidden rounded-xl bg-black"></div>
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
            Align the barcode horizontally within the box. Good lighting helps with curved bottles!
          </div>
        </div>
      </div>
    </div>
  );
}
