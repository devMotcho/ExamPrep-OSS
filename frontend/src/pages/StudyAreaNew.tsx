import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/context/ToastContext';
import { examprepApi } from '@/api/examprep';
import { VisibilityRadioGroup } from '@/components/examprep/VisibilityRadioGroup';
import { Save, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const StudyAreaNew: React.FC = () => {
  const { locale = 'en' } = useParams<{ locale: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PRIVATE');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ type: 'error', message: t('studyAreaForm.titleRequired', 'Title is required.') });
      return;
    }

    setIsSaving(true);
    try {
      const area = await examprepApi.createStudyArea({
        title: title.trim(),
        description: description.trim(),
        visibility,
      });
      toast({ type: 'success', message: t('studyAreaForm.createdToast', 'Study area created.') });
      navigate(`/${locale}/study-areas/${area.id}`);
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.data?.message || t('studyAreaForm.createFailed', 'Could not create the study area. Please try again.')
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-2xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/${locale}/dashboard`)}
          className="gap-1.5 text-muted-foreground hover:text-foreground rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" /> {t('studyAreaForm.back', 'Back')}
        </Button>
      </div>

      <Card className="rounded-2xl border border-border/50 bg-card/65 backdrop-blur shadow-md">
        <CardHeader className="p-6 pb-4 border-b border-border/40">
          <CardTitle className="text-xl font-black text-foreground">{t('studyAreaForm.titleNew', 'Create Study Area')}</CardTitle>
          <CardDescription className="text-xs mt-1">
            {t('studyAreaForm.formDescPlain', 'Group your questions into a study area. After this you can write them or import them.')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-bold text-foreground">
                {t('studyAreaForm.areaTitle', 'Study Area Title')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                type="text"
                placeholder={t('studyAreaForm.areaTitlePlaceholder', 'e.g. CS101 Midterm Prep, Organic Chemistry')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl bg-background"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-bold text-foreground">{t('studyAreaForm.desc', 'Description')}</Label>
              <textarea
                id="description"
                placeholder={t('studyAreaForm.descPlaceholder', 'Optional context or syllabus...')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
              />
            </div>

            <VisibilityRadioGroup name="new-area-visibility" value={visibility} onChange={setVisibility} />
          </CardContent>

          <CardFooter className="p-6 pt-4 border-t border-border/40 bg-muted/10 flex justify-end gap-3 rounded-b-2xl">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/${locale}/dashboard`)}
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
              {isSaving ? t('common.loading', 'Loading...') : t('studyAreaForm.createButton', 'Create Area')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
