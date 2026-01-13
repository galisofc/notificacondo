import { Shield, Scale, BookOpen, ArrowLeft, Building2, Users, Gavel, FileText, AlertTriangle, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const CivilCode = () => {
  const sections = [
    {
      id: "disposicoes-gerais",
      icon: Building2,
      title: "Disposições Gerais",
      articles: [
        {
          number: "Art. 1.331",
          content: "Pode haver, em edificações, partes que são propriedade exclusiva, e partes que são propriedade comum dos condôminos.",
          paragraphs: [
            "§ 1º As partes suscetíveis de utilização independente, tais como apartamentos, escritórios, salas, lojas e sobrelojas, com as respectivas frações ideais no solo e nas outras partes comuns, sujeitam-se a propriedade exclusiva, podendo ser alienadas e gravadas livremente por seus proprietários, exceto os abrigos para veículos, que não poderão ser alienados ou alugados a pessoas estranhas ao condomínio, salvo autorização expressa na convenção de condomínio.",
            "§ 2º O solo, a estrutura do prédio, o telhado, a rede geral de distribuição de água, esgoto, gás e eletricidade, a calefação e refrigeração centrais, e as demais partes comuns, inclusive o acesso ao logradouro público, são utilizados em comum pelos condôminos, não podendo ser alienados separadamente, ou divididos.",
            "§ 3º A cada unidade imobiliária caberá, como parte inseparável, uma fração ideal no solo e nas outras partes comuns, que será identificada em forma decimal ou ordinária no instrumento de instituição do condomínio.",
            "§ 4º Nenhuma unidade imobiliária pode ser privada do acesso ao logradouro público.",
            "§ 5º O terraço de cobertura é parte comum, salvo disposição contrária da escritura de constituição do condomínio."
          ]
        },
        {
          number: "Art. 1.332",
          content: "Institui-se o condomínio edilício por ato entre vivos ou testamento, registrado no Cartório de Registro de Imóveis, devendo constar daquele ato, além do disposto em lei especial:",
          paragraphs: [
            "I - a discriminação e individualização das unidades de propriedade exclusiva, estremadas uma das outras e das partes comuns;",
            "II - a determinação da fração ideal atribuída a cada unidade, relativamente ao terreno e partes comuns;",
            "III - o fim a que as unidades se destinam."
          ]
        },
        {
          number: "Art. 1.333",
          content: "A convenção que constitui o condomínio edilício deve ser subscrita pelos titulares de, no mínimo, dois terços das frações ideais e torna-se, desde logo, obrigatória para os titulares de direito sobre as unidades, ou para quantos sobre elas tenham posse ou detenção.",
          paragraphs: [
            "Parágrafo único. Para ser oponível contra terceiros, a convenção do condomínio deverá ser registrada no Cartório de Registro de Imóveis."
          ]
        },
        {
          number: "Art. 1.334",
          content: "Além das cláusulas referidas no art. 1.332 e das que os interessados houverem por bem estipular, a convenção determinará:",
          paragraphs: [
            "I - a quota proporcional e o modo de pagamento das contribuições dos condôminos para atender às despesas ordinárias e extraordinárias do condomínio;",
            "II - sua forma de administração;",
            "III - a competência das assembleias, forma de sua convocação e quorum exigido para as deliberações;",
            "IV - as sanções a que estão sujeitos os condôminos, ou possuidores;",
            "V - o regimento interno.",
            "§ 1º A convenção poderá ser feita por escritura pública ou por instrumento particular.",
            "§ 2º São equiparados aos proprietários, para os fins deste artigo, salvo disposição em contrário, os promitentes compradores e os cessionários de direitos relativos às unidades autônomas."
          ]
        }
      ]
    },
    {
      id: "direitos-deveres",
      icon: Users,
      title: "Direitos e Deveres dos Condôminos",
      articles: [
        {
          number: "Art. 1.335",
          content: "São direitos do condômino:",
          paragraphs: [
            "I - usar, fruir e livremente dispor das suas unidades;",
            "II - usar das partes comuns, conforme a sua destinação, e contanto que não exclua a utilização dos demais compossuidores;",
            "III - votar nas deliberações da assembleia e delas participar, estando quite."
          ]
        },
        {
          number: "Art. 1.336",
          content: "São deveres do condômino:",
          paragraphs: [
            "I - contribuir para as despesas do condomínio na proporção das suas frações ideais, salvo disposição em contrário na convenção;",
            "II - não realizar obras que comprometam a segurança da edificação;",
            "III - não alterar a forma e a cor da fachada, das partes e esquadrias externas;",
            "IV - dar às suas partes a mesma destinação que tem a edificação, e não as utilizar de maneira prejudicial ao sossego, salubridade e segurança dos possuidores, ou aos bons costumes.",
            "§ 1º O condômino que não pagar a sua contribuição ficará sujeito aos juros moratórios convencionados ou, não sendo previstos, os de um por cento ao mês e multa de até dois por cento sobre o débito.",
            "§ 2º O condômino, que não cumprir qualquer dos deveres estabelecidos nos incisos II a IV, pagará a multa prevista no ato constitutivo ou na convenção, não podendo ela ser superior a cinco vezes o valor de suas contribuições mensais, independentemente das perdas e danos que se apurarem; não havendo disposição expressa, caberá à assembleia geral, por dois terços no mínimo dos condôminos restantes, deliberar sobre a cobrança da multa."
          ]
        },
        {
          number: "Art. 1.337",
          content: "O condômino, ou possuidor, que não cumpre reiteradamente com os seus deveres perante o condomínio poderá, por deliberação de três quartos dos condôminos restantes, ser constrangido a pagar multa correspondente até ao quíntuplo do valor atribuído à contribuição para as despesas condominiais, conforme a gravidade das faltas e a reiteração, independentemente das perdas e danos que se apurem.",
          paragraphs: [
            "Parágrafo único. O condômino ou possuidor que, por seu reiterado comportamento anti-social, gerar incompatibilidade de convivência com os demais condôminos ou possuidores, poderá ser constrangido a pagar multa correspondente ao décuplo do valor atribuído à contribuição para as despesas condominiais, até ulterior deliberação da assembleia."
          ]
        },
        {
          number: "Art. 1.338",
          content: "Resolvendo o condômino alugar área no abrigo para veículos, preferir-se-á, em condições iguais, qualquer dos condôminos a estranhos, e, entre todos, os possuidores."
        }
      ]
    },
    {
      id: "administracao",
      icon: Gavel,
      title: "Da Administração do Condomínio",
      articles: [
        {
          number: "Art. 1.347",
          content: "A assembleia escolherá um síndico, que poderá não ser condômino, para administrar o condomínio, por prazo não superior a dois anos, o qual poderá renovar-se."
        },
        {
          number: "Art. 1.348",
          content: "Compete ao síndico:",
          paragraphs: [
            "I - convocar a assembleia dos condôminos;",
            "II - representar, ativa e passivamente, o condomínio, praticando, em juízo ou fora dele, os atos necessários à defesa dos interesses comuns;",
            "III - dar imediato conhecimento à assembleia da existência de procedimento judicial ou administrativo, de interesse do condomínio;",
            "IV - cumprir e fazer cumprir a convenção, o regimento interno e as determinações da assembleia;",
            "V - diligenciar a conservação e a guarda das partes comuns e zelar pela prestação dos serviços que interessem aos possuidores;",
            "VI - elaborar o orçamento da receita e da despesa relativa a cada ano;",
            "VII - cobrar dos condôminos as suas contribuições, bem como impor e cobrar as multas devidas;",
            "VIII - prestar contas à assembleia, anualmente e quando exigidas;",
            "IX - realizar o seguro da edificação.",
            "§ 1º Poderá a assembleia investir outra pessoa, em lugar do síndico, em poderes de representação.",
            "§ 2º O síndico pode transferir a outrem, total ou parcialmente, os poderes de representação ou as funções administrativas, mediante aprovação da assembleia, salvo disposição em contrário da convenção."
          ]
        },
        {
          number: "Art. 1.349",
          content: "A assembleia, especialmente convocada para o fim estabelecido no § 2º do artigo antecedente, poderá, pelo voto da maioria absoluta de seus membros, destituir o síndico que praticar irregularidades, não prestar contas, ou não administrar convenientemente o condomínio."
        },
        {
          number: "Art. 1.350",
          content: "Convocará o síndico, anualmente, reunião da assembleia dos condôminos, na forma prevista na convenção, a fim de aprovar o orçamento das despesas, as contribuições dos condôminos e a prestação de contas, e eventualmente eleger-lhe o substituto e alterar o regimento interno.",
          paragraphs: [
            "§ 1º Se o síndico não convocar a assembleia, um quarto dos condôminos poderá fazê-lo.",
            "§ 2º Se a assembleia não se reunir, o juiz decidirá, a requerimento de qualquer condômino."
          ]
        }
      ]
    },
    {
      id: "assembleia",
      icon: FileText,
      title: "Da Assembleia",
      articles: [
        {
          number: "Art. 1.351",
          content: "Depende da aprovação de 2/3 (dois terços) dos votos dos condôminos a alteração da convenção; a mudança da destinação do edifício, ou da unidade imobiliária, depende da aprovação pela unanimidade dos condôminos."
        },
        {
          number: "Art. 1.352",
          content: "Salvo quando exigido quorum especial, as deliberações da assembleia serão tomadas, em primeira convocação, por maioria de votos dos condôminos presentes que representem pelo menos metade das frações ideais.",
          paragraphs: [
            "Parágrafo único. Os votos serão proporcionais às frações ideais no solo e nas outras partes comuns pertencentes a cada condômino, salvo disposição diversa da convenção de constituição do condomínio."
          ]
        },
        {
          number: "Art. 1.353",
          content: "Em segunda convocação, a assembleia poderá deliberar por maioria dos votos dos presentes, salvo quando exigido quorum especial."
        },
        {
          number: "Art. 1.354",
          content: "A assembleia não poderá deliberar se todos os condôminos não forem convocados para a reunião."
        },
        {
          number: "Art. 1.355",
          content: "Assembleias extraordinárias poderão ser convocadas pelo síndico ou por um quarto dos condôminos."
        },
        {
          number: "Art. 1.356",
          content: "Poderá haver no condomínio um conselho fiscal, composto de três membros, eleitos pela assembleia, por prazo não superior a dois anos, ao qual compete dar parecer sobre as contas do síndico."
        }
      ]
    },
    {
      id: "extincao",
      icon: AlertTriangle,
      title: "Da Extinção do Condomínio",
      articles: [
        {
          number: "Art. 1.357",
          content: "Se a edificação for total ou consideravelmente destruída, ou ameace ruína, os condôminos deliberarão em assembleia sobre a reconstrução, ou venda, por votos que representem metade mais uma das frações ideais.",
          paragraphs: [
            "§ 1º Deliberada a reconstrução, poderá o condômino eximir-se do pagamento das despesas respectivas, alienando os seus direitos a outros condôminos, mediante avaliação judicial.",
            "§ 2º Realizada a venda, em que se preferirá, em condições iguais de oferta, o condômino ao estranho, será repartido o apurado entre os condôminos, proporcionalmente ao valor das suas unidades imobiliárias."
          ]
        },
        {
          number: "Art. 1.358",
          content: "Se ocorrer desapropriação, a indenização será repartida na proporção a que se refere o § 2º do artigo antecedente."
        }
      ]
    },
    {
      id: "obras",
      icon: Home,
      title: "Das Obras",
      articles: [
        {
          number: "Art. 1.341",
          content: "A realização de obras no condomínio depende:",
          paragraphs: [
            "I - se voluptuárias, de voto de dois terços dos condôminos;",
            "II - se úteis, de voto da maioria dos condôminos.",
            "§ 1º As obras ou reparações necessárias podem ser realizadas, independentemente de autorização, pelo síndico, ou, em caso de omissão ou impedimento deste, por qualquer condômino.",
            "§ 2º Se as obras ou reparos necessários forem urgentes e importarem em despesas excessivas, determinada sua realização, o síndico ou o condômino que tomou a iniciativa delas dará ciência à assembleia, que deverá ser convocada imediatamente.",
            "§ 3º Não sendo urgentes, as obras ou reparos necessários, que importarem em despesas excessivas, somente poderão ser efetuadas após autorização da assembleia, especialmente convocada pelo síndico, ou, em caso de omissão ou impedimento deste, por qualquer dos condôminos.",
            "§ 4º O condômino que realizar obras ou reparos necessários será reembolsado das despesas que efetuar, não tendo direito à restituição das que fizer com obras ou reparos de outra natureza, embora de interesse comum."
          ]
        },
        {
          number: "Art. 1.342",
          content: "A realização de obras, em partes comuns, em acréscimo às já existentes, a fim de lhes facilitar ou aumentar a utilização, depende da aprovação de dois terços dos votos dos condôminos, não sendo permitidas construções, nas partes comuns, suscetíveis de prejudicar a utilização, por qualquer dos condôminos, das partes próprias, ou comuns."
        },
        {
          number: "Art. 1.343",
          content: "A construção de outro pavimento, ou, no solo comum, de outro edifício, destinado a conter novas unidades imobiliárias, depende da aprovação da unanimidade dos condôminos."
        },
        {
          number: "Art. 1.344",
          content: "Ao proprietário do terraço de cobertura incumbem as despesas da sua conservação, de modo que não haja danos às unidades imobiliárias inferiores."
        },
        {
          number: "Art. 1.345",
          content: "O adquirente de unidade responde pelos débitos do alienante, em relação ao condomínio, inclusive multas e juros moratórios."
        },
        {
          number: "Art. 1.346",
          content: "É obrigatório o seguro de toda a edificação contra o risco de incêndio ou destruição, total ou parcial."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-40 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-border/30">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center transition-transform group-hover:scale-105">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">
                Notifica<span className="text-gradient">Condo</span>
              </span>
            </Link>
            <Link 
              to="/" 
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-28 pb-20 px-4 relative z-10">
        <div className="container mx-auto max-w-4xl">
          {/* Hero */}
          <div className="text-center mb-12 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Scale className="w-4 h-4" />
              Lei nº 10.406/2002
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
              Código <span className="text-gradient">Civil</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Artigos 1.331 a 1.358 - Do Condomínio Edilício
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Disposições legais que regulamentam os condomínios no Brasil
            </p>
          </div>

          {/* Navigation */}
          <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/50 p-6 mb-10 animate-fade-up" style={{ animationDelay: "100ms" }}>
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary" />
              <h2 className="font-display font-semibold text-foreground">Índice</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    "bg-background/50 hover:bg-background border border-border/50 hover:border-primary/30",
                    "transition-all duration-200 group"
                  )}
                  style={{ animationDelay: `${(index + 2) * 50}ms` }}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <section.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {section.title}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {sections.map((section, sectionIndex) => (
              <section
                key={section.id}
                id={section.id}
                className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden animate-fade-up"
                style={{ animationDelay: `${(sectionIndex + 3) * 100}ms` }}
              >
                <div className="bg-gradient-to-r from-primary/10 to-transparent p-6 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <section.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="font-display text-xl font-bold text-foreground">
                      {section.title}
                    </h2>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {section.articles.map((article, articleIndex) => (
                    <div 
                      key={article.number}
                      className={cn(
                        "pb-6",
                        articleIndex !== section.articles.length - 1 && "border-b border-border/30"
                      )}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm font-bold whitespace-nowrap">
                          {article.number}
                        </span>
                      </div>
                      <p className="text-foreground leading-relaxed mb-3">
                        {article.content}
                      </p>
                      {article.paragraphs && (
                        <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                          {article.paragraphs.map((paragraph, pIndex) => (
                            <p 
                              key={pIndex}
                              className="text-sm text-muted-foreground leading-relaxed"
                            >
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-12 p-6 bg-card/40 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-up">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground mb-2">
                  Nota Importante
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Este conteúdo é fornecido apenas para fins informativos e educacionais. 
                  Para questões jurídicas específicas, consulte sempre um advogado especializado 
                  em direito condominial. O texto apresentado corresponde à redação atual do 
                  Código Civil Brasileiro (Lei nº 10.406/2002) com as alterações posteriores.
                </p>
              </div>
            </div>
          </div>

          {/* Back to top */}
          <div className="text-center mt-10">
            <Link 
              to="/"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CivilCode;
