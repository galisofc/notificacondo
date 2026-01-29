import { useState, useCallback } from "react";
import { Package, RefreshCw, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PackageCardImageProps {
  src: string;
  alt?: string;
  className?: string;
  compact?: boolean;
}

export function PackageCardImage({
  src,
  alt = "Encomenda",
  className,
  compact = false,
}: PackageCardImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleRetry = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    setHasError(false);
    setRetryCount((prev) => prev + 1);
  }, []);

  // Add cache-busting query param on retry
  const imageSrc = retryCount > 0 ? `${src}${src.includes("?") ? "&" : "?"}retry=${retryCount}` : src;

  if (hasError) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
          compact ? "w-16 h-16 rounded-lg" : "aspect-video",
          className
        )}
      >
        <ImageOff className={cn(compact ? "w-5 h-5" : "w-8 h-8")} />
        {!compact && (
          <>
            <span className="text-xs text-center px-2">Falha ao carregar</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="gap-1.5 h-7 text-xs"
            >
              <RefreshCw className="w-3 h-3" />
              Tentar novamente
            </Button>
          </>
        )}
        {compact && (
          <button
            onClick={handleRetry}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-lg"
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative", compact ? "w-16 h-16" : "aspect-video", className)}>
      {isLoading && (
        <Skeleton
          className={cn(
            "absolute inset-0",
            compact ? "rounded-lg" : ""
          )}
        />
      )}
      <img
        key={imageSrc}
        src={imageSrc}
        alt={alt}
        className={cn(
          "w-full h-full object-cover",
          compact && "rounded-lg",
          isLoading && "opacity-0"
        )}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
