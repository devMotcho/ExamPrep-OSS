import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface HeroSectionProps {
  companyName: string;
  primaryHref: string;
  secondaryHref: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ companyName, primaryHref, secondaryHref }) => {
  const { t } = useTranslation();

  return (
    <div className="relative overflow-hidden w-full">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] rounded-full bg-accent/8 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-24 lg:py-32 w-full text-center">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-widest mb-6">
          {t('landing.hero.badge', 'Free and open source')}
        </span>

        <h1 className="text-[clamp(1.75rem,8.2vw,3rem)] lg:text-6xl font-black tracking-tight text-foreground mb-6 leading-[1.1] [overflow-wrap:anywhere]">
          {t('landing.hero.title', 'Practise for your exams with')}{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            {companyName}
          </span>
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl mx-auto">
          {t('landing.hero.description', 'Create or join a study area, answer multiple-choice questions and find out straight away what you still need to review.')}
        </p>

        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-8 text-xs font-semibold text-muted-foreground">
          {[
            t('landing.hero.trustGrade', 'Instant 0–20 grade'),
            t('landing.hero.trustTimer', 'Exam timer and penalties'),
            t('landing.hero.trustChapters', 'Practice by chapter'),
          ].map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={primaryHref}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-foreground text-background text-center font-bold text-sm hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300"
          >
            {t('landing.hero.primaryCta', 'Get started')}
          </Link>
          <Link
            to={secondaryHref}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-card/40 backdrop-blur-md border border-border text-foreground text-center font-bold text-sm hover:bg-muted/50 transition-all duration-300 shadow-sm"
          >
            {t('landing.hero.secondaryCta', 'Sign in')}
          </Link>
        </div>
      </div>
    </div>
  );
};
