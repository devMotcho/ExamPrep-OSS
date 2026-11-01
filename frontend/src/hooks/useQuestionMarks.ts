import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { examprepApi, type QuestionMark } from '@/api/examprep';
import { useToast } from '@/context/ToastContext';

export interface QuestionMarks {
  byQuestion: Map<string, QuestionMark>;
  toggle: (questionId: string) => Promise<void>;
  saveNote: (questionId: string, note: string) => Promise<boolean>;
  deleteNote: (questionId: string) => Promise<boolean>;
}

/** The user's marks and notes in one area. Pass nothing when logged out: it stays empty and makes no request. */
export const useQuestionMarks = (studyAreaId?: string): QuestionMarks => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [rows, setRows] = useState<QuestionMark[]>([]);

  useEffect(() => {
    if (!studyAreaId) return;
    let cancelled = false;
    examprepApi.listQuestionMarks(studyAreaId)
      .then((data) => { if (!cancelled) setRows(data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [studyAreaId]);

  const byQuestion = useMemo(() => {
    const map = new Map<string, QuestionMark>();
    rows.forEach((row) => { if (row.questionId) map.set(row.questionId, row); });
    return map;
  }, [rows]);

  const replaceRow = (questionId: string, next: QuestionMark | null) =>
    setRows((prev) => [...prev.filter((r) => r.questionId !== questionId), ...(next ? [next] : [])]);

  const fail = useCallback(() => {
    toast({ type: 'error', message: t('marks.errors.saveFailed', 'Could not save. Please try again.') });
  }, [t, toast]);

  const toggle = async (questionId: string) => {
    const current = byQuestion.get(questionId);
    try {
      if (current?.marked) {
        replaceRow(questionId, current.note ? { ...current, marked: false } : null);
        await examprepApi.unmarkQuestion(current.id);
      } else {
        replaceRow(questionId, await examprepApi.markQuestion(questionId));
      }
    } catch {
      replaceRow(questionId, current ?? null);
      fail();
    }
  };

  const saveNote = async (questionId: string, note: string) => {
    try {
      replaceRow(questionId, await examprepApi.saveQuestionNote(questionId, note));
      return true;
    } catch {
      fail();
      return false;
    }
  };

  const deleteNote = async (questionId: string) => {
    const current = byQuestion.get(questionId);
    if (!current) return true;
    try {
      await examprepApi.deleteQuestionNote(current.id);
      replaceRow(questionId, current.marked ? { ...current, note: null } : null);
      return true;
    } catch {
      fail();
      return false;
    }
  };

  return { byQuestion, toggle, saveNote, deleteNote };
};
