import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, SwitchCamera, QrCode, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

// Create a reusable beep sound
const playSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a pleasant two-tone beep
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };
    
    const now = audioContext.currentTime;
    playTone(880, now, 0.1); // A5
    playTone(1108.73, now + 0.1, 0.15); // C#6
    
  } catch (error) {
    console.warn("Could not play sound:", error);
  }
};

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
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

  const handleSuccessfulScan = useCallback((code: string) => {
    // Play success sound
    playSuccessSound();
    
    // Show success animation
    setScannedCode(code);
    setShowSuccess(true);
    stopScanner();
    
    // Wait for animation, then close
    setTimeout(() => {
      onScan(code);
      onClose();
      toast({
        title: "Código escaneado!",
        description: code,
      });
      
      // Reset state after closing
      setTimeout(() => {
        setShowSuccess(false);
        setScannedCode(null);
      }, 300);
    }, 800);
  }, [onScan, onClose, stopScanner, toast]);

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
          handleSuccessfulScan(decodedText);
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
  }, [handleSuccessfulScan, toast]);

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
          handleSuccessfulScan(decodedText);
        },
        () => {}
      );

      setIsScanning(true);
    } catch (error) {
      console.error("Error switching camera:", error);
    } finally {
      setIsLoading(false);
    }
  }, [cameras, currentCameraIndex, handleSuccessfulScan, stopScanner]);

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
    setShowSuccess(false);
    setScannedCode(null);
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
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-8 h-8 text-white" />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-white text-sm mt-2"
                >
                  Iniciando câmera...
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scanning Overlay with Viewfinder */}
          <AnimatePresence>
            {isScanning && !isLoading && !showSuccess && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
              >
                {/* Viewfinder */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="relative w-[280px] h-[150px]"
                  >
                    {/* Corner brackets with pulse animation */}
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-primary rounded-tl-lg"
                      style={{ borderWidth: "3px" }}
                    />
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                      className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-primary rounded-tr-lg"
                      style={{ borderWidth: "3px" }}
                    />
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                      className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-primary rounded-bl-lg"
                      style={{ borderWidth: "3px" }}
                    />
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
                      className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-primary rounded-br-lg"
                      style={{ borderWidth: "3px" }}
                    />
                    
                    {/* Animated scan line */}
                    <motion.div
                      animate={{ y: [-60, 60, -60] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute left-2 right-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
                      style={{ boxShadow: "0 0 8px hsl(var(--primary))" }}
                    />
                  </motion.div>
                </div>

                {/* Instructions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="absolute bottom-4 left-0 right-0 text-center"
                >
                  <p className="text-white text-sm bg-black/60 backdrop-blur-sm inline-block px-4 py-2 rounded-full">
                    Aponte para o código de barras ou QR Code
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Overlay */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  >
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                  </motion.div>
                </motion.div>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-white text-lg font-medium mb-2"
                >
                  Código Escaneado!
                </motion.p>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-white/70 text-sm font-mono bg-white/10 px-4 py-2 rounded-lg max-w-[280px] truncate"
                >
                  {scannedCode}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 flex gap-3"
        >
          {cameras.length > 1 && (
            <Button
              variant="outline"
              onClick={switchCamera}
              disabled={isLoading || showSuccess}
              className="flex-1 gap-2"
            >
              <SwitchCamera className="w-4 h-4" />
              Trocar Câmera
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={showSuccess}
            className={cameras.length > 1 ? "flex-1" : "w-full"}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
