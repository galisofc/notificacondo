import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Carlos Silva",
    role: "Síndico",
    condominium: "Residencial Vista Verde",
    location: "São Paulo, SP",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    content: "O NotificaCondo transformou a gestão do nosso condomínio. Antes, os moradores sempre alegavam não ter recebido as notificações. Agora temos prova jurídica de tudo!",
    rating: 5,
  },
  {
    name: "Maria Santos",
    role: "Síndica",
    condominium: "Edifício Aurora",
    location: "Rio de Janeiro, RJ",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    content: "A integração com WhatsApp é incrível! Os moradores recebem as notificações instantaneamente e eu tenho o registro de ciência automático. Recomendo demais!",
    rating: 5,
  },
  {
    name: "Roberto Almeida",
    role: "Síndico Profissional",
    condominium: "Condomínio Solar",
    location: "Belo Horizonte, MG",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    content: "Administro 5 condomínios e o NotificaCondo me economiza horas de trabalho por semana. O sistema de defesa e contraditório é perfeito para evitar problemas jurídicos.",
    rating: 5,
  },
  {
    name: "Ana Paula Costa",
    role: "Síndica",
    condominium: "Torres do Parque",
    location: "Curitiba, PR",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    content: "Finalmente uma solução que respeita a LGPD e ainda facilita toda a comunicação. Os 7 dias de teste foram suficientes para eu me apaixonar pela plataforma!",
    rating: 5,
  },
  {
    name: "Fernando Lima",
    role: "Síndico",
    condominium: "Residencial Monte Azul",
    location: "Porto Alegre, RS",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    content: "O suporte é excepcional e a plataforma é muito intuitiva. Reduzi em 80% as reclamações de moradores sobre notificações não recebidas.",
    rating: 5,
  },
  {
    name: "Juliana Mendes",
    role: "Administradora",
    condominium: "Edifício Central",
    location: "Brasília, DF",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
    content: "A conformidade com o Código Civil e a possibilidade de defesa pelo morador trouxe muito mais transparência para nossa gestão. Excelente ferramenta!",
    rating: 5,
  },
];

const Testimonials = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">Depoimentos</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-4 mb-6">
            O que nossos clientes{" "}
            <span className="text-gradient">dizem</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Mais de 500 condomínios já transformaram sua gestão com o NotificaCondo
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative p-6 rounded-2xl bg-gradient-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-glow group"
            >
              {/* Quote Icon */}
              <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Quote className="w-12 h-12 text-primary" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              {/* Content */}
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                />
                <div>
                  <h4 className="font-semibold text-foreground">{testimonial.name}</h4>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  <p className="text-xs text-primary">{testimonial.condominium}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50">
            <span className="font-display text-2xl font-bold text-primary">500+</span>
            <span className="text-sm text-muted-foreground">Condomínios</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50">
            <span className="font-display text-2xl font-bold text-primary">50k+</span>
            <span className="text-sm text-muted-foreground">Notificações enviadas</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50">
            <span className="font-display text-2xl font-bold text-primary">99.8%</span>
            <span className="text-sm text-muted-foreground">Taxa de entrega</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50">
            <span className="font-display text-2xl font-bold text-primary">4.9</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
