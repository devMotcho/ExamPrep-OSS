import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Globe } from 'lucide-react';

type Visibility = 'PUBLIC' | 'PRIVATE';

interface VisibilityRadioGroupProps {
  name: string;
  value: Visibility;
  onChange: (value: Visibility) => void;
}

export const VisibilityRadioGroup: React.FC<VisibilityRadioGroupProps> = ({ name, value, onChange }) => {
  const { t } = useTranslation();

  const options: { value: Visibility; icon: React.ReactNode; label: string; description: string }[] = [
    {
      value: 'PRIVATE',
      icon: <Lock className="h-3.5 w-3.5 shrink-0" />,
      label: t('studyAreaForm.private', 'Private'),
      description: t('studyAreaForm.privateDesc', 'Only you can see it. You can make it public later.'),
    },
    {
      value: 'PUBLIC',
      icon: <Globe className="h-3.5 w-3.5 shrink-0" />,
      label: t('studyAreaForm.public', 'Public'),
      description: t('studyAreaForm.publicDesc', 'Anyone can see it, practise with it and find it in the public library.'),
    },
  ];

  return (
    <fieldset>
      <legend className="text-sm font-bold text-foreground mb-2">{t('studyAreaForm.visibility', 'Visibility')}</legend>
      <div className="grid sm:grid-cols-2 gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={`border rounded-xl p-3.5 flex items-start gap-2.5 cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
              value === option.value
                ? 'bg-primary/5 border-primary/50'
                : 'border-border/60 bg-background hover:border-primary/40 hover:bg-muted/10'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary focus-visible:outline-none"
            />
            <span className="flex flex-col gap-1 min-w-0">
              <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                {option.icon}
                {option.label}
              </span>
              <span className="text-xs text-muted-foreground leading-normal">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};
