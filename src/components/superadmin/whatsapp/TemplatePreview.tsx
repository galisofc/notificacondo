import { VARIABLE_EXAMPLES } from "./TemplateCategories";

interface TemplatePreviewProps {
  content: string;
  className?: string;
}

export function TemplatePreview({ content, className = "" }: TemplatePreviewProps) {
  const previewContent = content.replace(/\{(\w+)\}/g, (match, variable) => {
    return VARIABLE_EXAMPLES[variable] || match;
  });

  return (
    <div className={`relative ${className}`}>
      {/* WhatsApp-like container */}
      <div className="bg-[#0b141a] rounded-xl sm:rounded-2xl p-3 sm:p-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 pb-2 sm:pb-3 border-b border-white/10">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs sm:text-sm">C</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium text-xs sm:text-sm truncate">Condomínio Legal</p>
            <p className="text-white/60 text-[10px] sm:text-xs">online</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="pt-3 sm:pt-4 space-y-2">
          {/* Incoming message bubble */}
          <div className="flex justify-start">
            <div className="max-w-[90%] sm:max-w-[85%] bg-[#202c33] rounded-lg rounded-tl-none p-2 sm:p-3 shadow-sm relative">
              {/* Tail */}
              <div className="absolute -left-2 top-0 w-0 h-0 border-t-[8px] border-t-[#202c33] border-l-[8px] border-l-transparent" />
              
              <div className="text-white/90 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {formatWhatsAppMessage(previewContent)}
              </div>
              <div className="flex justify-end mt-1">
                <span className="text-white/40 text-[9px] sm:text-[10px]">14:32</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3 text-center italic">
        * Os valores são exemplos. Serão substituídos pelos dados reais.
      </p>
    </div>
  );
}

function formatWhatsAppMessage(text: string): React.ReactNode {
  // Convert WhatsApp formatting to styled spans
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  // Match bold (*text*), but not bullet points
  const boldRegex = /\*([^*\n]+)\*/g;
  let match;
  let lastIndex = 0;
  const formattedParts: { start: number; end: number; content: string; type: 'bold' }[] = [];

  while ((match = boldRegex.exec(text)) !== null) {
    formattedParts.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
      type: 'bold'
    });
  }

  if (formattedParts.length === 0) {
    return text;
  }

  formattedParts.forEach((part, idx) => {
    // Add text before this part
    if (part.start > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, part.start)}</span>);
    }
    // Add formatted part
    parts.push(
      <span key={key++} className="font-bold">
        {part.content}
      </span>
    );
    lastIndex = part.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}
