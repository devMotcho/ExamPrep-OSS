import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

/** Danger asterisk for required fields */
export const Req = () => (
  <span className="text-danger ml-0.5" aria-hidden="true">*</span>
);

/** Inline field-level error message */
export const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="text-xs text-danger mt-1" role="alert">{msg}</p> : null;

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
}

/**
 * Reusable form field: Label + Input + FieldError + Req indicator.
 * Keeps form markup DRY across UserFormDialog and Register page.
 */
export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required,
  error,
  className,
  type,
  ...inputProps
}) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {required && <Req />}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={inputType}
          className={cn(error ? 'border-danger focus-visible:ring-danger' : '', isPassword ? 'pr-10' : '', className)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground focus:outline-none flex items-center justify-center transition-colors"
            aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <FieldError msg={error} />}
    </div>
  );
};
