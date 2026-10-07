import { Link } from "react-router-dom";
import { ExternalLink, Link2 } from "lucide-react";
import { FavoriteButton, PinnedMark, ResourceTypeIcon, ResourceVisibilityBadge, TagList } from "./SavedBits";
import { Badge } from "../ui";
import { domainOf, formatBytes, formatDay } from "../../lib/format";
import { savedPath } from "../../lib/saved";

const dayOf = (ms) => (ms ? formatDay(new Date(ms).toLocaleDateString("en-CA")) : "");

export default function SavedCard({ resource, isFavorite, isMine, onToggleFavorite, onPickTag, onOpenLink }) {
  const isLink = resource.type === "link";
  const summary = resource.description || (resource.type === "note" ? resource.content : "");

  return (
    <article className="card saved-card">
      <div className="saved-card-head">
        <ResourceTypeIcon type={resource.type} />
        <Link to={savedPath(resource.id)} className="saved-title card-link">{resource.title}</Link>
        {resource.pinned && <PinnedMark />}
        <FavoriteButton active={isFavorite} onToggle={onToggleFavorite} title={resource.title} />
      </div>

      {summary && <p className="row-sub clamp-2">{summary}</p>}

      {isLink && (
        <div className="row-sub saved-meta"><Link2 size={14} aria-hidden />{domainOf(resource.url)}</div>
      )}
      {resource.fileName && (
        <div className="row-sub saved-meta">{resource.fileName} · {formatBytes(resource.fileSize)}</div>
      )}

      <div className="saved-labels">
        <Badge>{resource.category}</Badge>
        <ResourceVisibilityBadge visibility={resource.visibility} />
        <TagList tags={resource.tags} onPick={onPickTag} />
      </div>

      <div className="saved-card-foot">
        <span className="row-sub">
          {isMine ? "You" : resource.createdByName || "A manager"} · Updated {dayOf(resource.updatedAt)}
        </span>
        {isLink ? (
          <a className="btn" href={resource.url} target="_blank" rel="noopener noreferrer" onClick={onOpenLink}>
            <ExternalLink size={16} aria-hidden />
            Open Link
          </a>
        ) : (
          <Link className="btn" to={savedPath(resource.id)}>Open</Link>
        )}
      </div>
    </article>
  );
}
