import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle2, Mail, KeyRound, Lock } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { authService } from '@/features/auth/services/authService';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { locale } = useLocale();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError(t('auth.forgot.emailRequired', 'Email is required'));
      return;
    }
    
    setLoading(true);
    try {
      await authService.sendCode(email);
      setStep(2);
    } catch {
      setError(t('auth.forgot.sendError', 'We could not send the code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!code) {
      setError(t('auth.forgot.codeRequired', 'Verification code is required'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth.forgot.passwordLength', 'Password must be at least 8 characters'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.forgot.passwordMismatch', 'Passwords do not match'));
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword({ email, code, newPassword });
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.message || t('auth.forgot.resetError', 'Invalid code or something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-background relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/10 blur-[120px] animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-accent/10 blur-[120px] animate-pulse duration-[10000ms]" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-8 flex flex-col items-center">
        
        {/* Elegant Centered Card */}
        <Card className="w-full border border-border/60 bg-card/60 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden">
          {step === 1 && (
            <>
              <CardHeader className="space-y-1 text-center bg-card">
                <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2 shadow-inner">
                  <KeyRound className="w-6 h-6" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">{t('auth.forgot.title', 'Reset Password')}</CardTitle>
                <CardDescription>
                  {t('auth.forgot.description', 'Enter your email address and we will send you a verification code.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleSendCode} className="space-y-4">
                  {error && <Alert variant="danger">{error}</Alert>}
                  <div className="space-y-2">
                    <Label htmlFor="email">{t('auth.forgot.emailLabel', 'Email Address')}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('common.loading', 'Loading...') : t('auth.forgot.sendCode', 'Send Code')}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader className="space-y-1 text-center bg-card">
                <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2 shadow-inner">
                  <Lock className="w-6 h-6" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">{t('auth.forgot.newPasswordTitle', 'Create New Password')}</CardTitle>
                <CardDescription>
                  {t('auth.forgot.newPasswordDesc', 'Enter the code sent to your email and your new password.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {error && <Alert variant="danger">{error}</Alert>}
                  <div className="space-y-2">
                    <Label htmlFor="code">{t('auth.forgot.codeLabel', 'Verification Code')}</Label>
                    <Input
                      id="code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="text-center tracking-[0.5em] text-xl font-bold"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">{t('auth.forgot.newPasswordLabel', 'New Password')}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('auth.forgot.confirmPasswordLabel', 'Confirm New Password')}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t('common.loading', 'Loading...') : t('auth.forgot.resetButton', 'Reset Password')}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center animate-in zoom-in duration-500 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">{t('auth.forgot.successTitle', 'Password Updated')}</h3>
                <p className="text-muted-foreground text-sm">
                  {t('auth.forgot.successDesc', 'Your password has been successfully reset. You can now login with your new password.')}
                </p>
              </div>
              <Button onClick={() => navigate(`/${locale}/login`)} className="w-full mt-4">
                {t('auth.forgot.backToLogin', 'Return to Login')}
              </Button>
            </div>
          )}

          {step !== 3 && (
            <CardFooter className="flex justify-center border-t border-border/40 pt-4 pb-4">
              <Link to={`/${locale}/login`} className="flex items-center min-h-11 text-sm text-muted-foreground hover:text-primary transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('auth.forgot.backToLogin', 'Back to Login')}
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
