import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, X, RotateCcw, ImageIcon, Loader2, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  capturedImage: string | null;
  onClear: () => void;
  className?: string;
}

export function CameraCapture({ onCapture, capturedImage, onClear, className }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [isMounted, setIsMounted] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsPermissionDenied(false);
      setIsLoading(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsStreaming(true);
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      
      // Check if permission was denied
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setIsPermissionDenied(true);
        setError("Acesso à câmera foi negado.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setError("Nenhuma câmera encontrada neste dispositivo.");
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        setError("A câmera está sendo usada por outro aplicativo.");
      } else {
        setError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/jpeg", 0.8);
        onCapture(imageData);
        stopCamera();
      }
    }
  }, [onCapture, stopCamera]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onCapture(result);
      };
      reader.readAsDataURL(file);
    }
  }, [onCapture]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  }, [stopCamera]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // Mark component as mounted
  useEffect(() => {
    setIsMounted(true);
    return () => {
      // no state updates needed on unmount
    };
  }, []);

  // Auto-start camera when component mounts (wait one tick for videoRef)
  useEffect(() => {
    if (isMounted && !capturedImage && !isStreaming && !stream) {
      const timer = setTimeout(() => {
        startCamera();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isMounted, capturedImage, startCamera, isStreaming, stream]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isStreaming && isMounted) {
      startCamera();
    }
  }, [facingMode, isMounted, isStreaming, startCamera]);

  if (capturedImage) {
    return (
      <div className={cn("relative rounded-xl overflow-hidden bg-muted", className)}>
        <img
          src={capturedImage}
          alt="Foto capturada"
          className="w-full h-full object-cover"
        />
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-3 right-3"
          onClick={onClear}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-xl overflow-hidden bg-muted", className)}>
      <canvas ref={canvasRef} className="hidden" />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Keep video mounted so we can attach the stream even before "isStreaming" becomes true */}
      <div className="relative w-full h-full min-h-[300px]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity",
            isStreaming ? "opacity-100" : "opacity-0",
          )}
        />

        {isStreaming ? (
          <>
            {/* Animated focus guide overlay */}
            <div className="absolute inset-0 pointer-events-none z-[5]">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-[80%] h-[70%] max-w-[320px] max-h-[240px]">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg animate-pulse" />
                  <div
                    className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <div
                    className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  />
                  <div
                    className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg animate-pulse"
                    style={{ animationDelay: "0.6s" }}
                  />

                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/60" />
                    <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/60" />
                  </div>
                </div>
              </div>

              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1.5 rounded-full backdrop-blur-sm">
                Centralize a encomenda
              </div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
              <Button
                variant="secondary"
                size="icon"
                onClick={switchCamera}
                className="rounded-full w-12 h-12"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
              <Button
                variant="default"
                size="icon"
                onClick={capturePhoto}
                className="rounded-full w-16 h-16 bg-white hover:bg-white/90 text-foreground shadow-lg"
              >
                <div className="w-12 h-12 rounded-full border-4 border-foreground" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={stopCamera}
                className="rounded-full w-12 h-12"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </>
        ) : isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 animate-pulse" />
              <Loader2 className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground text-center animate-pulse">Iniciando câmera...</p>
          </div>
        ) : isPermissionDenied ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-4 overflow-auto">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-destructive">Acesso à câmera negado</p>
              <p className="text-xs text-muted-foreground">Para liberar a câmera, siga os passos:</p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3 text-left w-full max-w-xs space-y-2">
              <p className="text-xs font-medium text-foreground">No Chrome/Edge:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Clique no ícone de cadeado 🔒 na barra de endereço</li>
                <li>Encontre "Câmera" nas permissões</li>
                <li>Altere para "Permitir"</li>
                <li>Recarregue a página</li>
              </ol>
              
              <p className="text-xs font-medium text-foreground pt-2">No Safari (iOS):</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Vá em Ajustes {">"} Safari</li>
                <li>Toque em "Câmera"</li>
                <li>Selecione "Permitir"</li>
              </ol>
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              <Button onClick={startCamera} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                Usar Galeria
              </Button>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-4">
            {error ? (
              <div className="text-center space-y-2">
                <p className="text-sm text-destructive">{error}</p>
                <Button onClick={startCamera} variant="outline" size="sm" className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Tentar Novamente
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center">Tire uma foto da encomenda</p>
            )}
            <div className="flex gap-3">
              <Button onClick={startCamera} className="gap-2">
                <Camera className="w-4 h-4" />
                Abrir Câmera
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                Galeria
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
