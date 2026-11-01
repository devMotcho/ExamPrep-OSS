import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { QuestionMarks } from '@/hooks/useQuestionMarks';

const MAX_NOTE_LENGTH = 1000;

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionId: string;
  marks: QuestionMarks;
}

export const NoteDialog: React.FC<NoteDialogProps> = ({ open, onOpenChange, questionId, marks }) => {
  const { t } = useTranslation();
  const saved = marks.byQuestion.get(questionId)?.note ?? '';
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setText(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, questionId]);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const trimmed = text.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('marks.noteTitle', 'Your note')}</DialogTitle>
          <DialogDescription>
            {t('marks.noteHelp', 'Only you can see this note. Plain text only.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="question-note" className="sr-only">{t('marks.noteTitle', 'Your note')}</label>
          <textarea
            id="question-note"
            value={text}
            maxLength={MAX_NOTE_LENGTH}
            rows={5}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-background p-3 text-base sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">{text.length}/{MAX_NOTE_LENGTH}</p>
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {saved && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => marks.deleteNote(questionId))} className="min-h-11 rounded-xl gap-1.5 text-destructive">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('marks.deleteNote', 'Delete note')}
            </Button>
          )}
          <Button type="button" disabled={busy || !trimmed || trimmed === saved} onClick={() => run(() => marks.saveNote(questionId, trimmed))} className="min-h-11 rounded-xl font-bold">
            {t('marks.saveNote', 'Save note')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface MarkBarProps {
  questionId: string;
  marks: QuestionMarks;
}

/** Mark, note and the note's text, for places where the question is being read rather than answered. */
export const QuestionMarkBar: React.FC<MarkBarProps> = ({ questionId, marks }) => {
  const { t } = useTranslation();
  const [noteOpen, setNoteOpen] = useState(false);
  const row = marks.byQuestion.get(questionId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={!!row?.marked}
          onClick={() => marks.toggle(questionId)}
          className="min-h-11 rounded-xl gap-1.5 text-xs font-semibold"
        >
          <Bookmark className={`h-4 w-4 ${row?.marked ? 'fill-primary text-primary' : ''}`} aria-hidden="true" />
          {row?.marked ? t('marks.marked', 'Marked') : t('marks.mark', 'Mark')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setNoteOpen(true)} className="min-h-11 rounded-xl gap-1.5 text-xs font-semibold">
          <StickyNote className="h-4 w-4" aria-hidden="true" />
          {row?.note ? t('marks.openNote', 'Your note') : t('marks.addNote', 'Add note')}
        </Button>
      </div>
      {row?.note && (
        <p className="whitespace-pre-wrap break-words rounded-xl border border-border/50 bg-muted/30 p-3 text-xs text-foreground">{row.note}</p>
      )}
      <NoteDialog open={noteOpen} onOpenChange={setNoteOpen} questionId={questionId} marks={marks} />
    </div>
  );
};
