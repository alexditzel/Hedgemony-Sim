import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { useEffect } from "react";
import type { FactionTone } from "./factions";

type ButtonVariant = "default" | "primary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "default", className, ...rest }: ButtonProps) {
  const cls = [
    variant === "primary" && "btn-primary",
    variant === "ghost" && "btn-ghost",
    variant === "danger" && "btn-danger",
    className
  ]
    .filter(Boolean)
    .join(" ");
  return <button {...rest} className={cls || undefined} />;
}

interface SectionProps {
  title: string;
  tone?: FactionTone;
  hint?: ReactNode;
  flush?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}

export function Section({ title, tone = "blue", hint, flush, children, actions }: SectionProps) {
  const dotClass =
    tone === "red" ? "section__title--red" :
    tone === "white" ? "section__title--amber" :
    tone === "neutral" ? "section__title--muted" : "";
  return (
    <section className="section">
      <header className="section__header">
        <span className={`section__title ${dotClass}`}>{title}</span>
        {actions ? <div className="row gap-sm">{actions}</div> : hint ? <span className="section__hint">{hint}</span> : null}
      </header>
      <div className={`section__body ${flush ? "section__body--flush" : ""}`}>{children}</div>
    </section>
  );
}

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: FactionTone | "green";
}
export function Tag({ tone = "neutral", className, children, ...rest }: TagProps) {
  const map: Record<string, string> = { blue: "tag--blue", red: "tag--red", white: "tag--amber", green: "tag--green", neutral: "" };
  return (
    <span className={["tag", map[tone] ?? "", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </span>
  );
}

interface EmptyStateProps {
  children: ReactNode;
}
export function EmptyState({ children }: EmptyStateProps) {
  return <div className="empty-state">{children}</div>;
}

interface BannerProps {
  tone: "info" | "warning" | "error";
  children: ReactNode;
}
export function Banner({ tone, children }: BannerProps) {
  const cls = tone === "error" ? "error-banner" : tone === "warning" ? "warning-banner" : "info-banner";
  return <div className={cls}>{children}</div>;
}

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}

export function Modal({ open, title, onClose, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`modal ${size === "lg" ? "modal--lg" : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal__header">
          <span className="modal__title">{title}</span>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
