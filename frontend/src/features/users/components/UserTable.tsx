import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import type { User } from '../types';
import { Pencil, Trash2, Eye, Terminal, Shield, User as UserIcon, CheckCircle2, AlertCircle, Key } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UserTableProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onView: (user: User) => void;
  onResetPassword: (user: User) => void;
}

export const UserTable: React.FC<UserTableProps> = ({ users, loading, onEdit, onDelete, onView, onResetPassword }) => {
  const { role: currentUserRole } = useAuth();
  const { t } = useTranslation();

  const canModify = (u: User) => {
    if (u.role === 'ROLE_DEV') {
      return currentUserRole === 'ROLE_DEV';
    }
    if (u.role === 'ROLE_ADMIN') {
      return currentUserRole === 'ROLE_DEV';
    }
    return true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm font-semibold">
        {t('users.table.loading', 'Loading users…')}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/65 backdrop-blur-md shadow-md w-full">
      <div className="w-full overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm text-left border-collapse min-w-[850px] table-fixed">
          <thead className="bg-muted/40 border-b border-border/40 text-[11px] uppercase font-black tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-4 w-[20%]">{t('users.table.colName', 'Name')}</th>
              <th className="px-5 py-4 w-[25%]">{t('users.table.colEmail', 'Email')}</th>
              <th className="px-5 py-4 w-[15%]">{t('users.table.colRole', 'Role')}</th>
              <th className="px-5 py-4 w-[10%] text-center">{t('users.table.colStatus', 'Status')}</th>
              <th className="px-5 py-4 text-right w-[15%] pr-5">{t('users.table.colActions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-xs font-semibold text-muted-foreground">
                  {t('users.table.noUsers', 'No registered users found.')}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20 transition-all duration-200">
                  <td 
                    className="px-5 py-3.5 text-xs font-bold text-foreground cursor-pointer hover:underline hover:text-primary transition-colors truncate"
                    title={u.name || '-'}
                    onClick={() => onView(u)}
                  >
                    {u.name || '-'}
                  </td>
                  <td 
                    className="px-5 py-3.5 text-xs font-semibold text-muted-foreground truncate"
                    title={u.email}
                  >
                    {u.email}
                  </td>
                  <td className="px-5 py-3.5">
                    {u.role === 'ROLE_DEV' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/25 shadow-sm">
                        <Terminal size={11} strokeWidth={2.5} />
                        {t('users.roles.dev', 'Developer')}
                      </span>
                    ) : u.role === 'ROLE_ADMIN' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 shadow-sm">
                        <Shield size={11} strokeWidth={2.5} />
                        {t('users.roles.admin', 'Admin')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/25 shadow-sm">
                        <UserIcon size={11} strokeWidth={2.5} />
                        {t('users.roles.user', 'User')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {u.active ? (
                      <div 
                        title={t('users.table.active', 'Active')} 
                        className="inline-flex items-center justify-center p-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 shadow-sm transition-all"
                      >
                        <CheckCircle2 size={13} strokeWidth={2.5} />
                      </div>
                    ) : (
                      <div 
                        title={t('users.table.disabled', 'Disabled')} 
                        className="inline-flex items-center justify-center p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 shadow-sm animate-pulse transition-all"
                      >
                        <AlertCircle size={13} strokeWidth={2.5} />
                      </div>
                    )}
                  </td>
                  <td className="pl-3 pr-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      title={t('users.table.viewProfile', 'View Profile')} 
                      onClick={() => onView(u)} 
                      className="h-8 w-8 rounded-xl bg-secondary/35 hover:bg-secondary/70 text-secondary-foreground border border-secondary/20 hover:border-secondary/40 transition-all active:scale-95 shadow-sm"
                    >
                      <Eye size={13} strokeWidth={2.5} />
                    </Button>
                    {canModify(u) && (
                      <>

                        <Button 
                          variant="outline" 
                          size="icon" 
                          title={t('users.table.resetPassword', 'Reset Password')} 
                          onClick={() => onResetPassword(u)} 
                          className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/25 hover:border-blue-600/30 transition-all active:scale-95 shadow-sm"
                        >
                          <Key size={13} strokeWidth={2.5} />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          title={t('users.table.editUser', 'Edit User')} 
                          onClick={() => onEdit(u)} 
                          className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 dark:bg-amber-500/20 dark:text-amber-400 hover:bg-amber-500 hover:text-white border border-amber-500/25 hover:border-amber-600/30 transition-all active:scale-95"
                        >
                          <Pencil size={13} strokeWidth={2.5} />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          title={t('users.table.deleteUser', 'Delete User')} 
                          onClick={() => onDelete(u)} 
                          className="h-8 w-8 rounded-xl hover:bg-rose-600 hover:text-white transition-all active:scale-95 bg-rose-500/10 text-rose-600 border border-rose-500/25 hover:border-rose-600/30"
                        >
                          <Trash2 size={13} strokeWidth={2.5} />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
