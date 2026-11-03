import { cn } from '~/lib/utils';

interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn('flex items-start justify-center gap-0', className)}>
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div key={label} className="flex items-start">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-xs font-medium',
                  isCompleted && 'bg-foreground text-background',
                  isCurrent && 'border-2 border-foreground text-foreground',
                  !isCompleted && !isCurrent && 'border border-border text-muted',
                )}
              >
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={cn(
                  'whitespace-nowrap text-[13px]',
                  isCurrent ? 'font-medium text-foreground' : 'text-muted',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'mt-3 mx-1 h-px w-20',
                  stepNum < currentStep ? 'bg-foreground' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
