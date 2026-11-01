import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart2, ClipboardList, FilePlus2, PlusCircle } from 'lucide-react';
import { useConfig } from '../lib/config/useConfig';
import { useLocale } from '../hooks/useLocale';
import { PublicNavbar } from '../components/public/PublicNavbar';
import { HeroSection } from '../components/public/HeroSection';
import { PublicFooter } from '../components/public/PublicFooter';
import { LatestArticles } from '../components/blog/LatestArticles';

export const Home: React.FC = () => {
  const config = useConfig();
  const { locale } = useLocale();
  const { t } = useTranslation();

  const registerHref = `/${locale}/register`;

  const steps = [
    {
      icon: PlusCircle,
      title: t('landing.steps.step1Title', 'Pick your subject'),
      description: t('landing.steps.step1Desc', 'Create a study area, or join a public one shared by other students.'),
    },
    {
      icon: FilePlus2,
      title: t('landing.steps.step2Title', 'Add your questions'),
      description: t('landing.steps.step2Desc', 'Write them yourself or use the ones already in the area.'),
    },
    {
      icon: ClipboardList,
      title: t('landing.steps.step3Title', 'Take a practice exam'),
      description: t('landing.steps.step3Desc', 'Answer one question at a time, just like on the day.'),
    },
    {
      icon: BarChart2,
      title: t('landing.steps.step4Title', 'See what to review'),
      description: t('landing.steps.step4Desc', 'Get your 0–20 grade straight away and go through every answer.'),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative flex flex-col font-sans selection:bg-primary selection:text-primary-foreground">

      {/* Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[120px] animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent/10 blur-[120px] animate-pulse duration-[10000ms]" />
        <div className="absolute top-[40%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <PublicNavbar />

      <main className="flex-1 w-full relative z-10 overflow-x-hidden">

        {/* ── 1. Hero ── */}
        <HeroSection
          companyName={config.company_name}
          primaryHref={registerHref}
          secondaryHref={`/${locale}/login`}
        />

        {/* ── 2. How it works ── */}
        <section className="py-20 px-6 border-t border-border/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground text-center">
              {t('landing.steps.heading', 'How it works')}
            </h2>
            <ol className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <li key={step.title} className="bg-card/40 backdrop-blur border border-border/60 rounded-2xl p-6">
                  <div className="flex items-center justify-between text-primary">
                    <step.icon aria-hidden="true" className="w-6 h-6" />
                    <span aria-hidden="true" className="text-sm font-black text-muted-foreground">{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <LatestArticles />

        {/* ── 3. Final CTA: sign up ── */}
        <section className="py-20 px-6 border-t border-border/30">
          <div className="max-w-3xl mx-auto text-center bg-card/40 backdrop-blur-xl border border-border/60 rounded-3xl p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
              {t('landing.cta.heading', 'Ready for your next exam?')}
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {t('landing.cta.description', 'Create your account and take your first practice exam today.')}
            </p>
            <Link
              to={registerHref}
              className="mt-8 inline-flex items-center justify-center px-8 h-12 bg-primary text-primary-foreground rounded-full text-sm font-bold hover:scale-105 transition-transform shadow-xl shadow-primary/25"
            >
              {t('landing.cta.button', 'Create account')}
            </Link>
          </div>
        </section>

      </main>

      <div className="w-full overflow-x-hidden shrink-0">
        <PublicFooter />
      </div>
    </div>
  );
};
