import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, LucideIcon } from 'lucide-react';

export type AlertVariant = 'success' | 'warning' | 'info' | 'danger';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: LucideIcon;
  animateIcon?: boolean;
}

const defaultIcons: Record<AlertVariant, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  danger: AlertCircle,
};

const variantStyles: Record<AlertVariant, {
  container: string;
  iconContainer: string;
  iconColor: string;
}> = {
  success: {
    container: 'border-success/20 bg-success/10 text-success shadow-lg shadow-success/5',
    iconContainer: 'bg-success/20 text-success',
    iconColor: 'text-success',
  },
  warning: {
    container: 'border-warning/20 bg-warning/10 text-warning shadow-lg shadow-warning/5',
    iconContainer: 'bg-warning/20 text-warning',
    iconColor: 'text-warning',
  },
  info: {
    container: 'border-info/20 bg-info/10 text-info shadow-lg shadow-info/5',
    iconContainer: 'bg-info/20 text-info',
    iconColor: 'text-info',
  },
  danger: {
    container: 'border-danger/20 bg-danger/10 text-danger shadow-lg shadow-danger/5',
    iconContainer: 'bg-danger/20 text-danger',
    iconColor: 'text-danger',
  },
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, icon, animateIcon = false, children, ...props }, ref) => {
    const IconComponent = icon || defaultIcons[variant];
    const styles = variantStyles[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative overflow-hidden p-4 rounded-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-2",
          styles.container,
          className
        )}
        {...props}
      >
        {/* Subtle glowing radial background element */}
        <div className={cn("absolute inset-0 pointer-events-none opacity-40 bg-gradient-to-r to-transparent", {
          "from-success/5": variant === 'success',
          "from-warning/5": variant === 'warning',
          "from-info/5": variant === 'info',
          "from-danger/5": variant === 'danger',
        })} />

        <div className="flex gap-3 relative z-10">
          <div className="flex-shrink-0 mt-0.5">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              styles.iconContainer,
              animateIcon && "animate-pulse"
            )}>
              <IconComponent className="w-4 h-4" />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {title && (
              <p className="font-bold text-sm text-foreground tracking-tight flex items-center gap-1.5">
                {title}
              </p>
            )}
            <div className="text-xs text-muted-foreground leading-normal font-medium">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

Alert.displayName = "Alert";
