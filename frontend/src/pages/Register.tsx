import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useConfig } from '@/lib/config/useConfig';
import { useRegister, OAuthButtons, authService } from '@/features/auth';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { FormField } from '@/shared/components/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/context/ToastContext';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useTranslation } from 'react-i18next';

export const Register: React.FC = () => {
  const config = useConfig();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { form, errors, setErrors, loading, setField, handleSubmit } = useRegister();
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const validateStep1 = () => {
    const errs: any = {};
    if (!form.name.trim()) errs.name = t('auth.register.validation.nameRequired', 'Name is required.');
    if (!form.email.trim()) {
      errs.email = t('auth.register.validation.emailRequired', 'Email is required.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = t('auth.register.validation.invalidEmail', 'Please enter a valid email address.');
    }
    if (!form.password) {
      errs.password = t('auth.register.validation.passwordRequired', 'Password is required.');
    } else if (form.password.length < 8) {
      errs.password = t('auth.register.validation.passwordMinLength', 'Password must be at least 8 characters.');
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return false;
    }
    return true;
  };

  const handleSendCode = async () => {
    if (sendingCode) return false;
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ type: 'error', message: t('auth.register.validation.emailFirst', 'Please enter a valid email address first.') });
      return false;
    }
    setSendingCode(true);
    try {
      await authService.sendCode(form.email);
      toast({ type: 'success', message: t('auth.register.codeSent', 'Verification code sent to your email.') });
      setCountdown(60);
      return true;
    } catch (err: any) {
      toast({ type: 'error', message: err.response?.data?.message || t('auth.register.codeFailed', 'Could not send the verification code.') });
      return false;
    } finally {
      setSendingCode(false);
    }
  };

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && config.confirmation_code_enabled === 'true') {
      if (sendingCode) return;
      if (!validateStep1()) return;
      const success = await handleSendCode();
      if (success) {
        setStep(2);
      }
      return;
    }
    handleSubmit(e);
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const isEnabled = config.register_enabled !== 'false';

  useEffect(() => {
    if (!isEnabled) {
      if (isAuthenticated) {
        navigate(`/${locale}/dashboard`, { replace: true });
      } else {
        navigate(`/${locale}`, { replace: true });
      }
    }
  }, [isEnabled, isAuthenticated, navigate]);

  return (
    <div className="relative min-h-[calc(100vh-72px)] flex flex-col items-center justify-center bg-background font-sans selection:bg-primary selection:text-primary-foreground py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[120px] animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent/10 blur-[120px] animate-pulse duration-[10000ms]" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-8 flex flex-col items-center">
        
        {/* Elegant Centered Card */}
        <Card className="w-full border border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">{t('auth.register.title')}</CardTitle>
            <CardDescription>
              {t('auth.register.description')}
              <span className="block mt-1">
                <span className="text-danger font-medium">*</span> {t('auth.register.requiredFields')}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onFormSubmit} noValidate className="space-y-4">
              {errors.general && (
                <div className="p-3 bg-destructive/15 text-destructive rounded-md text-sm font-medium">{errors.general}</div>
              )}
              
              {step === 1 ? (
                <div className="space-y-4">
                  <FormField id="name" label={t('auth.register.nameLabel')} required value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder={t('auth.register.namePlaceholder')} error={errors.name} />
                  <FormField id="email" label={t('auth.register.emailLabel')} required type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder={t('auth.register.emailPlaceholder')} error={errors.email} />
                  <FormField id="password" label={t('auth.register.passwordLabel')} required type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder={t('auth.register.passwordPlaceholder')} error={errors.password} />

                  <Button type="submit" className="w-full" disabled={loading || sendingCode}>
                    {sendingCode ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" />
                        {t('auth.register.sendingCode')}
                      </>
                    ) : config.confirmation_code_enabled === 'true' ? (
                      t('auth.register.proceedToVerification')
                    ) : (
                      t('auth.register.createAccount')
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-3 duration-300">
                  <div className="p-3 bg-muted/40 border border-border/50 rounded-xl space-y-1">
                    <h4 className="text-xs font-bold text-foreground">{t('auth.register.verifyEmail')}</h4>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      {t('auth.register.verifyDesc1')} <strong className="text-foreground">{form.email}</strong>{t('auth.register.verifyDesc2')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-xs font-bold text-foreground">
                      {t('auth.register.verificationCode')} <span className="text-danger">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        value={form.code || ''}
                        onChange={(e) => setField('code', e.target.value)}
                        placeholder={t('auth.register.codePlaceholder')}
                        className="h-9 rounded-xl border-border/60 text-xs font-medium bg-background/30"
                        maxLength={6}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSendCode}
                        disabled={sendingCode || countdown > 0}
                        className="h-9 rounded-xl font-bold text-xs shrink-0 px-4 border-border/60 hover:bg-muted"
                      >
                        {sendingCode ? t('auth.register.sending') : countdown > 0 ? t('auth.register.resendIn', { count: countdown }) : t('auth.register.sendCode')}
                      </Button>
                    </div>
                    {errors.code && (
                      <p className="text-[11px] text-danger font-medium">{errors.code}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('auth.register.verifying') : t('auth.register.verifyComplete')}
                  </Button>

                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setStep(1)} 
                    className="w-full h-9 text-xs rounded-xl font-medium border border-transparent hover:border-border/30"
                  >
                    {t('auth.register.goBack')}
                  </Button>
                </div>
              )}
            </form>

            {/* OAuth2 social sign-up buttons — only renders when providers are enabled */}
            {step === 1 && (
              <div className="mt-4">
                <OAuthButtons context="register" />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 text-center text-sm text-muted-foreground border-t border-border/40 pt-4">
            <p>
              {t('auth.register.alreadyHaveAccount')}{' '}
              <Link to={`/${locale}/login`} className="underline underline-offset-4 hover:text-primary font-medium">{t('auth.register.loginHere')}</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
