import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ListPanel({ title, items, className }: { title: string; items: string[]; className?: string }) {
  return (
    <Panel title={title} className={className}>
      <ul className="clean-list">
        {items.length ? items.map((item) => <li key={item}>{item}</li>) : <li>-</li>}
      </ul>
    </Panel>
  );
}
