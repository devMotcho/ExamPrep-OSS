import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useConfig } from '@/lib/config/useConfig';
import { useLogin, OAuthButtons } from '@/features/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/hooks/useLocale';

export const Login: React.FC = () => {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const config = useConfig();
  const { form, error, loading, setField, handleSubmit, cooldownSeconds } = useLogin();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('oauth_error');
  const [showPassword, setShowPassword] = useState(false);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    
    return parts.join(' ');
  };

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
            <CardTitle className="text-2xl font-bold tracking-tight">{t('auth.login.title')}</CardTitle>
            <CardDescription>{t('auth.login.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {cooldownSeconds > 0 ? (
                <Alert variant="danger" title={t('auth.login.lockoutTitle')} icon={Lock} animateIcon>
                  {t('auth.login.lockoutWait')}{' '}
                  <span className="font-semibold text-danger px-1 bg-danger/10 rounded">
                    {formatDuration(cooldownSeconds)}
                  </span>{' '}
                  {t('auth.login.lockoutBefore')}
                </Alert>
              ) : (
                (error || oauthError) && (
                  <Alert variant="danger">
                    {oauthError === 'provider_disabled'
                      ? t('auth.login.oauthDisabled')
                      : oauthError === 'missing_attributes'
                      ? t('auth.login.oauthMissing')
                      : oauthError
                      ? t('auth.login.oauthFailed')
                      : error}
                  </Alert>
                )
              )}
              <div className="space-y-2">
                <Label htmlFor="email">
                  {t('auth.login.emailLabel')} <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
                </Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@example.com" disabled={cooldownSeconds > 0} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">
                    {t('auth.login.passwordLabel')} <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
                  </Label>
                  <Link to={`/${locale}/forgot-password`} className="inline-flex items-center min-h-11 md:min-h-0 text-sm font-medium text-primary underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t('auth.login.forgotPassword', 'Forgot password?')}
                  </Link>
                </div>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    value={form.password} 
                    onChange={(e) => setField('password', e.target.value)} 
                    disabled={cooldownSeconds > 0} 
                    required 
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || cooldownSeconds > 0}>
                {loading ? t('common.loading', 'Loading...') : cooldownSeconds > 0 ? `${t('auth.login.lockedFor')} ${formatDuration(cooldownSeconds)}` : t('auth.login.submitButton')}
              </Button>
            </form>

            {/* OAuth2 social login buttons — only renders when providers are enabled */}
            <div className="mt-4">
              <OAuthButtons context="login" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 text-center text-sm text-muted-foreground border-t border-border/40 pt-4">
            {config.register_enabled !== 'false' && (
              <p>
                {t('auth.login.noAccount')}{' '}
                <Link to={`/${locale}/register`} className="underline underline-offset-4 hover:text-primary font-medium">{t('auth.login.registerLink')}</Link>
              </p>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
