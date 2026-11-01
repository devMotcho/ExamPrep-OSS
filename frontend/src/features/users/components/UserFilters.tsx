import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Users, UserCheck, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UserFiltersProps {
  roleFilter: string;
  statusFilter: string;
  onRoleChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  totalCount: number;
  activeCount: number;
  disabledCount: number;
}

export const UserFilters: React.FC<UserFiltersProps> = ({
  roleFilter,
  statusFilter,
  onRoleChange,
  onStatusChange,
  totalCount,
  activeCount,
  disabledCount,
}) => {
  const { role: currentUserRole } = useAuth();
  const { t } = useTranslation();
  
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border mb-6">
      {/* Status Tab Pills Filter */}
      <div className="flex -mb-px overflow-x-auto pb-px">
        <button
          onClick={() => onStatusChange('ALL')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
            statusFilter === 'ALL'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" />
          <span>{t('users.filters.allUsers', 'All Users')}</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', statusFilter === 'ALL' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
            {totalCount}
          </span>
        </button>
        <button
          onClick={() => onStatusChange('ACTIVE')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
            statusFilter === 'ACTIVE'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <UserCheck className="w-4 h-4 text-emerald-500" />
          <span>{t('users.filters.active', 'Active')}</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full', statusFilter === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
            {activeCount}
          </span>
        </button>
        <button
          onClick={() => onStatusChange('INACTIVE')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap',
            statusFilter === 'INACTIVE'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <UserX className="w-4 h-4 text-danger" />
          <span>{t('users.filters.disabled', 'Disabled')}</span>
          <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-semibold', statusFilter === 'INACTIVE' ? 'bg-danger/10 text-danger' : 'bg-muted text-muted-foreground')}>
            {disabledCount}
          </span>
        </button>
      </div>

      {/* Role Selector */}
      <div className="pb-3 md:pb-0 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">{t('users.filters.filterRole', 'Filter Role:')}</span>
          <select
            className="flex h-9 rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium min-w-[140px]"
            value={roleFilter}
            onChange={(e) => onRoleChange(e.target.value)}
          >
            <option value="ALL">{t('users.filters.allRoles', 'All Roles')}</option>
            <option value="USER">{t('users.roles.user', 'User')}</option>
            <option value="ROLE_ADMIN">{t('users.roles.admin', 'Administrator')}</option>
            {currentUserRole === 'ROLE_DEV' && (
              <option value="ROLE_DEV">{t('users.roles.dev', 'Developer')}</option>
            )}
          </select>
        </div>
      </div>
    </div>
  );
};
