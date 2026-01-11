import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Pencil,
  Save,
  X,
  Loader2,
  RotateCcw,
  Zap,
  Info,
} from "lucide-react";

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  content: string;
  variables: string[];
  is_active: boolean;
}

const TEMPLATE_COLORS: Record<string, string> = {
  notification_occurrence: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  decision_archived: "bg-green-500/10 text-green-500 border-green-500/20",
  decision_warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  decision_fine: "bg-red-500/10 text-red-500 border-red-500/20",
  notify_sindico_defense: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  trial_ending: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  trial_expired: "bg-red-500/10 text-red-500 border-red-500/20",
  trial_welcome: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  condominium_transfer: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  condominium_transfer_old_owner: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  payment_confirmed: "bg-green-500/10 text-green-500 border-green-500/20",
  invoice_generated: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  party_hall_reminder: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  party_hall_cancelled: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

// Example values for preview
const VARIABLE_EXAMPLES: Record<string, string> = {
  nome: "João Silva",
  condominio: "Residencial Primavera",
  tipo: "Advertência",
  titulo: "Barulho após horário permitido",
  link: "https://app.exemplo.com/xyz123",
  justificativa: "Após análise, consideramos procedente a reclamação.",
  nome_morador: "Maria Santos",
  dias_restantes: "3 dias",
  data_expiracao: "15/01/2026",
  link_planos: "https://app.exemplo.com/planos",
  link_dashboard: "https://app.exemplo.com/dashboard",
  nome_novo_sindico: "Carlos Oliveira",
  nome_antigo_sindico: "Pedro Costa",
  data_transferencia: "10/01/2026",
  observacoes: "• Transferência solicitada pelo síndico anterior",
  descricao_fatura: "Mensalidade Janeiro/2026",
  metodo_pagamento: "PIX",
  valor: "R$ 149,90",
  data_pagamento: "10/01/2026",
  numero_fatura: "FAT-2026-001",
  periodo: "01/01/2026 a 31/01/2026",
  data_vencimento: "15/01/2026",
  espaco: "Salão de Festas",
  data: "15/01/2026",
  horario_inicio: "14:00",
  horario_fim: "22:00",
  checklist: "*Cozinha:*\n  • Fogão\n  • Geladeira\n  • Microondas\n*Salão:*\n  • Mesas\n  • Cadeiras\n  • Ar condicionado",
};

const DEFAULT_TEMPLATES: Record<string, string> = {
  notification_occurrence: `🏢 *{condominio}*

Olá, *{nome}*!

Você recebeu uma *{tipo}*:
📋 *{titulo}*

Acesse o link abaixo para ver os detalhes e apresentar sua defesa:
👉 {link}

Este link é pessoal e intransferível.`,
  decision_archived: `✅ *DECISÃO: ARQUIVADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* ARQUIVADA

Sua defesa foi aceita e a ocorrência foi arquivada. Nenhuma penalidade será aplicada.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}`,
  decision_warning: `⚠️ *DECISÃO: ADVERTÊNCIA APLICADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* ADVERTÊNCIA APLICADA

Após análise da sua defesa, foi decidido aplicar uma advertência formal.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}`,
  decision_fine: `🚨 *DECISÃO: MULTA APLICADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua defesa referente à ocorrência "{titulo}" foi analisada.

📋 *Decisão:* MULTA APLICADA

Após análise da sua defesa, foi decidido aplicar uma multa. Verifique os detalhes no sistema.

💬 *Justificativa:*
{justificativa}

Acesse o sistema para mais detalhes:
👉 {link}`,
  notify_sindico_defense: `📋 *Nova Defesa Recebida*

🏢 *{condominio}*

O morador *{nome_morador}* enviou uma defesa para a ocorrência:

📝 *{titulo}*
Tipo: {tipo}

Acesse o sistema para analisar:
👉 {link}`,
  trial_ending: `⏰ *Seu Período de Teste está Acabando!*

🏢 *{condominio}*

Olá, *{nome}*!

Seu período de teste gratuito do Condomínio Legal termina em *{dias_restantes}*.

📅 *Data de expiração:* {data_expiracao}

Para continuar utilizando todos os recursos da plataforma, assine um de nossos planos:
👉 {link_planos}

Não perca acesso a:
✅ Notificações automatizadas
✅ Gestão de ocorrências  
✅ Controle de multas e advertências

Qualquer dúvida, estamos à disposição!`,
  trial_expired: `🔔 *Seu Período de Teste Expirou*

🏢 *{condominio}*

Olá, *{nome}*!

Seu período de teste gratuito do Condomínio Legal *expirou em {data_expiracao}*.

Para continuar utilizando a plataforma, assine um de nossos planos:
👉 {link_planos}

📦 *Planos disponíveis:*
• Start - Ideal para pequenos condomínios
• Essencial - Recursos completos
• Profissional - Sem limites

Esperamos você de volta! 💙`,
  trial_welcome: `🎉 *Bem-vindo ao Condomínio Legal!*

🏢 *{condominio}*

Olá, *{nome}*!

Seu período de teste de *7 dias* começou!

📅 *Expira em:* {data_expiracao}

Durante o trial você tem acesso a:
✅ Até 10 notificações
✅ Até 10 advertências  
✅ Sistema completo de ocorrências

Acesse agora e explore:
👉 {link_dashboard}

Qualquer dúvida, estamos aqui para ajudar!`,
  condominium_transfer: `🔄 *TRANSFERÊNCIA DE CONDOMÍNIO*

Olá, *{nome_novo_sindico}*!

O condomínio *{condominio}* foi transferido para sua gestão.

📋 *Detalhes da transferência:*
• Síndico anterior: {nome_antigo_sindico}
• Data: {data_transferencia}
{observacoes}

Acesse o sistema para gerenciar seu novo condomínio:
👉 {link}

Bem-vindo(a) à gestão do condomínio!`,
  condominium_transfer_old_owner: `🔄 *TRANSFERÊNCIA DE CONDOMÍNIO*

Olá, *{nome_antigo_sindico}*!

O condomínio *{condominio}* foi transferido da sua gestão.

📋 *Detalhes da transferência:*
• Novo síndico: {nome_novo_sindico}
• Data: {data_transferencia}
{observacoes}

Agradecemos pelo seu trabalho na gestão do condomínio!

Em caso de dúvidas, entre em contato com o suporte.`,
  payment_confirmed: `💰 *Pagamento Confirmado!*

🏢 *{condominio}*

Olá, *{nome}*!

Um pagamento foi confirmado:
📋 Fatura: {descricao_fatura}
💳 Método: *{metodo_pagamento}*
💵 Valor: *{valor}*
📅 Data: {data_pagamento}

✅ A fatura foi marcada como paga automaticamente.`,
  invoice_generated: `📄 *Nova Fatura Gerada*

🏢 *{condominio}*

Olá, *{nome}*!

Uma nova fatura foi gerada para o seu condomínio:

📋 *Detalhes:*
• Número: {numero_fatura}
• Período: {periodo}
• Valor: *{valor}*
• Vencimento: *{data_vencimento}*

Acesse o sistema para visualizar e efetuar o pagamento:
👉 {link}

💡 Pague via PIX para confirmação instantânea!`,
  party_hall_reminder: `🎉 *LEMBRETE DE RESERVA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua reserva do *{espaco}* está confirmada para:
📅 *Data:* {data}
⏰ *Horário:* {horario_inicio} às {horario_fim}

{checklist}

📋 *Lembre-se:*
• Compareça no horário para o checklist de entrada
• Respeite as regras do espaço

Em caso de dúvidas, entre em contato com a administração.

Boa festa! 🎊`,
  party_hall_cancelled: `❌ *RESERVA CANCELADA*

🏢 *{condominio}*

Olá, *{nome}*!

Sua reserva do *{espaco}* foi cancelada:
📅 *Data:* {data}
⏰ *Horário:* {horario_inicio} às {horario_fim}

Em caso de dúvidas, entre em contato com a administração.

Atenciosamente,
Equipe {condominio}`,
};

export function WhatsAppTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Template[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      content,
      name,
      description,
    }: {
      id: string;
      content: string;
      name: string;
      description: string;
    }) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ content, name, description })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({ title: "Template atualizado com sucesso!" });
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, slug }: { id: string; slug: string }) => {
      const defaultContent = DEFAULT_TEMPLATES[slug];
      if (!defaultContent) throw new Error("Template padrão não encontrado");

      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ content: defaultContent })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({ title: "Template restaurado para o padrão!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao restaurar template",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setEditContent(template.content);
    setEditName(template.name);
    setEditDescription(template.description || "");
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    updateMutation.mutate({
      id: editingTemplate.id,
      content: editContent,
      name: editName,
      description: editDescription,
    });
  };

  const handleReset = (template: Template) => {
    if (confirm("Tem certeza que deseja restaurar este template para o padrão?")) {
      resetMutation.mutate({ id: template.id, slug: template.slug });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Templates de Mensagem</CardTitle>
              <CardDescription>
                Personalize os templates de mensagens enviadas via WhatsApp
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-500 mb-1">Variáveis disponíveis</p>
              <p className="text-muted-foreground">
                Use as variáveis entre chaves para inserir dados dinâmicos. Ex:{" "}
                <code className="bg-muted px-1 rounded">{"{nome}"}</code> será substituído pelo nome do morador.
              </p>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {templates?.map((template) => (
              <AccordionItem key={template.id} value={template.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <Badge className={TEMPLATE_COLORS[template.slug] || "bg-muted"}>
                      {template.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {template.description}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50 font-mono text-sm whitespace-pre-wrap">
                      {template.content}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground">Variáveis:</span>
                      {template.variables.map((variable) => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          {`{${variable}}`}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(template)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReset(template)}
                        disabled={resetMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restaurar Padrão
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Separator className="my-4" />

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-500 mb-1">Importante</p>
              <p className="text-muted-foreground">
                Alterações nos templates serão aplicadas imediatamente em todos os novos envios. 
                Mensagens já enviadas não serão afetadas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
            <DialogDescription>
              {editingTemplate?.name} - {editingTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome do Template</Label>
              <Input
                id="template-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-description">Descrição</Label>
              <Input
                id="template-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-content">Conteúdo da Mensagem</Label>
              <Textarea
                id="template-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Variáveis disponíveis:</span>
              {editingTemplate?.variables.map((variable) => (
                <Badge
                  key={variable}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-muted"
                  onClick={() => setEditContent((prev) => prev + `{${variable}}`)}
                >
                  {`{${variable}}`}
                </Badge>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs font-medium text-green-600">Preview da Mensagem</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-sm border border-border/50">
                <div className="font-mono text-sm whitespace-pre-wrap text-foreground">
                  {editContent.replace(/\{(\w+)\}/g, (match, variable) => {
                    return VARIABLE_EXAMPLES[variable] || match;
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                * Os valores acima são exemplos. As variáveis serão substituídas pelos dados reais no envio.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
