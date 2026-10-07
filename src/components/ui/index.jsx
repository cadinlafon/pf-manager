// Small shared building blocks used across every page.
import { useState } from "react";
import { AlertCircle, Check, Copy, Inbox, Info, Loader2, Search } from "lucide-react";

export function Button({ variant = "", block = false, loading = false, icon: Icon, children, className = "", ...props }) {
  const classes = ["btn", variant, block ? "block" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} {...props} disabled={loading || props.disabled}>
      {loading ? <Loader2 size={16} className="spin" aria-hidden /> : Icon ? <Icon size={16} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function Card({ title, icon: Icon, action, children, className = "", flush = false }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-head">
          <h2>
            {Icon && <Icon size={17} aria-hidden />}
            {title}
          </h2>
          {action}
        </div>
      )}
      {flush ? children : <div className="card-body">{children}</div>}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Badge({ tone = "", children }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Notice({ tone = "", children }) {
  const Icon = tone === "error" ? AlertCircle : Info;
  return (
    <div className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={16} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export function Field({ label, id, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function TextField({ label, id, as = "input", className = "", ...props }) {
  const Tag = as;
  return (
    <Field label={label} id={id}>
      <Tag id={id} className={`input ${className}`} {...props} />
    </Field>
  );
}

export function SelectField({ label, id, options, ...props }) {
  return (
    <Field label={label} id={id}>
      <select id={id} className="input" {...props}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="input-wrap lead">
      <Search size={16} aria-hidden />
      <input
        type="search"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

export function LoadingState({ rows = 4 }) {
  return (
    <div className="skel-rows" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel" style={{ width: `${88 - (i % 3) * 18}%` }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="state">
      <div className="state-icon"><Icon size={22} aria-hidden /></div>
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong while loading this.", onRetry }) {
  return (
    <div className="state error" role="alert">
      <div className="state-icon"><AlertCircle size={22} aria-hidden /></div>
      <strong>Couldn't load this</strong>
      <p>{message}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// Renders the right state for a useQuery() result that is a list.
export function QueryView({ query, rows, empty, children }) {
  if (query.loading) return <LoadingState rows={rows} />;
  if (query.error) return <ErrorState message={query.error} onRetry={query.reload} />;
  if (!query.data || query.data.length === 0) return empty;
  return children(query.data);
}

export function FullScreenLoader({ label = "Loading PF Management…" }) {
  return (
    <div className="fullscreen" role="status">
      <img src="/icons/icon-192.png" alt="" />
      <Loader2 size={22} className="spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function CopyButton({ text, label = "Copy Link" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is still visible to copy by hand.
    }
  };
  return <Button icon={copied ? Check : Copy} onClick={copy}>{copied ? "Copied" : label}</Button>;
}
