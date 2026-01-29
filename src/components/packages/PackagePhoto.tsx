import { useState } from "react";
import { usePackagePhotoUrl } from "@/hooks/useSignedUrl";
import { Loader2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PackagePhotoProps {
  photoUrl: string | null | undefined;
  alt?: string;
  className?: string;
  aspectRatio?: "video" | "square" | "auto";
  showLoadingState?: boolean;
}

/**
 * Component to display package photos from private storage
 * Automatically generates signed URLs for authenticated access
 */
export function PackagePhoto({
  photoUrl,
  alt = "Foto da encomenda",
  className,
  aspectRatio = "video",
  showLoadingState = true,
}: PackagePhotoProps) {
  const { signedUrl, loading, error } = usePackagePhotoUrl(photoUrl);
  const [imageError, setImageError] = useState(false);

  const aspectClasses = {
    video: "aspect-video",
    square: "aspect-square",
    auto: "",
  };

  if (!photoUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-lg",
          aspectClasses[aspectRatio],
          className
        )}
      >
        <ImageOff className="w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  if (loading && showLoadingState) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted rounded-lg",
          aspectClasses[aspectRatio],
          className
        )}
      >
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || imageError || !signedUrl) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center bg-muted rounded-lg gap-2",
          aspectClasses[aspectRatio],
          className
        )}
      >
        <ImageOff className="w-8 h-8 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {error || "Erro ao carregar imagem"}
        </span>
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={cn(
        "w-full h-full object-cover rounded-lg",
        aspectClasses[aspectRatio],
        className
      )}
      onError={() => setImageError(true)}
    />
  );
}
