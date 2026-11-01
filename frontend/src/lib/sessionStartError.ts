import type { TFunction } from 'i18next';
import { examprepApi } from '@/api/examprep';

interface Options {
  err: any;
  studyAreaId: string;
  locale: string;
  t: TFunction;
  toast: (toast: { type: 'success' | 'error'; message: string }) => void;
  navigate: (path: string) => void;
}

// Shared handling for a session that could not start: exam already running, or anything else.
export const handleSessionStartError = async ({ err, studyAreaId, locale, t, toast, navigate }: Options) => {
  const status = err?.response?.status;

  if (status === 409) {
    const sessions = await examprepApi.listMySessions().catch(() => []);
    const active = sessions.find((s) => s.studyAreaId === studyAreaId && !s.completedAt);
    toast({ type: 'error', message: t('retention.errors.activeExam', 'You already have an exam in progress in this area. Finish it first.') });
    if (active) navigate(`/${locale}/exam/${active.id}`);
    return;
  }

  toast({ type: 'error', message: t('retention.errors.startFailed', 'Could not start the session. Please try again.') });
};
