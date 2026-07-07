import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'navy';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-teal-500 text-white hover:bg-teal-600 active:bg-teal-700 shadow-sm disabled:bg-mist-300',
  secondary:
    'bg-white text-navy-700 border border-mist-300 hover:bg-mist-100 active:bg-mist-200 disabled:text-mist-400',
  ghost: 'text-navy-500 hover:bg-navy-50 active:bg-navy-100 disabled:text-mist-400',
  danger: 'bg-error-50 text-error-700 hover:bg-error-500 hover:text-white disabled:opacity-50',
  /* gold is reserved for donation / fundraising CTAs */
  gold: 'bg-gold-500 text-navy-800 hover:bg-gold-600 active:bg-gold-700 shadow-sm disabled:bg-mist-300',
  navy: 'bg-navy-700 text-white hover:bg-navy-600 active:bg-navy-800 shadow-sm disabled:bg-mist-300',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  const sizes = {
    sm: 'h-8 px-3 text-sm gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2',
  };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed',
        buttonVariants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
});

/* ---------- Form controls ---------- */

const controlBase =
  'w-full rounded-xl border border-mist-300 bg-white px-3.5 py-2.5 text-sm text-navy-700 placeholder:text-mist-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-mist-100 disabled:text-mist-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(controlBase, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(controlBase, 'min-h-24', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(controlBase, 'appearance-none pr-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);

export function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-600">
        {label}
        {required && <span className="ml-0.5 text-error-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-mist-600">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-error-500">{error}</span>}
    </label>
  );
}

/* ---------- Layout primitives ---------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-card bg-white p-5 shadow-card', className)}>{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-navy-700 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mist-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type BadgeTone = 'teal' | 'navy' | 'mist' | 'gold' | 'success' | 'error';

const badgeTones: Record<BadgeTone, string> = {
  teal: 'bg-teal-50 text-teal-700',
  navy: 'bg-navy-50 text-navy-600',
  mist: 'bg-mist-100 text-mist-600',
  gold: 'bg-gold-100 text-gold-700',
  success: 'bg-success-50 text-success-700',
  error: 'bg-error-50 text-error-700',
};

export function Badge({ tone = 'mist', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-mist-600">
      <Loader2 size={28} className="animate-spin text-teal-500" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-mist-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
        {icon}
      </div>
      <h3 className="font-semibold text-navy-700">{title}</h3>
      {description && <p className="max-w-sm text-sm text-mist-600">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'animate-pop-in max-h-[90dvh] w-full overflow-y-auto rounded-t-card bg-white p-5 shadow-card-hover sm:rounded-card sm:p-6',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-navy-700">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Видалити',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-mist-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Скасувати
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
