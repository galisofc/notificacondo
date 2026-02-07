import { useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Download, Copy, Loader2, CheckCircle2 } from "lucide-react";

type ScriptSection = "enums" | "tables" | "functions" | "policies" | "data";

const SECTION_LABELS: Record<ScriptSection, string> = {
  enums: "Tipos ENUM",
  tables: "Definições de Tabelas",
  functions: "Funções e Triggers",
  policies: "Políticas RLS",
  data: "Dados (INSERT)",
};

const ExportDatabase = () => {
  const [scripts, setScripts] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setLoading(true);
    setProgress(10);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      setProgress(30);

      const { data, error } = await supabase.functions.invoke("export-database", {
        body: { section: "all" },
      });

      setProgress(90);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setScripts(data.scripts);
      setProgress(100);
      toast.success("Scripts gerados com sucesso!");
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error(err.message || "Erro ao gerar scripts de exportação");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (section: string) => {
    if (!scripts?.[section]) return;
    await navigator.clipboard.writeText(scripts[section]);
    toast.success(`Script "${SECTION_LABELS[section as ScriptSection]}" copiado!`);
  };

  const handleDownload = (section: string) => {
    if (!scripts?.[section]) return;
    const blob = new Blob([scripts[section]], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-${section}-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    if (!scripts) return;
    const allSql = Object.entries(scripts)
      .map(([, sql]) => sql)
      .join("\n\n");
    const blob = new Blob([allSql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-completo-${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sectionOrder: ScriptSection[] = ["enums", "tables", "functions", "policies", "data"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <SuperAdminBreadcrumbs
          items={[{ label: "Exportar Banco de Dados" }]}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Exportar Banco de Dados
            </CardTitle>
            <CardDescription>
              Gera scripts SQL completos para migração do banco de dados,
              incluindo schemas, dados, funções, triggers e políticas RLS.
              Senhas de usuários e arquivos de storage não são incluídos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button onClick={handleExport} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando scripts...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Gerar Scripts SQL
                  </>
                )}
              </Button>
              {scripts && (
                <Button variant="outline" onClick={handleDownloadAll}>
                  <Download className="h-4 w-4" />
                  Baixar Tudo (.sql)
                </Button>
              )}
            </div>

            {loading && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  Exportando banco de dados... Isso pode levar alguns segundos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {scripts &&
          sectionOrder.map((section) => {
            const sql = scripts[section];
            if (!sql) return null;
            const lineCount = sql.split("\n").length;

            return (
              <Card key={section}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {SECTION_LABELS[section]}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(section)}
                      >
                        <Copy className="h-3 w-3" />
                        Copiar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(section)}
                      >
                        <Download className="h-3 w-3" />
                        Baixar
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>{lineCount} linhas</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-80 overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-all">
                    {sql}
                  </pre>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </DashboardLayout>
  );
};

export default ExportDatabase;
