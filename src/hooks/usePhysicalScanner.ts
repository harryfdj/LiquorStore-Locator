import { useEffect, useRef } from 'react';

export function usePhysicalScanner(onScan: (code: string) => void) {
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef<number>(Date.now());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;

      // Physical scanners typically simulate keystrokes very fast (< 75ms interval)
      if (timeDiff > 75) {
        barcodeBuffer.current = '';
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 3) {
          onScan(barcodeBuffer.current);
          barcodeBuffer.current = ''; // Clear buffer immediately
          
          if (!isInput) {
            e.preventDefault();
          }
        }
      } else if (e.key.length === 1) {
        // Collect standard alphanumeric characters
        barcodeBuffer.current += e.key;
      }

      lastKeyTime.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
}
