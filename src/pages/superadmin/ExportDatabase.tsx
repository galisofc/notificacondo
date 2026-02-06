import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Database, Loader2, Copy, CheckCircle, Download } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScriptBlock {
  key: string;
  sql: string;
}

export default function ExportDatabase() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [scripts, setScripts] = useState<ScriptBlock[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    setScripts([]);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("export-database");

      if (fnError) throw fnError;

      if (data?.scripts) {
        const entries = Object.entries(data.scripts as Record<string, string>)
          .map(([key, sql]) => ({ key, sql }));
        setScripts(entries);
        toast({ title: "Exportação concluída!", description: `${entries.length} scripts gerados.` });
      } else {
        throw new Error(data?.error || "Resposta inesperada da função");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao exportar");
      toast({ title: "Erro na exportação", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = async () => {
    const allSql = scripts.map((s) => `-- ${s.table} (${s.type})\n${s.sql}`).join("\n\n");
    await navigator.clipboard.writeText(allSql);
    toast({ title: "Todos os scripts copiados!" });
  };

  const downloadAll = () => {
    const allSql = scripts.map((s) => `-- ${s.table} (${s.type})\n${s.sql}`).join("\n\n");
    const blob = new Blob([allSql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-database-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Exportar Banco de Dados</h1>
          <p className="text-muted-foreground">
            Gere scripts SQL para migrar os dados para outro servidor.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Exportação Completa
            </CardTitle>
            <CardDescription>
              Gera CREATE TABLE + INSERT INTO para todas as tabelas, respeitando a ordem de dependências.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleExport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    Exportar Banco de Dados
                  </>
                )}
              </Button>

              {scripts.length > 0 && (
                <>
                  <Button variant="outline" onClick={copyAll}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Tudo
                  </Button>
                  <Button variant="outline" onClick={downloadAll}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar .sql
                  </Button>
                </>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {scripts.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {scripts.length} scripts gerados. Execute na ordem apresentada.
            </p>

            {scripts.map((script, index) => (
              <Card key={index}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                        #{script.execution_order}
                      </span>
                      <CardTitle className="text-sm">{script.table}</CardTitle>
                      <span className="text-xs text-muted-foreground">({script.type})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(script.sql, index)}
                    >
                      {copiedIndex === index ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <ScrollArea className="max-h-[300px]">
                    <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                      {script.sql}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
