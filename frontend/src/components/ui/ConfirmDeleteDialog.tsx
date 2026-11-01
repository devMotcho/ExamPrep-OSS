import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  itemName?: string;
  warning?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  deletingLabel?: string;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  warning,
  cancelLabel,
  confirmLabel,
  deletingLabel,
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] w-[calc(100%-2rem)] !flex !flex-col !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">
        <div className="flex flex-col m-0">
          <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0 bg-gradient-to-br from-card to-rose-500/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-sm shrink-0">
                <Trash2 size={15} strokeWidth={2.5} />
              </div>
              <DialogTitle className="text-base font-black leading-tight text-foreground">
                {title || t('common.delete', 'Delete')}
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground pt-1.5 font-medium leading-relaxed">
              {description || t('common.deleteConfirm', 'Are you sure you want to permanently delete')}
              {itemName && (
                <>
                  {' '}
                  <strong className="text-foreground">{itemName}</strong>
                </>
              )}
              ? {warning || t('common.deleteWarning', 'This action cannot be undone.')}
            </p>
          </DialogHeader>

          <div className="!mx-0 !mb-0 !flex !flex-row !items-center !justify-end border-t border-border/40 !p-4 !px-6 bg-muted/20 shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 rounded-xl font-bold text-xs hover:bg-muted border border-transparent hover:border-border/30 px-4"
              disabled={isSubmitting}
            >
              {cancelLabel || t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="h-9 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white transition-all active:scale-95 px-4 shadow-sm border border-rose-600/10"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {deletingLabel || t('common.deleting', 'Deleting...')}
                </>
              ) : (
                confirmLabel || t('common.confirmDelete', 'Yes, delete')
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
