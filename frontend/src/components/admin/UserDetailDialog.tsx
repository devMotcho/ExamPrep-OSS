import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  ShieldCheck,
  Activity,
  Pencil,
  Trash2,
  Key
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DetailedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

interface UserDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: DetailedUser;
  onEdit?: () => void;
  onDelete?: () => void;
  onResetPassword?: () => void;
}

export const UserDetailDialog: React.FC<UserDetailDialogProps> = ({
  isOpen,
  onClose,
  user,
  onEdit,
  onDelete,
  onResetPassword
}) => {
  const { t } = useTranslation();
  const { role: currentUserRole } = useAuth();

  const canModify = (u: DetailedUser) => {
    const role = u.role.toUpperCase();
    if (role === 'ROLE_DEV' || role === 'DEV') {
      return currentUserRole === 'ROLE_DEV';
    }
    if (role === 'ROLE_ADMIN' || role === 'ADMIN') {
      return currentUserRole === 'ROLE_DEV';
    }
    return true;
  };

  const isModifiable = canModify(user);

  // Helper to render role badge
  const renderRoleBadge = (roleStr: string) => {
    const role = roleStr.toUpperCase();
    if (role === 'DEV' || role === 'ROLE_DEV') {
      return (
        <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/25 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider">
          Developer
        </Badge>
      );
    }
    if (role === 'ADMIN' || role === 'ROLE_ADMIN') {
      return (
        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/25 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider">
          Admin
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider">
        {roleStr.replace('ROLE_', '')}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] w-[calc(100%-2rem)] !flex !flex-col max-h-[85vh] !gap-0 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-0 overflow-hidden z-[70] animate-in zoom-in-95 duration-200">

        <DialogHeader className="p-6 pb-4 border-b border-border/40 space-y-1.5 shrink-0 bg-gradient-to-br from-card to-primary/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-secondary/20 dark:text-secondary flex items-center justify-center border border-secondary/20 shadow-sm shrink-0">
              <User size={15} strokeWidth={2.5} />
            </div>
            <DialogTitle className="text-base font-black leading-tight text-foreground flex items-center gap-2">
              {user.name || 'Anonymous User'}
            </DialogTitle>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
            <div className="flex items-center gap-2">
              {user.isActive !== false ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25">
                  {t('admin.userDetail.active', 'Active')}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-sm bg-rose-500/10 text-rose-600 border-rose-500/25 animate-pulse">
                  {t('admin.userDetail.disabled', 'Disabled')}
                </span>
              )}
              {renderRoleBadge(user.role)}
            </div>

            <span className="text-[11px] bg-muted/60 border text-muted-foreground px-2 py-0.5 rounded-md flex items-center gap-1 select-none font-semibold">
              <ShieldCheck size={11} className="text-primary/80" />
              Verified Account
            </span>
          </div>
        </DialogHeader>

        {/* Scrollable Center Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Main User Metadata Card */}
          <div className="bg-muted/40 p-4 rounded-xl border border-border/30 space-y-3.5 text-xs font-semibold select-text">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.userDetail.name', 'Full Name')}</span>
                <span className="text-foreground flex items-center gap-1.5 font-bold">
                  {user.name || 'N/A'}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.userDetail.email', 'Email Address')}</span>
                <a href={`mailto:${user.email}`} className="text-primary hover:underline flex items-center gap-1.5 font-bold break-all flex-wrap">
                  <Mail size={12} />
                  {user.email}
                </a>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.userDetail.phone', 'Phone Number')}</span>
                {user.phone ? (
                  <a href={`tel:${user.phone}`} className="text-primary hover:underline flex items-center gap-1.5 font-bold">
                    <Phone size={12} />
                    {user.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1.5 font-bold">
                    {t('admin.userDetail.notProvided', 'Not Provided')}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.userDetail.lastLogin', 'Last Connection')}</span>
                <span className="text-foreground flex items-center gap-1.5 font-bold">
                  <Clock size={12} className="text-primary/70" />
                  {user.lastLoginAt ? (
                    new Date(user.lastLoginAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  ) : (
                    t('admin.userDetail.never', 'Never connected')
                  )}
                </span>
              </div>



            </div>

            <div className="pt-3.5 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">{t('admin.userDetail.createdAt', 'Created At')}</span>
                <span className="text-foreground flex items-center gap-1.5 font-bold">
                  <Calendar size={12} className="text-primary/70" />
                  {new Date(user.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-muted-foreground font-bold text-[11px] uppercase tracking-wider block">Last Updated</span>
                <span className="text-foreground flex items-center gap-1.5 font-bold">
                  <Activity size={12} className="text-primary/70" />
                  {user.updatedAt ? (
                    new Date(user.updatedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  ) : (
                    'N/A'
                  )}
                </span>
              </div>
            </div>

          </div>

          {/* Account Unique ID details */}
          <div className="space-y-1 select-text">
            <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider block">System Account Reference</span>
            <div className="bg-muted/30 p-2 px-3 rounded-lg border border-border/20 font-mono text-[11px] text-muted-foreground flex justify-between items-center">
              <span>ID: <strong className="text-foreground/80">{user.id}</strong></span>
            </div>
          </div>

        </div>

        {/* Modal Footer with Actions */}
        {isModifiable && (onEdit || onDelete || onResetPassword) && (
          <div className="p-4 pr-6 border-t border-border/40 bg-muted/10 shrink-0 flex items-center justify-end gap-3 w-full">
            {onResetPassword && (
              <Button
                variant="outline"
                size="icon"
                title={t('users.table.resetPassword', 'Reset Password')}
                onClick={onResetPassword}
                className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/25 hover:border-blue-600/30 transition-all active:scale-95 shadow-sm"
              >
                <Key size={13} strokeWidth={2.5} />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="icon"
                title={t('users.table.editUser', 'Edit User')}
                onClick={onEdit}
                className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/25 hover:border-amber-600/30 transition-all active:scale-95 shadow-sm"
              >
                <Pencil size={13} strokeWidth={2.5} />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="icon"
                title={t('users.table.deleteUser', 'Delete User')}
                onClick={onDelete}
                className="h-8 w-8 rounded-xl hover:bg-rose-600 hover:text-white transition-all active:scale-95 bg-rose-500/10 text-rose-600 border border-rose-500/25 hover:border-rose-600/30 shadow-sm"
              >
                <Trash2 size={13} strokeWidth={2.5} />
              </Button>
            )}
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};
