import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { authService } from '../services/authService';
import { getErrorMessage } from '@/shared/utils/errors';
import { useLocale } from '@/hooks/useLocale';
import { useTranslation } from 'react-i18next';
import type { LoginForm } from '../types';

export function useLogin() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { locale } = useLocale();

  const [form, setForm] = useState<LoginForm>({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // Initialize cooldown state from localStorage on mount to persist across page refreshes
  useEffect(() => {
    const storedUntil = localStorage.getItem('login_lockout_until');
    if (storedUntil) {
      const until = parseInt(storedUntil, 10);
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldownSeconds(remaining);
      } else {
        localStorage.removeItem('login_lockout_until');
      }
    }
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      localStorage.removeItem('login_lockout_until');
      return;
    }
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          localStorage.removeItem('login_lockout_until');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const setField = (field: keyof LoginForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) return;
    setError('');
    setLoading(true);
    try {
      await authService.login(form);
      await login();
      toast({ type: 'success', message: t('auth.login.welcomeToast', 'Welcome back!') });
      navigate(`/${locale}/dashboard`);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = status === 401
        ? t('auth.login.invalidCredentials', 'Incorrect email or password.')
        : getErrorMessage(err, t('auth.login.failed', 'Could not log in. Please try again.'));
      setError(msg);
      toast({ type: 'error', message: msg });

      // Extract exponential cooldown delay from HTTP 401 or 423 responses
      if (typeof err === 'object' && err !== null) {
        const obj = err as any;
        const response = obj.response;
        if (response && response.data && typeof response.data.retryAfter === 'number') {
          const delay = response.data.retryAfter;
          setCooldownSeconds(delay);
          setError(''); // Clear stale generic error so only the active lockout Alert is shown
          
          // Persist the lockout expiration timestamp in localStorage as a visual UX assistant
          const lockoutUntil = Date.now() + delay * 1000;
          localStorage.setItem('login_lockout_until', String(lockoutUntil));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return { form, error, loading, setField, handleSubmit, cooldownSeconds };
}
