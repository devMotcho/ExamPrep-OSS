import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useUsers, UserFilters, UserTable, UserFormDialog, UserResetPasswordDialog, UserDeleteDialog } from '@/features/users';
import { UserDetailDialog } from '@/components/admin/UserDetailDialog';
import { Pagination } from '@/components/ui/Pagination';
import { useConfig } from '@/lib/config/useConfig';
import type { User } from '@/features/users/types';
import { useTranslation } from 'react-i18next';

export const Users: React.FC = () => {
  const { t } = useTranslation();
  const config = useConfig();
  const defaultPageSize = parseInt(config?.default_page_size || '10', 10);

  const {
    users, loading, filteredUsers,
    isModalOpen, editingUser, formData, formErrors, isSubmitting,
    openModal, closeModal, setField, handleSubmit,
    searchTerm, roleFilter, statusFilter,
    setSearchTerm, setRoleFilter, setStatusFilter,
    fetchUsers,
  } = useUsers();

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const totalCount = users.length;
  const activeCount = users.filter((u) => u.active).length;
  const disabledCount = users.filter((u) => !u.active).length;

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / defaultPageSize);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * defaultPageSize, currentPage * defaultPageSize);

  return (
    <div className="container mx-auto py-4 sm:py-8 px-0 sm:px-4 max-w-7xl space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/65 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-border/50 shadow-sm bg-gradient-to-br from-card to-primary/[0.01]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">{t('users.title', 'User Management')}</h1>
          <p className="text-muted-foreground text-sm font-medium mt-1 leading-relaxed max-w-2xl">
            {t('users.description', 'Manage platform administrators and standard users. Currently tracking')} <span className="font-bold text-primary">{totalCount} {t('users.totalUsers', 'total registered users')}</span> ({activeCount} {t('users.active', 'active')}, {disabledCount} {t('users.disabled', 'disabled')}).
          </p>
        </div>
        <UserFormDialog
          isOpen={isModalOpen}
          onOpenChange={(open) => { if (!open) closeModal(); }}
          editingUser={editingUser}
          formData={formData}
          formErrors={formErrors}
          isSubmitting={isSubmitting}
          onField={setField}
          onSubmit={handleSubmit}
          onOpenCreate={() => openModal()}
        />
      </div>

      <Card className="bg-card/65 backdrop-blur-md border border-border/50 shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-black tracking-tight">{t('users.registeredUsers', 'Registered Users')}</CardTitle>
            </div>
            
            {/* Text Search Bar */}
            <div className="w-full md:max-w-xs">
              <Input
                placeholder={t('users.searchPlaceholder', "Search users…")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <UserFilters
            roleFilter={roleFilter}
            statusFilter={statusFilter}
            onRoleChange={setRoleFilter}
            onStatusChange={setStatusFilter}
            totalCount={totalCount}
            activeCount={activeCount}
            disabledCount={disabledCount}
          />
          <UserTable
            users={paginatedUsers}
            loading={loading}
            onEdit={openModal}
            onDelete={(u) => setDeleteUser(u)}
            onView={(u) => setSelectedUser(u)}
            onResetPassword={(u) => setResetPasswordUser(u)}
          />
          <div className="mt-4">
            <Pagination 
              currentPage={currentPage} 
              totalPages={totalPages} 
              onPageChange={setCurrentPage} 
            />
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <UserDetailDialog
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          user={{
            id: selectedUser.id,
            name: selectedUser.name,
            email: selectedUser.email,
            role: selectedUser.role,
            phone: selectedUser.phone,
            isActive: selectedUser.active,
            lastLoginAt: selectedUser.lastLoginAt,
            createdAt: selectedUser.createdAt,
            updatedAt: selectedUser.updatedAt
          }}
          onEdit={() => {
            openModal(selectedUser);
          }}
          onDelete={() => {
            setDeleteUser(selectedUser);
          }}
          onResetPassword={() => {
            setResetPasswordUser(selectedUser);
          }}
        />
      )}

      <UserResetPasswordDialog
        isOpen={!!resetPasswordUser}
        onOpenChange={(open) => {
          if (!open) setResetPasswordUser(null);
        }}
        user={resetPasswordUser}
      />

      <UserDeleteDialog
        isOpen={!!deleteUser}
        onOpenChange={(open) => {
          if (!open) setDeleteUser(null);
        }}
        user={deleteUser}
        onDeleted={() => {
          setDeleteUser(null);
          setSelectedUser(null);
          fetchUsers();
        }}
      />
    </div>
  );
};
