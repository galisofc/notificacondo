import { useState, useRef, useCallback } from "react";
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
  isUploading?: boolean;
  aspectRatio?: number;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
  isUploading = false,
  aspectRatio = 1,
}: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspectRatio));
    },
    [aspectRatio]
  );

  const getCroppedImg = useCallback(async (): Promise<Blob | null> => {
    if (!completedCrop || !imgRef.current) return null;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelRatio = window.devicePixelRatio || 1;
    const outputSize = 400; // Fixed output size for avatar

    canvas.width = outputSize * pixelRatio;
    canvas.height = outputSize * pixelRatio;

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = "high";

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    const centerX = outputSize / 2;
    const centerY = outputSize / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputSize,
      outputSize
    );

    ctx.restore();

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        "image/jpeg",
        0.9
      );
    });
  }, [completedCrop, rotate, scale]);

  const handleConfirm = async () => {
    const croppedBlob = await getCroppedImg();
    if (croppedBlob) {
      onCropComplete(croppedBlob);
    }
  };

  const handleRotate = () => {
    setRotate((prev) => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center min-h-[200px] max-h-[300px]">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspectRatio}
          circularCrop
          className="max-h-[300px]"
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Imagem para recorte"
            onLoad={onImageLoad}
            style={{
              transform: `scale(${scale}) rotate(${rotate}deg)`,
              maxHeight: "300px",
              width: "auto",
            }}
            className="transition-transform duration-200"
          />
        </ReactCrop>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Zoom Slider */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="h-8 w-8"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Slider
            value={[scale]}
            onValueChange={([value]) => setScale(value)}
            min={0.5}
            max={3}
            step={0.1}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="h-8 w-8"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleRotate}
            className="h-8 w-8"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isUploading}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
          <Button
            type="button"
            variant="hero"
            onClick={handleConfirm}
            disabled={isUploading || !completedCrop}
            className="flex-1"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-1" />
            )}
            Confirmar
          </Button>
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Arraste para posicionar • Use o zoom e rotação para ajustar
      </p>
    </div>
  );
}