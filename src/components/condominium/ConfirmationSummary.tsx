import { Building2, Home, MapPin, FileText, Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCNPJ } from "@/lib/utils";

interface ConfirmationSummaryProps {
  condominiumName: string;
  cnpj?: string;
  address?: string;
  blockNames: string[];
  apartmentsPerBlock: number;
  planName?: string;
}

export function ConfirmationSummary({
  condominiumName,
  cnpj,
  address,
  blockNames,
  apartmentsPerBlock,
  planName,
}: ConfirmationSummaryProps) {
  const totalApartments = blockNames.length * apartmentsPerBlock;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Resumo do Cadastro</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Confira os dados antes de confirmar
        </p>
      </div>

      <Card className="bg-secondary/30 border-border">
        <CardContent className="pt-6 space-y-4">
          {/* Condominium Info */}
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">{condominiumName}</p>
              {cnpj && (
                <p className="text-sm text-muted-foreground">CNPJ: {formatCNPJ(cnpj)}</p>
              )}
            </div>
          </div>

          {/* Address */}
          {address && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">{address}</p>
            </div>
          )}

          {/* Plan */}
          {planName && (
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">Plano: {planName}</p>
            </div>
          )}

          <div className="border-t border-border pt-4 mt-4" />

          {/* Blocks and Apartments Summary */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold text-foreground">{blockNames.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">Blocos</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <Home className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold text-foreground">{apartmentsPerBlock}</span>
              </div>
              <p className="text-xs text-muted-foreground">Apts/Bloco</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold text-foreground">{totalApartments}</span>
              </div>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4" />

          {/* Block Names List */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Blocos a serem criados:</p>
            <div className="flex flex-wrap gap-1">
              {blockNames.map((name, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <p className="text-sm text-amber-600 dark:text-amber-400">
          <strong>Atenção:</strong> Ao confirmar, serão criados automaticamente{" "}
          <strong>{blockNames.length} blocos</strong> com{" "}
          <strong>{apartmentsPerBlock} apartamentos cada</strong>, totalizando{" "}
          <strong>{totalApartments} apartamentos</strong>.
        </p>
      </div>
    </div>
  );
}
