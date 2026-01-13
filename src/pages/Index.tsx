import { Helmet } from "react-helmet-async";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import Workflow from "@/components/landing/Workflow";
import TrustBadges from "@/components/landing/TrustBadges";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>NotificaCondo - Sistema de Multas e Notificações para Condomínios</title>
        <meta 
          name="description" 
          content="Plataforma SaaS para gestão de notificações, advertências e multas condominiais com prova jurídica automática, conformidade LGPD e integração WhatsApp." 
        />
        <meta name="keywords" content="notificação condomínio, multa condominial, gestão condominial, síndico, LGPD, prova jurídica" />
        <link rel="canonical" href="https://notificacondo.com.br" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <Hero />
          <Features />
          <Workflow />
          <TrustBadges />
          <Testimonials />
          <Pricing />
          <CTA />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
