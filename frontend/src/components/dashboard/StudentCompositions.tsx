import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** The student dashboard builds these parts; each composition only places them. */
export interface StudentSections {
  intro: React.ReactNode;
  areas: React.ReactNode;
  sessions: React.ReactNode;
  progress: React.ReactNode;
  calendar: React.ReactNode;
}

export type StudentTab = 'study' | 'progress' | 'history';

export const toStudentTab = (value: string | null): StudentTab =>
  value === 'progress' || value === 'history' ? value : 'study';

/** The layout for a first run, before there is any progress to split into tabs. */
export const StudentClassicDashboard: React.FC<{ sections: StudentSections }> = ({ sections }) => (
  <div className="space-y-5 sm:space-y-8">
    {sections.intro}
    <div className="grid gap-8 md:grid-cols-[1fr_320px] items-start">
      <div className="min-w-0">{sections.areas}</div>
      <div className="min-w-0">{sections.sessions}</div>
    </div>
    {sections.progress}
    {sections.calendar}
  </div>
);

interface TabbedProps {
  sections: StudentSections;
  tab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  readiness?: React.ReactNode;
}

/** What the student wants to do decides the tab. */
export const StudentTabbedDashboard: React.FC<TabbedProps> = ({ sections, tab, onTabChange, readiness }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      {sections.intro}
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as StudentTab)} className="w-full gap-4">
        <TabsList variant="line" className="w-full sm:w-full" aria-label={t('dashboardPlan.tabsLabel', 'Student dashboard sections')}>
          <TabsTrigger value="study" className="min-h-11">{t('dashboardPlan.tabStudy', 'Study')}</TabsTrigger>
          <TabsTrigger value="progress" className="min-h-11">{t('dashboardPlan.tabProgress', 'Progress')}</TabsTrigger>
          <TabsTrigger value="history" className="min-h-11">{t('dashboardPlan.tabHistory', 'History')}</TabsTrigger>
        </TabsList>
        <TabsContent value="study" className="space-y-6">
          {sections.areas}
        </TabsContent>
        <TabsContent value="progress" className="space-y-6">
          {readiness}
          {sections.progress}
        </TabsContent>
        <TabsContent value="history" className="space-y-6">
          {sections.sessions}
          {sections.calendar}
        </TabsContent>
      </Tabs>
    </div>
  );
};
