import type { UserFormData, UserFormErrors } from './types';

export function validateUserForm(data: UserFormData, isEditing: boolean): UserFormErrors {
  const errors: UserFormErrors = {};

  if (!data.name.trim()) {
    errors.name = 'Name is required.';
  }
  if (!data.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!isEditing && !data.password) {
    errors.password = 'Password is required for new users.';
  } else if (data.password && data.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return errors;
}
