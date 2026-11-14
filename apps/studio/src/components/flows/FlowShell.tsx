'use client';

import Link from 'next/link';
import { Stepper } from '~/components/ui/Stepper';
import { cn } from '~/lib/utils';

export function FlowShell({
  breadcrumb,
  title,
  subtitle,
  steps,
  currentStep,
  children,
  footer,
  aside,
  className,
}: {
  breadcrumb?: { href: string; label: string; current: string };
  title: string;
  subtitle?: string;
  steps?: string[];
  currentStep?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[calc(100vh-122px)] flex-col', className)}>
      {steps && currentStep != null && (
        <div className="border-b border-border">
          <div className="mx-auto max-w-[1280px] px-6 py-4 md:px-12 lg:px-20">
            <Stepper steps={steps} currentStep={currentStep} />
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10 md:px-12 lg:px-20">
        {breadcrumb && (
          <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted">
            <Link href={breadcrumb.href} className="transition-colors hover:text-foreground">
              {breadcrumb.label}
            </Link>
            <span aria-hidden>›</span>
            <span className="text-foreground">{breadcrumb.current}</span>
          </nav>
        )}

        <header className="gallery-fade-up mb-10 max-w-2xl">
          <h1 className="font-display text-4xl leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && <p className="mt-3 text-lg text-muted">{subtitle}</p>}
        </header>

        <div
          className={cn(
            aside ? 'grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px]' : 'max-w-2xl',
          )}
        >
          <div className="gallery-fade-up" style={{ animationDelay: '60ms' }}>
            {children}
          </div>
          {aside && (
            <aside className="gallery-fade-up lg:sticky lg:top-8 lg:self-start" style={{ animationDelay: '120ms' }}>
              {aside}
            </aside>
          )}
        </div>
      </div>

      {footer && (
        <div className="border-t border-border">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-4 md:px-12 lg:px-20">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}

export function FlowField({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function FlowSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6">
      {title && <h2 className="font-display text-2xl text-foreground">{title}</h2>}
      {children}
    </section>
  );
}

export function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
