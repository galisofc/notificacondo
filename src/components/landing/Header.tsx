import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoImage from "@/assets/logo.png";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const goToPricing = () => {
    // If we're already on the landing page, scroll directly
    if (window.location.pathname === "/") {
      const el = document.getElementById("pricing");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        window.location.hash = "pricing";
      }
    } else {
      // Otherwise, navigate to the landing section
      navigate("/#pricing");
    }

    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src={logoImage} 
              alt="NotificaCondo" 
              className="h-12 w-auto object-contain"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#funcionalidades" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Funcionalidades
            </a>
            <a href="#fluxo" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Como Funciona
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Planos
            </a>
            <Link to="/contato" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Contato
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Button variant="hero" size="sm" onClick={() => navigate("/dashboard")}>
                Painel
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}> 
                  Entrar
                </Button>
                <Button variant="hero" size="sm" onClick={goToPricing}>
                  Começar Grátis
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <nav className="flex flex-col gap-4">
              <a href="#funcionalidades" className="text-muted-foreground hover:text-foreground transition-colors">
                Funcionalidades
              </a>
              <a href="#fluxo" className="text-muted-foreground hover:text-foreground transition-colors">
                Como Funciona
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Planos
              </a>
              <Link to="/contato" className="text-muted-foreground hover:text-foreground transition-colors">
                Contato
              </Link>
              <div className="flex flex-col gap-2 pt-4">
                {user ? (
                  <Button variant="hero" className="w-full justify-center" onClick={() => navigate("/dashboard")}>
                    Painel
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full justify-center" onClick={() => navigate("/auth")}>
                      Entrar
                    </Button>
                    <Button variant="hero" className="w-full justify-center" onClick={goToPricing}>
                      Começar Grátis
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
