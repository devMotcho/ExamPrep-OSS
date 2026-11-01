import { useState, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { userService } from '../services/userService';
import { validateUserForm } from '../validation';
import { getErrorMessage, getFieldErrors } from '@/shared/utils/errors';
import type { User, UserFormData, UserFormErrors } from '../types';
import { EMPTY_FORM } from '../types';

export function useUsers() {
  const { toast } = useToast();
  const { role: currentUserRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<UserFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userService.getAll();
      const filteredData = currentUserRole === 'ROLE_DEV' ? data : data.filter((u: User) => u.role !== 'ROLE_DEV');
      setUsers(filteredData);
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err, 'Failed to load users.') });
    } finally {
      setLoading(false);
    }
  }, [toast, currentUserRole]);

  const openModal = useCallback((user?: User) => {
    setFormErrors({});
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name ?? '', email: user.email, phone: user.phone ?? '', role: user.role, active: user.active, password: '' });
    } else {
      if (editingUser !== null) {
        setEditingUser(null);
        setFormData(EMPTY_FORM);
      }
    }
    setIsModalOpen(true);
  }, [editingUser]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setFormErrors({});
  }, []);

  const setField = useCallback(<K extends keyof UserFormData>(field: K, value: UserFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field in formErrors) setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  }, [formErrors]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateUserForm(formData, !!editingUser);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setIsSubmitting(true);
    try {
      if (editingUser) {
        await userService.update(editingUser.id, formData);
        toast({ type: 'success', message: `User "${formData.name || formData.email}" updated successfully.` });
      } else {
        await userService.create(formData);
        toast({ type: 'success', message: `User "${formData.name || formData.email}" created successfully.` });
      }
      closeModal();
      setFormData(EMPTY_FORM);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors) {
        setFormErrors(fieldErrors as UserFormErrors);
        toast({ type: 'error', message: 'Please fix the errors below.' });
      } else {
        toast({ type: 'error', message: getErrorMessage(err, 'Failed to save user.') });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [editingUser, formData, toast, closeModal, fetchUsers]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await userService.remove(id);
      toast({ type: 'success', message: 'User deleted successfully.' });
      fetchUsers();
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err, 'Failed to delete user.') });
    }
  }, [toast, fetchUsers]);

  // Derived — not stored in state
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name?.toLowerCase() ?? '').includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? u.active : !u.active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  return {
    // Data
    users, loading, filteredUsers,
    // Modal
    isModalOpen, editingUser, formData, formErrors, isSubmitting,
    openModal, closeModal, setField, handleSubmit,
    // Filters
    searchTerm, roleFilter, statusFilter,
    setSearchTerm, setRoleFilter, setStatusFilter,
    // Actions
    handleDelete, fetchUsers,
  };
}
