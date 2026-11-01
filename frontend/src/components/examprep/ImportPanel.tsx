import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/context/ToastContext';
import { examprepApi } from '@/api/examprep';
import { Upload, Copy, Check, FileJson, Layers, ClipboardList, Eye } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AIPromptHelper } from './AIPromptHelper';
import { useTranslation } from 'react-i18next';

interface ImportPanelProps {
  studyAreaId: string;
  onImportSuccess: () => void;
}

interface ParsedQuestion {
  prompt: string;
  explanation?: string;
  chapter?: string;
  options: { text: string; correct: boolean }[];
}

export const ImportPanel: React.FC<ImportPanelProps> = ({ studyAreaId, onImportSuccess }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ParsedQuestion[]>([]);
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const handleModeChange = (mode: 'file' | 'text') => {
    setImportMode(mode);
    setFile(null);
    setPastedText('');
    setPreviewData([]);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPastedText(val);
    if (!val.trim()) {
      setPreviewData([]);
      return;
    }
    try {
      const json = JSON.parse(val);
      if (!Array.isArray(json)) {
        throw new Error('JSON must be an array of questions');
      }
      for (const q of json) {
        if (!q.prompt) throw new Error('Each question must have a prompt');
        if (!q.options || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
          throw new Error('Each question must have between 2 and 6 options');
        }
        const correctCount = q.options.filter((o: any) => o.correct === true).length;
        if (correctCount !== 1) {
          throw new Error('Each question must have exactly one correct option');
        }
      }
      setPreviewData(json);
    } catch {
      setPreviewData([]);
    }
  };

  const exampleJson = `[
  {
    "prompt": "What is the capital of France?",
    "chapter": "Geography",
    "explanation": "Paris has been the capital since...",
    "options": [
      { "text": "London", "correct": false },
      { "text": "Paris", "correct": true },
      { "text": "Berlin", "correct": false },
      { "text": "Madrid", "correct": false }
    ]
  }
]`;

  const handleCopyExample = async () => {
    try {
      await navigator.clipboard.writeText(exampleJson);
      setCopied(true);
      toast({ type: 'success', message: t('importPanel.exampleCopied', 'Example copied.') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ type: 'error', message: t('importPanel.copyFailed', 'Failed to copy text') });
    }
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.json')) {
      toast({ type: 'error', message: t('importPanel.invalidFileType', 'Please choose a .json file.') });
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!Array.isArray(json)) {
          throw new Error('JSON must be an array of questions');
        }

        // Basic validation
        for (const q of json) {
          if (!q.prompt) throw new Error('Each question must have a prompt');
          if (!q.options || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) {
            throw new Error('Each question must have between 2 and 6 options');
          }
          const correctCount = q.options.filter((o: any) => o.correct === true).length;
          if (correctCount !== 1) {
            throw new Error('Each question must have exactly one correct option');
          }
        }

        setPreviewData(json);
      } catch (err: any) {
        toast({ type: 'error', message: t('importPanel.invalidFile', 'This file does not match the format. Compare it with the example.') });
        setFile(null);
        setPreviewData([]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = async () => {
    const fileToUpload = file || (pastedText.trim() ? new File([pastedText], 'pasted-questions.json', { type: 'application/json' }) : null);
    if (!fileToUpload) return;
    setIsUploading(true);
    try {
      await examprepApi.importQuestions(studyAreaId, fileToUpload);
      toast({ type: 'success', message: t('importPanel.importedToast', 'Questions imported: {{count}}', { count: previewData.length }) });
      setFile(null);
      setPastedText('');
      setPreviewData([]);
      onImportSuccess();
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.response?.data?.message || t('importPanel.importFailed', 'Could not import the questions. Check the format.')
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Prompt Helper Card */}
      <AIPromptHelper />

      {/* Mode Toggle tabs */}
      <div className="flex justify-center gap-2 p-1 bg-muted/60 rounded-xl max-w-[320px] mx-auto">
        <Button
          type="button"
          aria-pressed={importMode === 'file'}
          variant={importMode === 'file' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('file')}
          className={`flex-1 gap-1.5 rounded-lg text-xs font-bold transition-all ${
            importMode === 'file' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          {t('importPanel.modeFile', 'File')}
        </Button>
        <Button
          type="button"
          aria-pressed={importMode === 'text'}
          variant={importMode === 'text' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('text')}
          className={`flex-1 gap-1.5 rounded-lg text-xs font-bold transition-all ${
            importMode === 'text' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          {t('importPanel.modeText', 'Paste text')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-border/60 bg-muted/20 rounded-2xl">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">{t('importPanel.templateTitle', 'Expected format')}</h4>
          <p className="text-xs text-muted-foreground">{t('importPanel.templateDesc', 'Each question has 2 to 6 options, and exactly one is correct. The AI prompt above already produces this format.')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyExample}
          className="gap-2 rounded-xl text-xs font-semibold shrink-0"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {t('importPanel.copyExample', 'Copy example')}
        </Button>
      </div>

      {importMode === 'file' ? (
        !file ? (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            className="border-2 border-dashed border-border/80 hover:border-primary/50 bg-card/45 hover:bg-primary/[0.01] transition-all cursor-pointer rounded-2xl p-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-col items-center justify-center text-center space-y-4 min-h-[200px]"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
              tabIndex={-1}
            />
            <div className="p-4 rounded-full bg-primary/10 text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold">{t('importPanel.dropTitle', 'Drag your .json file here, or click to choose')}</p>
              <p className="text-xs text-muted-foreground">{t('importPanel.dropHint', 'Only .json files')}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 p-4 border border-emerald-500/20 bg-emerald-500/5 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <FileJson className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB • {t('importPanel.readyShort', 'Ready to import')}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleModeChange('file')}
              className="text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl"
            >
              {t('importPanel.remove', 'Remove')}
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="import-json-text" className="text-xs font-bold text-foreground">{t('importPanel.pasteLabel', 'Paste the questions here')}</label>
              {pastedText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleModeChange('text')}
                  className="text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-xl h-7 px-2"
                >
                  {t('importPanel.clear', 'Clear')}
                </Button>
              )}
            </div>
            <textarea
              id="import-json-text"
              value={pastedText}
              onChange={handleTextChange}
              placeholder={`${t('importPanel.pastePlaceholder', 'Paste the result here. Example:')}\n${exampleJson}`}
              className="w-full h-48 p-4 text-xs font-mono border border-border/80 bg-card/65 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
            {pastedText && previewData.length === 0 && (
              <p className="text-[11px] text-destructive font-semibold">
                {t('importPanel.invalidText', 'This does not match the format yet. Compare it with the example and try again.')}
              </p>
            )}
            {previewData.length > 0 && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                ✓ {t('importPanel.detected', 'Questions detected: {{count}}', { count: previewData.length })}
              </p>
            )}
          </div>
        </div>
      )}

      {previewData.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-card/40 border border-emerald-500/30 rounded-2xl shadow-sm">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{t('importPanel.readyTitle', 'Ready to import')}</h4>
              <p className="text-xs text-muted-foreground">{t('importPanel.detected', 'Questions detected: {{count}}', { count: previewData.length })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreviewDialog(true)}
                className="rounded-xl border-border/60 font-bold gap-2 text-xs flex-1 sm:flex-none"
              >
                <Eye className="w-3.5 h-3.5" />
                {t('importPanel.previewBtn', 'Preview questions')}
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isUploading}
                className="bg-primary text-primary-foreground font-bold rounded-xl px-5 flex-1 sm:flex-none"
              >
                {isUploading ? t('importPanel.importing', 'Importing...') : t('importPanel.confirmImport', 'Confirm import')}
              </Button>
            </div>
          </div>
          
          <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 gap-0 bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl overflow-hidden">
              <DialogHeader className="p-6 pb-4 border-b border-border/40 shrink-0 bg-muted/20">
                <DialogTitle className="text-xl font-black">{t('importPanel.previewTitle', 'Preview')}</DialogTitle>
                <DialogDescription>
                  {t('importPanel.previewDesc', 'Review the questions before importing. Total: {{count}}', { count: previewData.length })}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {previewData.map((q, idx) => (
                  <div key={idx} className="border border-border/50 bg-card rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold text-foreground leading-snug break-words">
                        <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                        {q.prompt}
                      </h4>
                      {q.chapter && (
                        <span className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
                          <Layers className="w-2.5 h-2.5" />
                          {q.chapter}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className={`p-2 text-xs rounded-lg border ${opt.correct ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border/40 bg-muted/30 text-muted-foreground'}`}>
                          <span className="font-bold mr-2 opacity-60">{String.fromCharCode(65 + oIdx)}.</span>
                          {opt.text}
                          {opt.correct && <Check className="w-3.5 h-3.5 inline ml-1.5 opacity-80" />}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div className="pt-2 mt-2 border-t border-border/40 text-xs text-muted-foreground">
                        <span className="font-bold uppercase tracking-wider text-[11px] block mb-1">{t('examFlow.explanation', 'Explanation')}</span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};
