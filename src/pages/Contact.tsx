import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, Send, CheckCircle2, Mail, Phone, MessageSquare, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  phone: z.string().trim().optional(),
  subject: z.string().trim().min(3, "Assunto deve ter pelo menos 3 caracteres").max(200, "Assunto muito longo"),
  message: z.string().trim().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000, "Mensagem muito longa"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const contactFeatures = [
  {
    icon: Mail,
    title: "Resposta Rápida",
    description: "Respondemos em até 24 horas úteis",
  },
  {
    icon: Phone,
    title: "Suporte Dedicado",
    description: "Equipe especializada à sua disposição",
  },
  {
    icon: MessageSquare,
    title: "Atendimento Personalizado",
    description: "Soluções sob medida para seu condomínio",
  },
];

const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("contact_messages").insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        subject: data.subject,
        message: data.message,
      });

      if (error) throw error;

      setIsSuccess(true);
      form.reset();
      toast.success("Mensagem enviada com sucesso!");
    } catch (error) {
      console.error("Error submitting contact form:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
        </div>

        <Card className="max-w-md w-full text-center relative z-10 animate-scale-in shadow-elevated border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-10 pb-10 px-8">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mx-auto">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse-slow">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
              </div>
              <Sparkles className="absolute top-0 right-1/4 w-5 h-5 text-amber-400 animate-float" />
            </div>
            
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
              Mensagem Enviada!
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Recebemos sua mensagem com sucesso. Nossa equipe entrará em contato em breve.
            </p>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => setIsSuccess(false)} 
                variant="outline"
                className="w-full h-12 rounded-xl hover:bg-secondary transition-all duration-300"
              >
                Enviar outra mensagem
              </Button>
              <Button asChild variant="hero" className="w-full h-12 rounded-xl">
                <Link to="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao início
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
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
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            {/* Left side - Info */}
            <div className="lg:col-span-2 space-y-8 animate-fade-up">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <MessageSquare className="w-4 h-4" />
                  Fale Conosco
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4 leading-tight">
                  Entre em <span className="text-gradient">Contato</span>
                </h1>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Tem alguma dúvida ou quer saber mais sobre o NotificaCondo? 
                  Estamos aqui para ajudar você.
                </p>
              </div>

              {/* Features */}
              <div className="space-y-4">
                {contactFeatures.map((feature, index) => (
                  <div 
                    key={feature.title}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50",
                      "transition-all duration-300 hover:bg-card hover:shadow-card hover:border-border",
                      "animate-fade-up"
                    )}
                    style={{ animationDelay: `${(index + 1) * 100}ms` }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0 shadow-glow">
                      <feature.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side - Form */}
            <div className="lg:col-span-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-elevated overflow-hidden">
                <div className="h-1.5 bg-gradient-primary" />
                <CardContent className="p-6 md:p-8">
                  <div className="mb-6">
                    <h2 className="text-xl font-display font-bold text-foreground mb-2">
                      Envie sua mensagem
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Preencha o formulário e entraremos em contato em breve.
                    </p>
                  </div>

                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-foreground font-medium">Nome *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Seu nome completo" 
                                  className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary transition-colors"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-foreground font-medium">Email *</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email" 
                                  placeholder="seu@email.com" 
                                  className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary transition-colors"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-foreground font-medium">Telefone</FormLabel>
                              <FormControl>
                                <MaskedInput 
                                  mask="phone" 
                                  value={field.value || ""} 
                                  onChange={field.onChange}
                                  className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary transition-colors"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="subject"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <FormLabel className="text-foreground font-medium">Assunto *</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Assunto da mensagem" 
                                  className="h-12 rounded-xl bg-background/50 border-border/50 focus:border-primary transition-colors"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel className="text-foreground font-medium">Mensagem *</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Escreva sua mensagem aqui..."
                                className="min-h-[140px] rounded-xl bg-background/50 border-border/50 focus:border-primary transition-colors resize-none"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        variant="hero" 
                        className="w-full h-14 rounded-xl text-base font-semibold shadow-glow transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Enviando...
                          </div>
                        ) : (
                          <>
                            <Send className="w-5 h-5 mr-2" />
                            Enviar Mensagem
                          </>
                        )}
                      </Button>

                      <p className="text-xs text-center text-muted-foreground pt-2">
                        Ao enviar, você concorda com nossa{" "}
                        <Link to="/" className="text-primary hover:underline">
                          Política de Privacidade
                        </Link>
                      </p>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;