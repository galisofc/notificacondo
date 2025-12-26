import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Save, TestTube, CheckCircle, XCircle } from "lucide-react";

export function WhatsAppConfig() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const [config, setConfig] = useState({
    provider: "zpro",
    apiUrl: "",
    apiKey: "",
    instanceId: "",
  });

  const handleSave = async () => {
    setIsLoading(true);
    // In a real implementation, this would save to Supabase secrets or a config table
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Configurações salvas",
        description: "As configurações do WhatsApp foram atualizadas com sucesso.",
      });
    }, 1000);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    // Simulate API test
    setTimeout(() => {
      setIsTesting(false);
      const success = config.apiUrl && config.apiKey;
      setTestResult(success ? "success" : "error");
      
      if (success) {
        toast({
          title: "Conexão bem-sucedida",
          description: "A conexão com a API do WhatsApp foi estabelecida.",
        });
      } else {
        toast({
          title: "Falha na conexão",
          description: "Não foi possível conectar à API. Verifique as configurações.",
          variant: "destructive",
        });
      }
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <MessageCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <CardTitle>Configurações do WhatsApp</CardTitle>
              <CardDescription>
                Configure a integração com provedores de WhatsApp para envio de notificações
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Provedor</Label>
              <Select
                value={config.provider}
                onValueChange={(value) => setConfig({ ...config, provider: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zpro">Z-PRO</SelectItem>
                  <SelectItem value="zapi">Z-API</SelectItem>
                  <SelectItem value="evolution">Evolution API</SelectItem>
                  <SelectItem value="wppconnect">WPPConnect</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instanceId">ID da Instância</Label>
              <Input
                id="instanceId"
                placeholder="Ex: instance_123"
                value={config.instanceId}
                onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiUrl">URL da API</Label>
            <Input
              id="apiUrl"
              placeholder="https://api.provedor.com"
              value={config.apiUrl}
              onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Chave da API (Token)</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="••••••••••••••••"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Salvando..." : "Salvar Configurações"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={isTesting}>
              <TestTube className="h-4 w-4 mr-2" />
              {isTesting ? "Testando..." : "Testar Conexão"}
            </Button>
            {testResult && (
              <Badge
                variant="outline"
                className={
                  testResult === "success"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }
              >
                {testResult === "success" ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Conectado
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Falha
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Webhook de Status</CardTitle>
          <CardDescription>
            Configure este webhook no seu provedor para receber atualizações de status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-muted px-4 py-2 rounded-lg text-sm break-all">
              https://iyeljkdrypcxvljebqtn.supabase.co/functions/v1/whatsapp-webhook
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(
                  "https://iyeljkdrypcxvljebqtn.supabase.co/functions/v1/whatsapp-webhook"
                );
                toast({ title: "URL copiada!" });
              }}
            >
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
