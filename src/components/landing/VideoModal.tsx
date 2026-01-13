import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, X } from "lucide-react";

interface VideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VideoModal = ({ open, onOpenChange }: VideoModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 bg-card border-border overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            Demonstração do NotificaCondo
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative w-full aspect-video bg-black">
          {/* Placeholder para vídeo - substitua pela URL do seu vídeo */}
          <iframe
            className="w-full h-full"
            src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"
            title="Demonstração NotificaCondo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        
        <div className="p-4 bg-secondary/30 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            Veja como o NotificaCondo pode transformar a gestão do seu condomínio
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoModal;
