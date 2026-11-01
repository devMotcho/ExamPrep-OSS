import React from 'react';
import type { User } from '../types';
import { userService } from '../services/userService';
import { useToast } from '@/context/ToastContext';
import { getErrorMessage } from '@/shared/utils/errors';
import { useTranslation } from 'react-i18next';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';

interface UserDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onDeleted: () => void;
}

export const UserDeleteDialog: React.FC<UserDeleteDialogProps> = ({
  isOpen,
  onOpenChange,
  user,
  onDeleted,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  if (!user) return null;

  const handleDelete = async () => {
    try {
      await userService.remove(user.id);
      toast({
        type: 'success',
        message: t('users.delete.successMsg', 'User deleted successfully.'),
      });
      onDeleted();
    } catch (err) {
      toast({
        type: 'error',
        message: getErrorMessage(err, t('users.delete.failedMsg', 'Failed to delete user.')),
      });
      throw err;
    }
  };

  return (
    <ConfirmDeleteDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onConfirm={handleDelete}
      title={t('admin.userDelete.title', 'Delete User')}
      description={t('admin.userDelete.description', 'Are you sure you want to permanently delete')}
      itemName={user.name || user.email}
      warning={t('admin.userDelete.warning', 'This action cannot be undone.')}
      cancelLabel={t('admin.userDelete.cancel', 'Cancel')}
      confirmLabel={t('admin.userDelete.confirm', 'Yes, delete user')}
      deletingLabel={t('admin.userDelete.deleting', 'Deleting...')}
    />
  );
};
