import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/context/ToastContext';
import { authService } from '../services/authService';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage, getFieldErrors } from '@/shared/utils/errors';
import { useConfig } from '@/lib/config/useConfig';
import { useLocale } from '@/hooks/useLocale';
import type { RegisterForm, RegisterFormErrors } from '../types';

import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

function validate(data: RegisterForm, isCodeRequired: boolean, t: TFunction): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  if (!data.name.trim()) errors.name = t('auth.register.validation.nameRequired', 'Name is required.');
  if (!data.email.trim()) {
    errors.email = t('auth.register.validation.emailRequired', 'Email is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = t('auth.register.validation.invalidEmail', 'Please enter a valid email address.');
  }
  if (data.phone && !/^\+?[1-9]\d{1,14}$/.test(data.phone.trim())) {
    errors.phone = t('auth.register.validation.phoneInvalid', 'Please enter a valid phone number (e.g., +123456789).');
  }
  if (!data.password) {
    errors.password = t('auth.register.validation.passwordRequired', 'Password is required.');
  } else if (data.password.length < 8) {
    errors.password = t('auth.register.validation.passwordMinLength', 'Password must be at least 8 characters.');
  }
  if (isCodeRequired && (!data.code || !data.code.trim())) {
    errors.code = t('auth.register.validation.codeRequired', 'Verification code is required.');
  }
  return errors;
}

export function useRegister() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { login } = useAuth();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const config = useConfig();
  const isCodeRequired = config.confirmation_code_enabled === 'true';

  const [form, setForm] = useState<RegisterForm>({
    name: '', email: '', phone: '', password: '', confirmPassword: '', code: ''
  });
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [loading, setLoading] = useState(false);

  const setField = (field: keyof RegisterForm, value: string) => {
    setForm((prev) => {
      const newForm = { ...prev, [field]: value };
      const validationErrors = validate(newForm, isCodeRequired, t);
      
      setErrors((prevErrors) => ({
        ...prevErrors,
        [field]: validationErrors[field],
        general: undefined
      }));
      
      return newForm;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const validationErrors = validate(form, isCodeRequired, t);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    try {
      // The API still requires confirmPassword; the form relies on show-password instead.
      await authService.register({
        ...form,
        confirmPassword: form.password,
        phone: form.phone.trim(),
      });

      // Sign the new student in straight away. If that fails the account still
      // exists, so send them to the login page rather than showing an error.
      try {
        await authService.login({ email: form.email, password: form.password });
        await login();
        toast({ type: 'success', message: t('auth.register.welcomeToast', 'Account created. Welcome!') });
        navigate(`/${locale}/dashboard`, { replace: true });
      } catch {
        toast({ type: 'info', message: t('auth.register.createdLoginToast', 'Account created. Log in to continue.') });
        navigate(`/${locale}/login`, { replace: true });
      }
      window.scrollTo(0, 0);
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      const status = (err as { response?: { status?: number } })?.response?.status;
      const generalMessage = status === 409
        ? t('auth.register.emailExists', 'There is already an account with this email. Log in or recover your password.')
        : getErrorMessage(err, t('auth.register.failed', 'Could not create the account. Please try again.'));
      if (fieldErrors) {
        const fixMessage = t('auth.register.fixErrors', 'Please fix the errors below.');
        setErrors({ ...fieldErrors, general: fixMessage } as RegisterFormErrors);
        toast({ type: 'error', message: fixMessage });
      } else {
        setErrors({ general: generalMessage });
        toast({ type: 'error', message: generalMessage });
      }
    } finally {
      setLoading(false);
    }
  };

  return { form, errors, setErrors, loading, setField, handleSubmit };
}
