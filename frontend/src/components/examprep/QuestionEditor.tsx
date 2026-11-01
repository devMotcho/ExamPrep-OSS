import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/context/ToastContext';
import { examprepApi, type Question, type Chapter } from '@/api/examprep';
import { TiptapEditor } from './TiptapEditor';
import { Trash, Plus, Save } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Req, FieldError } from '@/shared/components/FormField';
import { useTranslation } from 'react-i18next';
import { ImagePickerWidget } from '@/components/admin/ImagePickerWidget';

interface QuestionEditorProps {
  studyAreaId: string;
  editingQuestion: Question | null;
  chapters?: Chapter[];
  folder?: string;
  onSaveSuccess: () => void;
  onCancel: () => void;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  studyAreaId,
  editingQuestion,
  chapters,
  folder,
  onSaveSuccess,
  onCancel,
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const selectableChapters = chapters || [];

  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [explanation, setExplanation] = useState('');
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [options, setOptions] = useState<{ id?: string; text: string; correct: boolean }[]>([
    { text: '', correct: true },
    { text: '', correct: false },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ prompt?: string; options?: string; correct?: string }>({});

  // Populate form if editing
  useEffect(() => {
    setErrors({});
    if (editingQuestion) {
      setPrompt(editingQuestion.prompt || '');
      setImageUrl(editingQuestion.imageUrl || '');
      setExplanation(editingQuestion.explanation || '');
      setChapterId(editingQuestion.chapterId || null);
      setOptions(
        editingQuestion.options.map((o) => ({
          id: o.id,
          text: o.text,
          correct: o.id === editingQuestion.correctOptionId,
        }))
      );
    } else {
      // Clear form for new question
      setPrompt('');
      setImageUrl('');
      setExplanation('');
      setChapterId(null);
      setOptions([
        { text: '', correct: true },
        { text: '', correct: false },
      ]);
    }
  }, [editingQuestion]);

  const handleAddOption = () => {
    if (options.length >= 6) {
      toast({ type: 'error', message: t('manageQuestions.maxOptions', 'You can add a maximum of 6 options.') });
      return;
    }
    setOptions([...options, { text: '', correct: false }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast({ type: 'error', message: t('manageQuestions.minOptions', 'A question must have at least 2 options.') });
      return;
    }

    const removedOption = options[index];
    const newOptions = options.filter((_, i) => i !== index);

    // If we removed the correct option, set the first remaining option as correct
    if (removedOption.correct && newOptions.length > 0) {
      newOptions[0].correct = true;
    }

    setOptions(newOptions);
    if (errors.options || errors.correct) {
      setErrors((prev) => ({ ...prev, options: undefined, correct: undefined }));
    }
  };

  const handleOptionTextChange = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index].text = text;
    setOptions(newOptions);
    if (errors.options) {
      setErrors((prev) => ({ ...prev, options: undefined }));
    }
  };

  const handleSetCorrectOption = (index: number) => {
    const newOptions = options.map((opt, i) => ({
      ...opt,
      correct: i === index,
    }));
    setOptions(newOptions);
    if (errors.correct) {
      setErrors((prev) => ({ ...prev, correct: undefined }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    const cleanPrompt = prompt ? prompt.replace(/<[^>]*>/g, '').trim() : '';
    if (!cleanPrompt || prompt === '<p></p>' || prompt === '<p><br></p>') {
      newErrors.prompt = t('manageQuestions.promptRequired', 'Question prompt is required.');
    }

    const emptyOpts = options.filter((o) => !o.text.trim());
    if (emptyOpts.length > 0) {
      newErrors.options = t('manageQuestions.optionsRequired', 'Please fill in all options.');
    }

    const correctOpts = options.filter((o) => o.correct);
    if (correctOpts.length !== 1) {
      newErrors.correct = t('manageQuestions.correctRequired', 'Please select exactly one correct option.');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ type: 'error', message: t('manageQuestions.formErrors', 'Please correct the errors in the form.') });
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      const questionPayload = {
        prompt,
        imageUrl: imageUrl.trim() || undefined,
        explanation: explanation.trim() || undefined,
        chapterId: chapterId || undefined,
        options: options.map((o) => ({
          id: o.id,
          text: o.text.trim(),
          correct: o.correct,
        })),
      };

      if (editingQuestion?.id) {
        // Edit Mode
        await examprepApi.editQuestion(editingQuestion.id, {
          ...questionPayload,
          id: editingQuestion.id,
        });
        toast({ type: 'success', message: t('manageQuestions.questionUpdated', 'Question updated successfully!') });
      } else {
        // Create Mode
        await examprepApi.addQuestion(studyAreaId, questionPayload);
        toast({ type: 'success', message: t('manageQuestions.questionAdded', 'Question added successfully!') });
      }
      onSaveSuccess();
    } catch {
      toast({
        type: 'error',
        message: t('manageQuestions.saveFailed', 'Failed to save question. Please check details.')
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {Object.keys(errors).length > 0 && (
        <Alert variant="danger" title={t('manageQuestions.errorsTitle', 'Please correct the following errors:')}>
          <ul className="list-disc list-inside text-xs font-semibold mt-1 space-y-1 text-danger">
            {errors.prompt && <li>{errors.prompt}</li>}
            {errors.options && <li>{errors.options}</li>}
            {errors.correct && <li>{errors.correct}</li>}
          </ul>
        </Alert>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground flex items-center gap-1">
          {t('manageQuestions.questionPrompt', 'Question Prompt')} <Req />
        </Label>
        <TiptapEditor
          value={prompt}
          onChange={(val) => {
            setPrompt(val);
            if (errors.prompt) setErrors((prev) => ({ ...prev, prompt: undefined }));
          }}
          placeholder={t('manageQuestions.questionPromptPlaceholder', 'Enter your multiple-choice question prompt...')}
        />
        <FieldError msg={errors.prompt} />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
          {t('manageQuestions.imageUrl', 'Image URL')}
        </Label>
          <ImagePickerWidget
            value={imageUrl}
            onChange={setImageUrl}
            placeholder={t('manageQuestions.imageUrlPlaceholder', 'https://example.com/image.jpg')}
            folder={folder}
          />
      </div>

      {selectableChapters.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="question-chapter" className="text-sm font-bold text-foreground">{t('manageQuestions.selectChapter', 'Select Chapter')}</Label>
          <select
            id="question-chapter"
            value={chapterId || ''}
            onChange={(e) => setChapterId(e.target.value || null)}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all font-medium"
          >
            <option value="">{t('manageQuestions.noChapter', 'No Chapter (Uncategorized)')}</option>
            {selectableChapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <Label className="text-sm font-bold text-foreground flex items-center gap-1">
              {t('manageQuestions.optionsLabel', 'Options')} <Req />
            </Label>
            <span className="text-[11px] text-destructive font-semibold mt-0.5">{t('manageQuestions.optionsConstraint', '(min 2, max 6)')}</span>
          </div>
          {options.length < 6 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              className="gap-1 rounded-xl text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> {t('manageQuestions.addOption', 'Add Option')}
            </Button>
          )}
        </div>

        <FieldError msg={errors.options} />
        <FieldError msg={errors.correct} />

        <div className="space-y-3">
          {options.map((option, idx) => (
            <div key={idx} className="flex items-center gap-3 animate-in slide-in-from-top-1 duration-200">
              <input
                type="radio"
                name="correctOption"
                checked={option.correct}
                onChange={() => handleSetCorrectOption(idx)}
                className="h-4.5 w-4.5 text-primary focus:ring-primary border-border"
                id={`correct-opt-${idx}`}
                aria-label={t('manageQuestions.markCorrectAria', 'Mark option {{number}} as correct', { number: idx + 1 })}
              />
              <Input
                type="text"
                value={option.text}
                onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                placeholder={`${t('manageQuestions.optionPlaceholder', 'Option')} ${idx + 1}`}
                aria-label={`${t('manageQuestions.optionPlaceholder', 'Option')} ${idx + 1}`}
                className="flex-1 rounded-xl bg-background"
              />
              {options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveOption(idx)}
                  aria-label={t('manageQuestions.removeOptionAria', 'Remove option {{number}}', { number: idx + 1 })}
                  className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 rounded-xl"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-bold text-foreground">{t('manageQuestions.explanationLabel', 'Explanation')}</Label>
        <TiptapEditor
          value={explanation}
          onChange={setExplanation}
          placeholder={t('manageQuestions.explanationPlaceholder', 'Provide details about why the correct option is the answer...')}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="rounded-xl font-semibold"
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-primary text-primary-foreground font-semibold rounded-xl gap-2 px-5"
        >
          <Save className="h-4 w-4" />
          {isSaving ? t('manageQuestions.saving', 'Saving...') : editingQuestion ? t('manageQuestions.updateQuestion', 'Update Question') : t('manageQuestions.addQuestion', 'Add Question')}
        </Button>
      </div>
    </form>
  );
};
