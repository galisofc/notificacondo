import { Shield, ArrowLeft, Lock, Eye, Database, UserCheck, Mail, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const sections = [
  {
    id: "coleta",
    icon: Database,
    title: "1. Coleta de Dados",
    content: `O NotificaCondo coleta os seguintes tipos de dados pessoais:

**Dados de Identificação:** Nome completo, CPF, e-mail e telefone dos síndicos e moradores.

**Dados de Localização:** Endereço do condomínio e unidades habitacionais.

**Dados de Uso:** Informações sobre como você utiliza nossa plataforma, incluindo logs de acesso, páginas visitadas e ações realizadas.

**Dados de Comunicação:** Mensagens enviadas através da plataforma, incluindo notificações, advertências e defesas.

Os dados são coletados de forma direta (quando você os fornece) e automática (através de cookies e tecnologias similares).`,
  },
  {
    id: "uso",
    icon: Eye,
    title: "2. Uso dos Dados",
    content: `Utilizamos seus dados pessoais para:

• **Prestação de Serviços:** Gerenciar notificações, advertências e multas condominiais.

• **Comunicação:** Enviar mensagens via WhatsApp e e-mail relacionadas às ocorrências do condomínio.

• **Melhoria do Serviço:** Analisar o uso da plataforma para aprimorar funcionalidades e experiência do usuário.

• **Obrigações Legais:** Cumprir exigências legais e regulatórias, incluindo a manutenção de registros para fins jurídicos.

• **Segurança:** Proteger contra fraudes e acessos não autorizados.`,
  },
  {
    id: "compartilhamento",
    icon: UserCheck,
    title: "3. Compartilhamento de Dados",
    content: `Seus dados podem ser compartilhados com:

• **Síndicos e Administradores:** Os síndicos têm acesso aos dados dos moradores de seus respectivos condomínios para fins de gestão condominial.

• **Prestadores de Serviço:** Empresas que nos auxiliam na operação da plataforma (hospedagem, envio de mensagens, processamento de pagamentos).

• **Autoridades Competentes:** Quando exigido por lei ou ordem judicial.

**Não vendemos seus dados pessoais para terceiros.**`,
  },
  {
    id: "seguranca",
    icon: Lock,
    title: "4. Segurança dos Dados",
    content: `Adotamos medidas técnicas e organizacionais para proteger seus dados:

• **Criptografia:** Dados sensíveis são criptografados em trânsito (HTTPS/TLS) e em repouso.

• **Controle de Acesso:** Acesso restrito apenas a funcionários e prestadores autorizados.

• **Monitoramento:** Sistemas de detecção de intrusão e logs de auditoria.

• **Backups:** Cópias de segurança regulares para garantir a disponibilidade dos dados.

• **Tokens Seguros:** Links de acesso temporários e seguros para moradores acessarem suas notificações.`,
  },
  {
    id: "direitos",
    icon: FileText,
    title: "5. Seus Direitos (LGPD)",
    content: `De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:

• **Acesso:** Solicitar cópia dos seus dados pessoais que possuímos.

• **Correção:** Solicitar a correção de dados incompletos, inexatos ou desatualizados.

• **Anonimização/Bloqueio/Eliminação:** Solicitar o tratamento de dados desnecessários ou excessivos.

• **Portabilidade:** Solicitar a transferência dos seus dados para outro fornecedor.

• **Revogação do Consentimento:** Revogar o consentimento a qualquer momento.

• **Oposição:** Opor-se ao tratamento de dados quando aplicável.

Para exercer esses direitos, entre em contato através do e-mail: **privacidade@notificacondo.com.br**`,
  },
  {
    id: "cookies",
    icon: Eye,
    title: "6. Cookies e Tecnologias",
    content: `Utilizamos cookies e tecnologias similares para:

• **Cookies Essenciais:** Necessários para o funcionamento da plataforma (autenticação, segurança).

• **Cookies de Preferências:** Lembrar suas configurações e preferências.

• **Cookies Analíticos:** Entender como você utiliza a plataforma para melhorias.

Você pode gerenciar suas preferências de cookies através das configurações do seu navegador. Note que desabilitar alguns cookies pode afetar a funcionalidade da plataforma.`,
  },
  {
    id: "retencao",
    icon: Database,
    title: "7. Retenção de Dados",
    content: `Mantemos seus dados pessoais pelo tempo necessário para:

• Cumprir as finalidades para as quais foram coletados.

• Cumprir obrigações legais e regulatórias.

• Exercer direitos em processos judiciais, administrativos ou arbitrais.

**Dados de ocorrências condominiais** são mantidos por no mínimo 5 (cinco) anos, conforme exigências legais para fins de prova em eventuais disputas.

Após o término do período de retenção, os dados serão eliminados de forma segura ou anonimizados.`,
  },
  {
    id: "contato",
    icon: Mail,
    title: "8. Contato e Encarregado",
    content: `Para dúvidas sobre esta política ou sobre o tratamento de seus dados pessoais, entre em contato:

**E-mail:** privacidade@notificacondo.com.br

**Encarregado de Proteção de Dados (DPO):**
Nome: Equipe de Privacidade NotificaCondo
E-mail: dpo@notificacondo.com.br

**Endereço:** Disponível mediante solicitação.

Esta política pode ser atualizada periodicamente. A versão mais recente estará sempre disponível nesta página.

**Última atualização:** Janeiro de 2026`,
  },
];

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow transition-transform duration-300 group-hover:scale-105">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold text-foreground">
                Notifica<span className="text-gradient">Condo</span>
              </span>
            </Link>
            <Button asChild variant="ghost" className="gap-2 hover:bg-secondary/80">
              <Link to="/">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="pt-28 pb-20 px-4 relative z-10">
        <div className="container mx-auto max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-12 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Lock className="w-4 h-4" />
              LGPD Compliance
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4 leading-tight">
              Política de <span className="text-gradient">Privacidade</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
              Sua privacidade é importante para nós. Esta política descreve como coletamos, 
              usamos e protegemos seus dados pessoais.
            </p>
          </div>

          {/* Table of Contents */}
          <Card className="mb-8 bg-card/80 backdrop-blur-sm border-border/50 shadow-card animate-fade-up" style={{ animationDelay: "100ms" }}>
            <CardContent className="p-6">
              <h2 className="font-display font-semibold text-foreground mb-4">Índice</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {sections.map((section, index) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                  >
                    <section.icon className="w-4 h-4" />
                    {section.title}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section, index) => (
              <Card
                key={section.id}
                id={section.id}
                className={cn(
                  "bg-card/80 backdrop-blur-sm border-border/50 shadow-card overflow-hidden",
                  "animate-fade-up scroll-mt-24"
                )}
                style={{ animationDelay: `${(index + 2) * 50}ms` }}
              >
                <div className="h-1 bg-gradient-primary" />
                <CardContent className="p-6 md:p-8">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <section.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="font-display text-xl md:text-2xl font-bold text-foreground pt-2">
                      {section.title}
                    </h2>
                  </div>
                  <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed pl-0 md:pl-16">
                    {section.content.split("\n\n").map((paragraph, pIndex) => (
                      <p key={pIndex} className="mb-4 last:mb-0 whitespace-pre-line">
                        {paragraph.split("**").map((part, partIndex) =>
                          partIndex % 2 === 1 ? (
                            <strong key={partIndex} className="text-foreground font-semibold">
                              {part}
                            </strong>
                          ) : (
                            part
                          )
                        )}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 text-center animate-fade-up" style={{ animationDelay: "600ms" }}>
            <Card className="bg-gradient-primary p-8 border-0 shadow-glow">
              <h3 className="font-display text-xl font-bold text-primary-foreground mb-3">
                Tem alguma dúvida?
              </h3>
              <p className="text-primary-foreground/80 mb-6">
                Entre em contato conosco para esclarecer qualquer questão sobre privacidade.
              </p>
              <Button asChild variant="secondary" className="rounded-xl">
                <Link to="/contato">
                  <Mail className="w-4 h-4 mr-2" />
                  Fale Conosco
                </Link>
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;