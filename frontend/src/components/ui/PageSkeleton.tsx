import React from 'react';
import { Skeleton } from './skeleton';

type Variant = 'page' | 'dashboard' | 'exam' | 'result';

/** Placeholder with the rough shape of the page, so loading never shows a blank or washed-out screen. */
export const PageSkeleton: React.FC<{ variant?: Variant }> = ({ variant = 'page' }) => (
  <div role="status" aria-busy="true" className="mx-auto w-full max-w-7xl space-y-4 py-4 sm:py-8">
    {variant === 'exam' && (
      <div className="mx-auto max-w-3xl space-y-4 px-4">
        <Skeleton className="h-11 rounded-xl" />
        <Skeleton className="h-2 rounded-full" />
        <Skeleton className="h-28 rounded-2xl" />
        {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-14 rounded-xl" />)}
      </div>
    )}
    {variant === 'result' && (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>
    )}
    {variant === 'dashboard' && (
      <>
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[1, 2, 3].map((n) => <Skeleton key={n} className="h-20 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-36 rounded-2xl" />)}
        </div>
      </>
    )}
    {variant === 'page' && (
      <>
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => <Skeleton key={n} className="h-40 rounded-2xl" />)}
        </div>
      </>
    )}
  </div>
);
