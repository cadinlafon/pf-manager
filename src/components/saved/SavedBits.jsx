// Small pieces shared by the Saved list, cards and details page.
import { Pin, Star } from "lucide-react";
import { Badge } from "../ui";
import { TYPES, VISIBILITY } from "../../lib/saved";

export function ResourceTypeIcon({ type, size = 20 }) {
  const Icon = TYPES[type]?.icon || TYPES.file.icon;
  return (
    <span className={`type-icon type-${type}`} title={TYPES[type]?.label}>
      <Icon size={size} aria-hidden />
    </span>
  );
}

export function ResourceVisibilityBadge({ visibility }) {
  const { label, icon: Icon } = VISIBILITY[visibility] || VISIBILITY.leaders;
  return (
    <Badge tone={visibility === "personal" ? "" : visibility === "admins" ? "warn" : "info"}>
      <Icon size={12} aria-hidden />
      {label}
    </Badge>
  );
}

// Personal to each leader: starring a resource never affects anyone else.
export function FavoriteButton({ active, onToggle, title }) {
  return (
    <button
      type="button"
      className={`icon-btn star-btn${active ? " on" : ""}`}
      aria-pressed={active}
      aria-label={active ? `Remove ${title} from your favorites` : `Add ${title} to your favorites`}
      title={active ? "In your favorites" : "Add to your favorites"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <Star size={18} fill={active ? "currentColor" : "none"} />
    </button>
  );
}

// Shown on resources a main admin has pinned for everyone.
export function PinnedMark() {
  return (
    <span className="pin-mark" title="Pinned for everyone">
      <Pin size={14} aria-hidden />
      <span className="sr-only">Pinned</span>
    </span>
  );
}

export function TagList({ tags, onPick }) {
  if (!tags?.length) return null;
  return (
    <span className="tags">
      {tags.map((tag) =>
        onPick ? (
          <button key={tag} type="button" className="tag" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPick(tag); }}>#{tag}</button>
        ) : (
          <span key={tag} className="tag">#{tag}</span>
        )
      )}
    </span>
  );
}
