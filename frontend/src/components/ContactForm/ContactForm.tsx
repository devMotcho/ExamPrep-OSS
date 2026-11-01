import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { axiosInstance } from '../../api/axiosInstance';
import { authService } from '@/features/auth';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Loader2, Mail, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { useConfig } from '../../lib/config/useConfig';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import './ContactForm.css';
 
interface ContactFormProps {
  metadata?: Record<string, string>;
}
 
export const ContactForm: React.FC<ContactFormProps> = ({ metadata }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  
  // Controlled fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');

  // Pre-fill user info if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [isAuthenticated, user]);

  // Pre-fill subject and message from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subjectParam = params.get('subject');
    const messageParam = params.get('message');
    if (subjectParam) setSubject(subjectParam);
    if (messageParam) setMessage(messageParam);
  }, []);

  // Code Sending States
  const config = useConfig();
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendCode = async () => {
    if (sendingCode) return false;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ type: 'error', message: t('contact.errors.validEmailFirst', 'Please enter a valid email address first.') });
      return false;
    }
    setSendingCode(true);
    try {
      await authService.sendCode(email);
      toast({ type: 'success', message: t('contact.success.codeSent', 'Verification code sent to your email.') });
      setCountdown(60);
      return true;
    } catch (err: any) {
      toast({ type: 'error', message: err.response?.data?.message || t('contact.errors.codeFailed', 'Failed to send verification code.') });
      return false;
    } finally {
      setSendingCode(false);
    }
  };

  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Inline Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  
  // Submission States
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t('contact.errors.nameReq', 'Name is required');
    
    if (!email.trim()) {
      newErrors.email = t('contact.errors.emailReq', 'Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('contact.errors.emailInvalid', 'Please enter a valid email address');
    }

    if (!subject.trim()) newErrors.subject = t('contact.errors.subjectReq', 'Subject is required');
    if (!message.trim()) newErrors.message = t('contact.errors.messageReq', 'Message is required');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t('contact.errors.nameReq', 'Name is required');
    
    if (!email.trim()) {
      newErrors.email = t('contact.errors.emailReq', 'Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('contact.errors.emailInvalid', 'Please enter a valid email address');
    }

    if (!subject.trim()) newErrors.subject = t('contact.errors.subjectReq', 'Subject is required');
    if (!message.trim()) newErrors.message = t('contact.errors.messageReq', 'Message is required');

    if (config.confirmation_code_enabled === 'true' && !code.trim()) {
      newErrors.code = t('contact.errors.codeReq', 'Verification code is required');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        name,
        email,
        subject,
        message,
        code,
        metadata
      };

      await axiosInstance.post('/contact', payload);
      setSubmitted(true);
      toast({ type: 'success', message: t('contact.success.msgSent', 'Message sent successfully!') });
    } catch (err: any) {
      console.error('Contact form submission error:', err);
      
      const status = err.response?.status;
      const apiMessage = err.response?.data?.message;

      let userMsg = t('contact.errors.msgFailed', 'Failed to send message. Please try again later.');
      if (status === 429) {
        userMsg = t('contact.errors.tooMany', 'Too many requests. Please wait an hour before submitting again.');
      } else if (apiMessage) {
        userMsg = apiMessage;
      }

      toast({ type: 'error', message: userMsg });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Card className="max-w-2xl mx-auto border-success/30 shadow-lg text-center p-8 animate-in fade-in-50 slide-in-from-bottom-5 duration-500">
        <CardContent className="space-y-6 pt-6">
          <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center text-success mb-2">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t('contact.form.sentTitle', 'Message Sent!')}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed max-w-md mx-auto">
              {t('contact.form.sentDesc', 'Thank you for contacting us, {{name}}. Your request has been successfully submitted. We will review it and get back to you shortly.', { name })}
            </p>
          </div>
          <Button 
            onClick={() => {
              setSubmitted(false);
              setName('');
              setEmail('');
              setSubject('');
              setMessage('');
              setCode('');
              setStep(1);
            }}
            variant="outline"
            className="mt-4"
          >
            {t('contact.form.sendAnother', 'Send Another Message')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto border border-border/80 shadow-lg contact-form-container bg-card animate-in fade-in-50 duration-500">
      <CardHeader className="border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
            <Mail size={22} />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">{t('contact.form.title', 'Send us a message')}</CardTitle>
            <p className="text-muted-foreground text-xs mt-1">{t('contact.form.subtitle', 'Have an issue, feedback, or custom request? Get in touch with our team.')}</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <form onSubmit={onFormSubmit} className="space-y-5" noValidate>
          
          {step === 1 ? (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="contact-name" className="text-xs font-semibold">{t('contact.form.nameLabel', 'Your Name')} <span className="text-danger">*</span></Label>
                  <Input
                    id="contact-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    disabled={loading || isAuthenticated}
                    placeholder="John Doe"
                    className={errors.name ? 'border-danger focus-visible:ring-danger animate-shake' : ''}
                  />
                  {errors.name && (
                    <p className="text-danger text-xs font-medium flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                      <AlertCircle size={12} /> {errors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="contact-email" className="text-xs font-semibold">{t('contact.form.emailLabel', 'Email Address')} <span className="text-danger">*</span></Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    disabled={loading || isAuthenticated}
                    placeholder="john@example.com"
                    className={errors.email ? 'border-danger focus-visible:ring-danger' : ''}
                  />
                  {errors.email && (
                    <p className="text-danger text-xs font-medium flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                      <AlertCircle size={12} /> {errors.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="contact-subject" className="text-xs font-semibold">{t('contact.form.subjectLabel', 'Subject')} <span className="text-danger">*</span></Label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    if (errors.subject) setErrors(prev => ({ ...prev, subject: '' }));
                  }}
                  disabled={loading}
                  placeholder={t('contact.form.subjectPlaceholder', 'How can we help you?')}
                  className={errors.subject ? 'border-danger focus-visible:ring-danger' : ''}
                />
                {errors.subject && (
                  <p className="text-danger text-xs font-medium flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                    <AlertCircle size={12} /> {errors.subject}
                  </p>
                )}
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="contact-message" className="text-xs font-semibold">{t('contact.form.messageLabel', 'Message')} <span className="text-danger">*</span></Label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message) setErrors(prev => ({ ...prev, message: '' }));
                  }}
                  disabled={loading}
                  placeholder={t('contact.form.messagePlaceholder', 'Tell us what you need...')}
                  rows={5}
                  className={`flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[120px] ${
                    errors.message ? 'border-danger focus-visible:ring-danger' : ''
                  }`}
                />
                {errors.message && (
                  <p className="text-danger text-xs font-medium flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                    <AlertCircle size={12} /> {errors.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                id="contact-submit-btn"
                type="submit"
                disabled={loading || sendingCode}
                className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 group transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('contact.form.processing', 'Processing...')}
                  </>
                ) : sendingCode ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('contact.form.sendingCode', 'Sending Verification Code...')}
                  </>
                ) : (
                  <>
                    <MessageSquare size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    {config.confirmation_code_enabled === 'true' ? t('contact.form.proceedVerify', 'Proceed to Verification') : t('contact.form.submitBtn', 'Send Message')}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-5 animate-in slide-in-from-right-3 duration-300">
              <div className="p-3.5 bg-muted/40 border border-border/50 rounded-xl space-y-1">
                <h3 className="text-xs font-bold text-foreground">{t('contact.form.verifyTitle', 'Verify Your Message Submission')}</h3>
                <p 
                  className="text-[11px] text-muted-foreground leading-normal" 
                  dangerouslySetInnerHTML={{ __html: t('contact.form.verifyDesc', 'We have sent a 6-digit confirmation code to <strong class="text-foreground">{{email}}</strong>. Please enter it below to complete sending your message.', { email }) }}
                />
              </div>

              <div className="space-y-2 animate-in fade-in duration-300">
                <Label htmlFor="contact-code" className="text-xs font-semibold">{t('contact.form.codeLabel', 'Verification Code')} <span className="text-danger">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="contact-code"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (errors.code) setErrors(prev => ({ ...prev, code: '' }));
                    }}
                    disabled={loading}
                    placeholder={t('contact.form.codePlaceholder', 'Enter 6-digit code')}
                    className={errors.code ? 'border-danger focus-visible:ring-danger h-9 rounded-xl border-border/60 text-xs font-medium bg-background/30' : 'h-9 rounded-xl border-border/60 text-xs font-medium bg-background/30'}
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0 || loading}
                    className="h-9 rounded-xl font-bold text-xs shrink-0 px-4 border-border/60 hover:bg-muted"
                  >
                    {sendingCode ? t('contact.form.sending', 'Sending...') : countdown > 0 ? t('contact.form.resendIn', 'Resend in {{countdown}}s', { countdown }) : t('contact.form.sendCodeBtn', 'Send Code')}
                  </Button>
                </div>
                {errors.code && (
                  <p className="text-danger text-xs font-medium flex items-center gap-1.5 mt-1 animate-in fade-in duration-200">
                    <AlertCircle size={12} /> {errors.code}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                id="contact-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 group transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('contact.form.sendingMsg', 'Sending Message...')}
                  </>
                ) : (
                  <>
                    <MessageSquare size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    {t('contact.form.verifySendBtn', 'Verify & Send Message')}
                  </>
                )}
              </Button>

              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setStep(1)} 
                className="w-full h-11 text-xs rounded-xl font-medium border border-transparent hover:border-border/30"
              >
                {t('contact.form.goBack', 'Go Back')}
              </Button>
            </div>
          )}

        </form>
      </CardContent>
    </Card>
  );
};
