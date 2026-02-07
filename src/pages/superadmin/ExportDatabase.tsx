import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import SuperAdminBreadcrumbs from "@/components/superadmin/SuperAdminBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Download, Copy, Loader2, CheckCircle2, Table2 } from "lucide-react";

type ScriptSection = "enums" | "tables" | "functions" | "policies" | "data";

const SECTION_LABELS: Record<ScriptSection, string> = {
  enums: "Tipos ENUM",
  tables: "Definições de Tabelas",
  functions: "Funções e Triggers",
  policies: "Políticas RLS",
  data: "Dados (INSERT)",
};

/** Parse the data SQL into per-table chunks */
function parseDataByTable(dataSql: string): { name: string; sql: string; rowCount: number }[] {
  const tables: { name: string; sql: string; rowCount: number }[] = [];
  const regex = /-- Table: (\S+) \((\d+) rows?\)\n([\s\S]*?)(?=\n-- Table: |\n*$)/g;
  let match;
  while ((match = regex.exec(dataSql)) !== null) {
    tables.push({
      name: match[1],
      sql: match[0].trim(),
      rowCount: parseInt(match[2], 10),
    });
  }
  return tables;
}

const ExportDatabase = () => {
  const [scripts, setScripts] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const dataTables = useMemo(() => {
    if (!scripts?.data) return [];
    return parseDataByTable(scripts.data);
  }, [scripts]);

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

  const handleCopy = async (content: string, label: string) => {
    await navigator.clipboard.writeText(content);
    toast.success(`"${label}" copiado!`);
  };

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const today = new Date().toISOString().slice(0, 10);

  const handleDownloadAll = () => {
    if (!scripts) return;
    const allSql = Object.entries(scripts)
      .map(([, sql]) => sql)
      .join("\n\n");
    handleDownload(allSql, `export-completo-${today}.sql`);
  };

  const schemaSections: ScriptSection[] = ["enums", "tables", "functions", "policies"];

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

        {scripts && (
          <Tabs defaultValue="schema" className="space-y-4">
            <TabsList>
              <TabsTrigger value="schema">Estrutura</TabsTrigger>
              <TabsTrigger value="data">
                Dados ({dataTables.length} tabelas)
              </TabsTrigger>
            </TabsList>

            {/* Schema sections */}
            <TabsContent value="schema" className="space-y-4">
              {schemaSections.map((section) => {
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
                            onClick={() => handleCopy(sql, SECTION_LABELS[section])}
                          >
                            <Copy className="h-3 w-3" />
                            Copiar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(sql, `export-${section}-${today}.sql`)}
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
            </TabsContent>

            {/* Data per table */}
            <TabsContent value="data" className="space-y-4">
              <div className="flex gap-2 mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (scripts.data) handleDownload(scripts.data, `export-data-completo-${today}.sql`);
                  }}
                >
                  <Download className="h-3 w-3" />
                  Baixar Todos os Dados
                </Button>
              </div>

              {dataTables.map((table) => (
                <Card key={table.name}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <Table2 className="h-4 w-4 text-primary" />
                        {table.name}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(table.sql, table.name)}
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(table.sql, `export-${table.name}-${today}.sql`)}
                        >
                          <Download className="h-3 w-3" />
                          Baixar
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>{table.rowCount} registros</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="max-h-60 overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap break-all">
                      {table.sql}
                    </pre>
                  </CardContent>
                </Card>
              ))}

              {dataTables.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tabela com dados encontrada.</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ExportDatabase;
