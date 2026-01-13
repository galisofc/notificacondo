import { Shield } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer id="contato" className="py-16 border-t border-border/50 bg-card/30">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold text-foreground">
                Notifica<span className="text-gradient">Condo</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Plataforma SaaS para gestão de notificações, advertências e multas 
              condominiais com prova jurídica automática.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Produto</h4>
            <ul className="space-y-2">
              <li><a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a></li>
              <li><a href="#fluxo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Como Funciona</a></li>
              <li><a href="#planos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos e Preços</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Integrações</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Empresa</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sobre Nós</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Carreiras</a></li>
              <li><a href="/contato" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contato</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link to="/termos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/privacidade#direitos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">LGPD</Link></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Código Civil</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 NotificaCondo. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground max-w-xl text-center md:text-right">
            O NotificaCondo é uma plataforma de apoio à gestão condominial. As decisões 
            administrativas e jurídicas são de responsabilidade exclusiva do síndico do condomínio.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
