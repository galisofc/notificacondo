import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, SwitchCamera, QrCode, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
      } catch (error) {
        console.warn("Error stopping scanner:", error);
      }
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current || scannerRef.current?.getState() === 2) return;

    setIsLoading(true);

    try {
      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      
      if (devices.length === 0) {
        toast({
          title: "Nenhuma câmera encontrada",
          description: "Verifique se a câmera está disponível",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setCameras(devices);

      // Prefer back camera
      let cameraIndex = 0;
      const backCameraIndex = devices.findIndex(
        (d) =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("traseira") ||
          d.label.toLowerCase().includes("rear")
      );
      if (backCameraIndex !== -1) {
        cameraIndex = backCameraIndex;
      }
      setCurrentCameraIndex(cameraIndex);

      // Initialize scanner
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("barcode-scanner-container");
      }

      await scannerRef.current.start(
        devices[cameraIndex].id,
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Code detected - stop scanning and return result
          stopScanner();
          onScan(decodedText);
          onClose();
          toast({
            title: "Código escaneado!",
            description: decodedText,
          });
        },
        () => {
          // Scan error - ignore, it just means no code found yet
        }
      );

      setIsScanning(true);
    } catch (error) {
      console.error("Error starting scanner:", error);
      toast({
        title: "Erro ao iniciar câmera",
        description: "Verifique as permissões da câmera",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [onScan, onClose, stopScanner, toast]);

  const switchCamera = useCallback(async () => {
    if (cameras.length <= 1) return;

    await stopScanner();

    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);

    setIsLoading(true);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("barcode-scanner-container");
      }

      await scannerRef.current.start(
        cameras[nextIndex].id,
        {
          fps: 10,
          qrbox: { width: 280, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          stopScanner();
          onScan(decodedText);
          onClose();
          toast({
            title: "Código escaneado!",
            description: decodedText,
          });
        },
        () => {}
      );

      setIsScanning(true);
    } catch (error) {
      console.error("Error switching camera:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cameras, currentCameraIndex, onScan, onClose, stopScanner, toast]);

  // Start scanner when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the container is mounted
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner();
      if (scannerRef.current) {
        scannerRef.current = null;
      }
    };
  }, [stopScanner]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Escanear Código
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          {/* Scanner Container */}
          <div 
            ref={containerRef}
            id="barcode-scanner-container" 
            className="w-full aspect-[4/3] bg-black"
          />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
              <p className="text-white text-sm">Iniciando câmera...</p>
            </div>
          )}

          {/* Scanning Overlay with Viewfinder */}
          {isScanning && !isLoading && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Dark overlay around viewfinder */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-[280px] h-[150px]">
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary" />
                  
                  {/* Scan line animation */}
                  <div className="absolute left-1 right-1 top-1/2 h-0.5 bg-primary/50 animate-pulse" />
                </div>
              </div>

              {/* Instructions */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white text-sm bg-black/50 inline-block px-3 py-1 rounded">
                  Aponte para o código de barras ou QR Code
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 flex gap-3">
          {cameras.length > 1 && (
            <Button
              variant="outline"
              onClick={switchCamera}
              disabled={isLoading}
              className="flex-1 gap-2"
            >
              <SwitchCamera className="w-4 h-4" />
              Trocar Câmera
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={handleClose}
            className={cameras.length > 1 ? "flex-1" : "w-full"}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
