import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FileText, Loader2, Plus, RotateCcw, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/context/ToastContext';
import { aiGenerationApi, type AiGenerationJob, type AiGenerationStatus, type GeneratedQuestion } from '@/api/aiGeneration';
import { FeatureGuideLink } from '@/components/blog/FeatureGuideLink';
import { getErrorMessage } from '@/shared/utils/errors';

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const POLL_INTERVAL_MS = 3000;
const textareaClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

interface ReviewQuestion extends GeneratedQuestion {
  reviewId: number;
  discarded: boolean;
}

interface AiGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyAreaId: string;
  status: AiGenerationStatus | null;
  onStatusChange: () => void;
  onSaved: () => void;
}

const errorCodeOf = (err: unknown): string | undefined =>
  (err as { response?: { data?: { code?: string } } })?.response?.data?.code;

const isQuestionValid = (q: ReviewQuestion) =>
  q.prompt.trim() !== '' &&
  q.options.length >= 2 &&
  q.options.length <= 6 &&
  q.options.every((o) => o.text.trim() !== '') &&
  q.options.filter((o) => o.correct).length === 1;

export const AiGenerationDialog: React.FC<AiGenerationDialogProps> = ({ open, onOpenChange, studyAreaId, status, onStatusChange, onSaved }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [job, setJob] = useState<AiGenerationJob | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewQuestion[]>([]);
  const [saved, setSaved] = useState<number | null>(null);
  const reviewedJobRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const translateError = useCallback(
    (code: string | undefined, fallback: string) => (code ? t(`aiGen.errors.${code}`, fallback) : fallback),
    [t],
  );

  const applyJob = useCallback((next: AiGenerationJob | null) => {
    setJob(next);
    if (next?.status === 'READY' && next.questions && reviewedJobRef.current !== next.id) {
      reviewedJobRef.current = next.id;
      setReview(next.questions.map((q, i) => ({ ...q, chapter: q.chapter ?? null, reviewId: i, discarded: false })));
    }
  }, []);

  // Resume an unfinished generation when the dialog is reopened.
  useEffect(() => {
    if (!open) return;
    let active = true;
    aiGenerationApi.getOpenJob(studyAreaId)
      .then((existing) => { if (active && existing) applyJob(existing); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [open, studyAreaId, applyJob]);

  const jobId = job?.id;
  const isRunning = job?.status === 'QUEUED' || job?.status === 'PROCESSING';

  useEffect(() => {
    if (!jobId || !isRunning || !open) return;
    const timer = window.setInterval(() => {
      aiGenerationApi.getJob(jobId)
        .then((next) => {
          applyJob(next);
          if (next.status === 'READY' || next.status === 'FAILED') onStatusChange();
        })
        .catch(() => undefined); // a failed poll is retried on the next tick
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [jobId, isRunning, open, applyJob, onStatusChange]);

  const reset = () => {
    setJob(null);
    setFile(null);
    setConsent(false);
    setFormError(null);
    setReview([]);
    setSaved(null);
    reviewedJobRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFormError(null);
    if (selected && selected.size > MAX_FILE_BYTES) {
      setFormError(translateError('AI_FILE_TOO_LARGE', 'The PDF exceeds the 32 MB limit.'));
      setFile(null);
      e.target.value = '';
      return;
    }
    setFile(selected);
  };

  const submit = async () => {
    if (!file || !consent) return;
    setUploading(true);
    setFormError(null);
    try {
      const next = job?.status === 'FAILED'
        ? await aiGenerationApi.retryJob(job.id, file)
        : await aiGenerationApi.createJob(studyAreaId, file);
      applyJob(next);
      onStatusChange();
    } catch (err) {
      setFormError(translateError(errorCodeOf(err), getErrorMessage(err, t('aiGen.uploadFailed', 'Could not send the file.'))));
    } finally {
      setUploading(false);
    }
  };

  const updateQuestion = (reviewId: number, change: (q: ReviewQuestion) => ReviewQuestion) =>
    setReview((prev) => prev.map((q) => (q.reviewId === reviewId ? change(q) : q)));

  const approved = review.filter((q) => !q.discarded);
  const canSave = approved.length > 0 && approved.every(isQuestionValid);

  const saveApproved = async () => {
    if (!job || !canSave) return;
    setSaving(true);
    setFormError(null);
    try {
      await aiGenerationApi.approve(job.id, approved.map(({ prompt, explanation, chapter, options }) => ({ prompt, explanation, chapter, options })));
      setSaved(approved.length);
      setJob(null);
      setReview([]);
      onSaved();
    } catch (err) {
      setFormError(translateError(errorCodeOf(err), getErrorMessage(err, t('aiGen.saveFailed', 'Could not save the questions.'))));
    } finally {
      setSaving(false);
    }
  };

  const discardAll = async () => {
    if (!job) return;
    if (!window.confirm(t('aiGen.discardAllConfirm', 'Discard all generated questions? This generation will still count towards your limit.'))) return;
    try {
      await aiGenerationApi.discard(job.id);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({ type: 'error', message: translateError(errorCodeOf(err), getErrorMessage(err)) });
    }
  };

  const quotaExhausted = !!status && status.quota.used >= status.quota.limit;
  const isFailed = job?.status === 'FAILED';
  const isReady = job?.status === 'READY';
  const showUpload = saved === null && !isRunning && !isReady && (!isFailed || job?.canRetry);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${isReady ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-h-[85vh] overflow-y-auto p-6`}>
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('aiGen.title', 'Generate questions from PDF')}
          </DialogTitle>
          <DialogDescription>
            {t('aiGen.description', 'AI creates 10 questions from your document. You review them before anything is saved.')}
          </DialogDescription>
          <FeatureGuideLink feature="ai-generation" />
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {saved !== null && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="font-semibold text-foreground">{t('aiGen.savedCount', '{{count}} questions added to this study area.', { count: saved })}</p>
              <Button onClick={() => { reset(); onOpenChange(false); }} className="rounded-xl">{t('common.close', 'Close')}</Button>
            </div>
          )}

          {isRunning && (
            <div className="space-y-3 py-4" role="status" aria-live="polite">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {job?.status === 'QUEUED' ? t('aiGen.queued', 'Waiting to start…') : t('aiGen.processing', 'Reading the document and creating the questions…')}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.max(job?.progress ?? 0, 5)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{t('aiGen.processingHint', 'This can take a few minutes. You can close this window and come back later.')}</p>
            </div>
          )}

          {isFailed && (
            <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
              <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{t('aiGen.failedTitle', 'The generation failed')}</p>
                <p className="text-muted-foreground">{translateError(job?.errorCode, job?.errorMessage ?? '')}</p>
                {job?.canRetry && !file && (
                  <p className="text-muted-foreground">{t('aiGen.reselectToRetry', 'The file is not kept after each attempt. Select it again to retry.')}</p>
                )}
                {!job?.canRetry && (
                  <Button variant="outline" size="sm" onClick={reset} className="mt-2 rounded-xl">{t('aiGen.startNew', 'Start a new generation')}</Button>
                )}
              </div>
            </div>
          )}

          {showUpload && (
            <div className="space-y-4">
              {status && (
                <p className={`text-xs ${quotaExhausted && !isFailed ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                  {quotaExhausted
                    ? (status.quota.nextAvailableAt
                        ? t('aiGen.quotaExhausted', 'You have used all {{limit}} PDFs. Next one available on {{date}}.', { limit: status.quota.limit, date: new Date(status.quota.nextAvailableAt).toLocaleDateString(i18n.language) })
                        : t('aiGen.quotaExhaustedNoDate', 'You have used all {{limit}} PDFs for now.', { limit: status.quota.limit }))
                    : t('aiGen.quota', 'You can generate {{remaining}} more of {{limit}} PDFs in this {{days}}-day period.', { remaining: status.quota.limit - status.quota.used, limit: status.quota.limit, days: status.quota.windowDays })}
                  {' '}{t('aiGen.quotaRule', 'Each PDF gives 10 questions for you to review. Discarding does not give the use back; a failed generation does not count.')}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="ai-gen-file" className="text-sm font-semibold">{t('aiGen.fileLabel', 'PDF file (up to 32 MB and 100 pages)')}</Label>
                <input
                  id="ai-gen-file"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={selectFile}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
                />
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
                <span className="text-foreground/90">
                  {t('aiGen.consent', 'I understand that this file is sent to {{provider}}, an external AI provider, to create the questions. It is deleted from our servers after processing. Do not upload documents with sensitive personal data or that you are not allowed to share.', { provider: status?.providerName ?? t('aiGen.externalProvider', 'the AI provider') })}
                </span>
              </label>
              <Button onClick={submit} disabled={!file || !consent || uploading || (quotaExhausted && !isFailed)} className="w-full rounded-xl font-semibold gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : isFailed ? <RotateCcw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {isFailed ? t('aiGen.retry', 'Try again') : t('aiGen.generate', 'Generate 10 questions')}
              </Button>
            </div>
          )}

          {isReady && (
            <div className="space-y-4">
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm" role="note">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
                <p className="text-foreground/90">{t('aiGen.reviewWarning', 'AI can make mistakes. Check each question against the indicated page, then edit or discard it. Only what you approve is saved.')}</p>
              </div>

              {review.map((q, index) => (
                <div key={q.reviewId} className={`space-y-3 rounded-xl border p-4 ${q.discarded ? 'border-border/40 opacity-60' : 'border-border/70'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{t('aiGen.questionNumber', 'Question {{n}}', { n: index + 1 })}</span>
                      <Badge variant="outline" className="gap-1 text-[11px]">
                        <FileText className="h-3 w-3" /> {t('aiGen.page', 'Page {{page}}', { page: q.sourcePage })}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 rounded-lg gap-1 text-xs" onClick={() => updateQuestion(q.reviewId, (c) => ({ ...c, discarded: !c.discarded }))}>
                      {q.discarded ? <><Undo2 className="h-3.5 w-3.5" /> {t('aiGen.restore', 'Restore')}</> : <><Trash2 className="h-3.5 w-3.5" /> {t('aiGen.discard', 'Discard')}</>}
                    </Button>
                  </div>

                  {!q.discarded && (
                    <>
                      <textarea
                        aria-label={t('aiGen.promptLabel', 'Question')}
                        className={textareaClass}
                        rows={2}
                        value={q.prompt}
                        onChange={(e) => updateQuestion(q.reviewId, (c) => ({ ...c, prompt: e.target.value }))}
                      />
                      <fieldset className="space-y-2">
                        <legend className="text-xs font-semibold text-muted-foreground">{t('aiGen.optionsLabel', 'Options (select the correct one)')}</legend>
                        {q.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`ai-correct-${q.reviewId}`}
                              checked={option.correct}
                              aria-label={t('aiGen.markCorrect', 'Mark as correct')}
                              className="h-4 w-4 shrink-0 accent-primary"
                              onChange={() => updateQuestion(q.reviewId, (c) => ({ ...c, options: c.options.map((o, i) => ({ ...o, correct: i === optionIndex })) }))}
                            />
                            <Input
                              value={option.text}
                              aria-label={t('aiGen.optionLabel', 'Option {{n}}', { n: optionIndex + 1 })}
                              onChange={(e) => updateQuestion(q.reviewId, (c) => ({ ...c, options: c.options.map((o, i) => (i === optionIndex ? { ...o, text: e.target.value } : o)) }))}
                            />
                            {q.options.length > 2 && (
                              <Button
                                type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                                aria-label={t('aiGen.removeOption', 'Remove option')}
                                onClick={() => updateQuestion(q.reviewId, (c) => ({ ...c, options: c.options.filter((_, i) => i !== optionIndex) }))}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {q.options.length < 6 && (
                          <Button
                            type="button" variant="ghost" size="sm" className="h-8 rounded-lg gap-1 text-xs"
                            onClick={() => updateQuestion(q.reviewId, (c) => ({ ...c, options: [...c.options, { text: '', correct: false }] }))}
                          >
                            <Plus className="h-3.5 w-3.5" /> {t('aiGen.addOption', 'Add option')}
                          </Button>
                        )}
                      </fieldset>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground">{t('aiGen.explanationLabel', 'Explanation')}</Label>
                        <textarea
                          className={textareaClass}
                          rows={3}
                          value={q.explanation ?? ''}
                          onChange={(e) => updateQuestion(q.reviewId, (c) => ({ ...c, explanation: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-muted-foreground">{t('aiGen.chapterLabel', 'Chapter (optional)')}</Label>
                        <Input value={q.chapter ?? ''} onChange={(e) => updateQuestion(q.reviewId, (c) => ({ ...c, chapter: e.target.value || null }))} />
                      </div>
                      {!isQuestionValid(q) && (
                        <p className="text-xs font-semibold text-destructive">{t('aiGen.invalidQuestion', 'Fill in the question and all options, and select one correct option.')}</p>
                      )}
                    </>
                  )}
                </div>
              ))}

              <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border/40 bg-background pt-3 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={discardAll} disabled={saving} className="rounded-xl text-xs">{t('aiGen.discardAll', 'Discard all')}</Button>
                <Button onClick={saveApproved} disabled={!canSave || saving} className="rounded-xl font-semibold gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('aiGen.saveApproved', 'Save {{count}} approved questions', { count: approved.length })}
                </Button>
              </div>
            </div>
          )}

          {formError && <p className="text-sm font-semibold text-destructive" role="alert">{formError}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
