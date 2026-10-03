import type { PropsWithChildren, ReactNode } from "react";

export type Tone = "neutral" | "positive" | "warning" | "danger" | "info";

export function Badge({
  children,
  tone = "neutral",
}: PropsWithChildren<{ tone?: Tone }>) {
  return <span className={`zui-badge zui-badge--${tone}`}>{children}</span>;
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: PropsWithChildren<{
  title: string;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`zui-panel ${className}`}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <article className="zui-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function EmptyState({ children }: PropsWithChildren) {
  return <p className="zui-empty">{children}</p>;
}

export function Button({
  children,
  ...props
}: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button className="zui-button" {...props}>
      {children}
    </button>
  );
}
