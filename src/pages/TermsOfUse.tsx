import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Users, Shield, AlertTriangle, CreditCard, Scale, XCircle, RefreshCw, Gavel, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const sections = [
  {
    id: "aceitacao",
    icon: FileText,
    title: "1. Aceitação dos Termos",
    content: [
      "Ao acessar ou utilizar a plataforma CondoMaster, você concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não poderá acessar ou usar nossos serviços.",
      "Estes termos constituem um acordo legal entre você (usuário) e a CondoMaster. Recomendamos que leia atentamente todo o documento antes de utilizar a plataforma.",
      "Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entram em vigor imediatamente após a publicação. O uso continuado da plataforma após as alterações constitui aceitação dos novos termos."
    ]
  },
  {
    id: "servicos",
    icon: Users,
    title: "2. Descrição dos Serviços",
    content: [
      "A CondoMaster é uma plataforma de gestão condominial que oferece ferramentas para síndicos e administradores gerenciarem ocorrências, notificações, multas e comunicações com moradores.",
      "Nossos serviços incluem: registro e acompanhamento de ocorrências, envio de notificações via WhatsApp, gestão de multas e advertências, reserva de salão de festas, e geração de relatórios.",
      "Os serviços estão sujeitos a disponibilidade e podem ser modificados, suspensos ou descontinuados a qualquer momento, mediante aviso prévio quando possível."
    ]
  },
  {
    id: "cadastro",
    icon: Shield,
    title: "3. Cadastro e Conta",
    content: [
      "Para utilizar a plataforma, é necessário criar uma conta fornecendo informações verdadeiras, atualizadas e completas. Você é responsável por manter a confidencialidade de suas credenciais de acesso.",
      "Cada conta é pessoal e intransferível. Você não deve compartilhar suas credenciais com terceiros. Qualquer atividade realizada com sua conta será de sua responsabilidade.",
      "Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos, contenham informações falsas, ou sejam utilizadas para fins ilícitos."
    ]
  },
  {
    id: "uso",
    icon: AlertTriangle,
    title: "4. Uso Adequado",
    content: [
      "Você concorda em utilizar a plataforma apenas para fins legítimos e de acordo com a legislação vigente. É proibido usar a plataforma para assediar, ameaçar ou prejudicar terceiros.",
      "É vedado: tentar acessar áreas restritas sem autorização, interferir no funcionamento da plataforma, transmitir vírus ou códigos maliciosos, coletar dados de outros usuários sem consentimento.",
      "O uso indevido da plataforma pode resultar em suspensão imediata da conta, responsabilização civil e criminal, e comunicação às autoridades competentes."
    ]
  },
  {
    id: "pagamentos",
    icon: CreditCard,
    title: "5. Pagamentos e Assinaturas",
    content: [
      "Os planos de assinatura estão sujeitos aos preços e condições vigentes no momento da contratação. Os valores podem ser reajustados mediante aviso prévio de 30 dias.",
      "O pagamento é processado através de parceiros de pagamento (MercadoPago). Ao realizar o pagamento, você também concorda com os termos desses parceiros.",
      "A renovação das assinaturas é automática, salvo cancelamento prévio. O cancelamento pode ser feito a qualquer momento, com efeito ao final do período já pago."
    ]
  },
  {
    id: "propriedade",
    icon: Scale,
    title: "6. Propriedade Intelectual",
    content: [
      "Todo o conteúdo da plataforma, incluindo marca, logotipos, textos, imagens, código-fonte e design, é de propriedade exclusiva da CondoMaster ou de seus licenciadores.",
      "É proibido copiar, modificar, distribuir, vender ou explorar comercialmente qualquer conteúdo da plataforma sem autorização prévia por escrito.",
      "O uso da plataforma não transfere a você nenhum direito de propriedade intelectual sobre nossos serviços ou conteúdo."
    ]
  },
  {
    id: "responsabilidade",
    icon: XCircle,
    title: "7. Limitação de Responsabilidade",
    content: [
      "A plataforma é fornecida 'como está'. Não garantimos que o serviço será ininterrupto, livre de erros, seguro ou livre de vírus.",
      "Não nos responsabilizamos por danos indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou impossibilidade de uso da plataforma.",
      "Nossa responsabilidade total está limitada ao valor pago pelo usuário nos últimos 12 meses de assinatura."
    ]
  },
  {
    id: "privacidade",
    icon: Shield,
    title: "8. Privacidade e Dados",
    content: [
      "O tratamento de dados pessoais é regido por nossa Política de Privacidade, que faz parte integrante destes Termos de Uso.",
      "Ao utilizar a plataforma, você consente com a coleta, uso e compartilhamento de dados conforme descrito na Política de Privacidade.",
      "Implementamos medidas de segurança para proteger seus dados, mas não podemos garantir segurança absoluta na transmissão de informações pela internet."
    ]
  },
  {
    id: "rescisao",
    icon: RefreshCw,
    title: "9. Rescisão",
    content: [
      "Você pode encerrar sua conta a qualquer momento através das configurações da plataforma ou entrando em contato com nosso suporte.",
      "Reservamo-nos o direito de suspender ou encerrar sua conta imediatamente em caso de violação destes termos, sem necessidade de aviso prévio.",
      "Após o encerramento, seus dados serão tratados conforme nossa Política de Privacidade e a legislação aplicável."
    ]
  },
  {
    id: "disposicoes",
    icon: Gavel,
    title: "10. Disposições Gerais",
    content: [
      "Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.",
      "Se qualquer disposição destes termos for considerada inválida ou inexequível, as demais disposições permanecerão em pleno vigor e efeito.",
      "A falha em exercer qualquer direito previsto nestes termos não constitui renúncia a tal direito."
    ]
  }
];

export default function TermsOfUse() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-40 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-secondary/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow">
              <span className="text-primary-foreground font-bold text-sm">CM</span>
            </div>
            <span className="font-semibold text-lg">CondoMaster</span>
          </Link>
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="pt-28 pb-20 px-4 relative z-10">
        <div className="container mx-auto max-w-5xl">
          {/* Hero Section */}
          <div className="text-center mb-12 animate-fade-up">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-2xl shadow-glow mb-6">
              <FileText className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Termos de <span className="text-gradient">Uso</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Leia atentamente os termos e condições que regem o uso da plataforma CondoMaster.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Última atualização: Janeiro de 2025
            </p>
          </div>

          {/* Quick Navigation */}
          <Card className="mb-10 bg-card/60 backdrop-blur-sm border-border/50 shadow-elevated animate-fade-up" style={{ animationDelay: "100ms" }}>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Navegação Rápida
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className="text-left text-sm text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-muted/50"
                  >
                    {section.title.split(". ")[1]}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <div className="space-y-6">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.id}
                  id={section.id}
                  className={cn(
                    "bg-card/60 backdrop-blur-sm border-border/50 shadow-card overflow-hidden",
                    "transition-all duration-300 hover:shadow-elevated hover:border-border",
                    "animate-fade-up scroll-mt-24"
                  )}
                  style={{ animationDelay: `${(index + 2) * 50}ms` }}
                >
                  <CardContent className="p-6 md:p-8">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
                        <Icon className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div className="flex-1 space-y-4">
                        <h2 className="text-xl font-semibold">{section.title}</h2>
                        <div className="space-y-3">
                          {section.content.map((paragraph, pIndex) => (
                            <p key={pIndex} className="text-muted-foreground leading-relaxed">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Contact Section */}
          <Card className="mt-10 bg-gradient-primary text-primary-foreground overflow-hidden animate-fade-up" style={{ animationDelay: "600ms" }}>
            <CardContent className="p-8 text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-90" />
              <h2 className="text-2xl font-bold mb-2">Dúvidas sobre os Termos?</h2>
              <p className="opacity-90 mb-6 max-w-xl mx-auto">
                Se você tiver qualquer dúvida sobre estes Termos de Uso, entre em contato conosco.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="secondary" size="lg" asChild className="font-semibold">
                  <Link to="/contato">Fale Conosco</Link>
                </Button>
                <Button variant="outline" size="lg" asChild className="font-semibold bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  <Link to="/privacidade">Política de Privacidade</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer Links */}
          <div className="mt-10 text-center text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "700ms" }}>
            <p>
              Ao utilizar a CondoMaster, você também concorda com nossa{" "}
              <Link to="/privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
