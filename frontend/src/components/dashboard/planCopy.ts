import type { TFunction } from 'i18next';
import type { StudyPlan } from '@/api/examprep';

/** The server decides the plan and why; this only words it. */
export const planSentence = (plan: StudyPlan, t: TFunction): string => {
  const scope = plan.chapterTitle ?? plan.areaTitle ?? '';
  const what = t('plan.what', { defaultValue: '{{count}} questions of {{scope}}', count: plan.questionCount, scope });
  const days = t('plan.days', { defaultValue: '{{count}} days left', count: plan.daysLeft ?? 0 });

  if (plan.daysLeft === 0) {
    return t('plan.sentence.examToday', { defaultValue: 'Your {{area}} exam is today: a light review with {{what}}.', area: plan.areaTitle, what });
  }
  switch (plan.reason) {
    case 'WEAK':
      return t('plan.sentence.weak', { defaultValue: 'Today: {{what}}, because you have {{accuracy}}% and {{days}}.', what, accuracy: plan.accuracyPercent, days });
    case 'IMPROVE':
      return t('plan.sentence.improve', { defaultValue: 'Today: {{what}}, because you have {{accuracy}}% and can still go up, with {{days}}.', what, accuracy: plan.accuracyPercent, days });
    case 'UNTRIED':
      return t('plan.sentence.untried', { defaultValue: 'Today: {{what}}, because you have not tried this chapter and {{days}}.', what, days });
    case 'START':
      return t('plan.sentence.start', { defaultValue: 'Today: {{what}}, to get a first picture, with {{days}}.', what, days });
    case 'NO_CHAPTERS':
      return t('plan.sentence.noChapters', { defaultValue: 'Today: {{what}}, with {{days}}. The area has no chapters, so the questions are mixed.', what, days });
    default:
      return t('plan.sentence.maintain', { defaultValue: 'Today: {{what}}, to keep the pace, with {{days}}.', what, days });
  }
};
