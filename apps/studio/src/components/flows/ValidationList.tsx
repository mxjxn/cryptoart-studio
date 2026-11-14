'use client';

import { cn } from '~/lib/utils';

export function ValidationList({
  errors,
  warnings,
  className,
}: {
  errors?: string[];
  warnings?: string[];
  className?: string;
}) {
  if ((!errors || errors.length === 0) && (!warnings || warnings.length === 0)) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {errors && errors.length > 0 && (
        <ul className="rounded-md border border-error/30 bg-error-faint px-4 py-3 text-sm text-error">
          {errors.map((error) => (
            <li key={error} className="list-disc list-inside">
              {error}
            </li>
          ))}
        </ul>
      )}
      {warnings && warnings.length > 0 && (
        <ul className="rounded-md border border-warning/30 bg-warning-faint px-4 py-3 text-sm text-warning">
          {warnings.map((warning) => (
            <li key={warning} className="list-disc list-inside">
              {warning}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
