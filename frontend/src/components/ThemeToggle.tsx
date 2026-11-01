import React from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme, Theme } from '../context/ThemeContext';
import { useConfig } from '../lib/config/useConfig';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  variant?: 'icon' | 'sidebar-expanded';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'icon', className }) => {
  const { theme, setTheme } = useTheme();
  const config = useConfig();

  // If the feature is disabled by developers in settings, hide the toggle entirely
  const darkModeEnabled = config.dark_mode_enabled !== 'false';
  if (!darkModeEnabled) {
    return null;
  }

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun size={15} className="text-amber-500" /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={15} className="text-blue-400" /> },
    { value: 'system', label: 'System', icon: <Laptop size={15} className="text-purple-400" /> },
  ];

  const getActiveIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-[18px] w-[18px] text-amber-500 transition-all duration-300 rotate-0 scale-100" />;
      case 'dark':
        return <Moon className="h-[18px] w-[18px] text-blue-400 transition-all duration-300 rotate-0 scale-100" />;
      case 'system':
        return <Laptop className="h-[18px] w-[18px] text-purple-400 transition-all duration-300 rotate-0 scale-100" />;
    }
  };

  if (variant === 'sidebar-expanded') {
    return (
      <div className={cn("p-1 bg-muted/40 border border-border/50 rounded-xl flex gap-1", className)}>
        {options.map((opt) => {
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                "hover:text-foreground",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:bg-background/25"
              )}
              title={`${opt.label} mode`}
            >
              <span className="shrink-0">
                {isActive ? React.cloneElement(opt.icon as React.ReactElement, { className: 'text-primary-foreground' }) : opt.icon}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center justify-center relative h-9 w-9 rounded-xl border border-border/40 bg-card/35 backdrop-blur-md transition-all duration-300 shrink-0 cursor-pointer outline-none",
          "hover:bg-muted hover:border-primary/10 hover:scale-105 active:scale-95 text-foreground",
          className
        )}
        aria-label="Toggle theme menu"
      >
        {getActiveIcon()}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-36 bg-card/95 backdrop-blur-md border border-border shadow-lg p-1.5 rounded-xl z-[60] animate-in fade-in-50 duration-200"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors",
              theme === opt.value
                ? "bg-primary/5 text-primary font-bold focus:bg-primary/5 focus:text-primary"
                : "text-muted-foreground hover:text-foreground focus:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              {opt.icon}
              <span>{opt.label}</span>
            </div>
            {theme === opt.value && <Check size={14} className="text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
