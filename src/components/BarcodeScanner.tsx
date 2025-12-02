import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X } from 'lucide-react';
import { Button } from './ui/button';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scannerId = 'barcode-scanner';

    const startScanner = async () => {
      try {
        scannerRef.current = new Html5Qrcode(scannerId);

        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
          },
          () => {
            // Ignore scan errors
          }
        );
      } catch (err) {
        setError('Kamera erişimi sağlanamadı. Lütfen kamera izni verin.');
        console.error('Scanner error:', err);
      }
    };

    const stopScanner = async () => {
      if (scannerRef.current?.isScanning) {
        try {
          await scannerRef.current.stop();
        } catch (err) {
          console.error('Stop scanner error:', err);
        }
      }
      onClose();
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Barkod Okuyucu
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={onClose}>Kapat</Button>
            </div>
          ) : (
            <>
              <div
                id="barcode-scanner"
                ref={containerRef}
                className="w-full aspect-video bg-black rounded-lg overflow-hidden"
              />
              <p className="text-center text-sm text-muted-foreground mt-4">
                Barkodu kamera görüş alanına getirin
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface BarcodeScanButtonProps {
  onScan: (barcode: string) => void;
}

export function BarcodeScanButton({ onScan }: BarcodeScanButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        title="Barkod Tara"
        className="shrink-0"
      >
        <Camera className="h-4 w-4" />
      </Button>

      {isOpen && (
        <BarcodeScanner
          onScan={(barcode) => {
            onScan(barcode);
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
