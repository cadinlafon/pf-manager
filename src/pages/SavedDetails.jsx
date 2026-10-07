import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bookmark, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { useSavedUser } from "../hooks/useSavedUser";
import { deleteSaved, getSaved, setPinned } from "../firebase/saved";
import { TYPES, canManage, canPin, savedUrl } from "../lib/saved";
import Modal from "../components/ui/Modal";
import ResourcePreview from "../components/saved/ResourcePreview";
import SavedResourceModal from "../components/saved/SavedResourceModal";
import { FavoriteButton, ResourceTypeIcon, ResourceVisibilityBadge, TagList } from "../components/saved/SavedBits";
import { Badge, Button, Card, CopyButton, EmptyState, ErrorState, LoadingState, Notice, PageHeader } from "../components/ui";

const formatDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

export default function SavedDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const loader = useCallback(() => getSaved(id), [id]);
  const query = useQuery(loader);
  const { favorites, ready, toggleFavorite, markOpened } = useSavedUser();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const resource = query.data && !Array.isArray(query.data) ? query.data : null;

  // Count this as "recently opened" once per visit, after the leader's list has loaded.
  const recorded = useRef(false);
  useEffect(() => {
    if (resource && ready && !recorded.current) {
      recorded.current = true;
      markOpened(resource.id);
    }
  }, [resource, ready, markOpened]);

  const back = (
    <Link to="/saved" className="btn">
      <ArrowLeft size={16} aria-hidden />
      All Saved
    </Link>
  );

  if (query.loading && !query.data) return (<><PageHeader title="Saved" action={back} /><Card><LoadingState rows={6} /></Card></>);
  if (query.error) return (<><PageHeader title="Saved" action={back} /><section className="card"><ErrorState message={query.error} onRetry={query.reload} /></section></>);
  if (!resource) {
    return (
      <>
        <PageHeader title="Saved" action={back} />
        <section className="card">
          <EmptyState icon={Bookmark} title="Resource not available" message="It may have been deleted, or it isn't shared with you." />
        </section>
      </>
    );
  }

  const manage = canManage(resource, user.uid, role);

  const run = async (key, action, after) => {
    setBusy(key);
    setError("");
    try {
      await action();
      after();
    } catch (err) {
      setError(err.code?.startsWith("storage/") ? "The file couldn't be removed. Please try again." : firestoreMessage(err));
      setConfirmingDelete(false);
    }
    setBusy("");
  };

  return (
    <>
      <PageHeader title={resource.title} action={back} />

      <div className="stack">
        {error && <Notice tone="error">{error}</Notice>}

        <section className="card">
          <div className="card-body" style={{ paddingTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="saved-card-head">
              <ResourceTypeIcon type={resource.type} />
              <span className="saved-labels" style={{ flex: 1 }}>
                <Badge>{TYPES[resource.type].label}</Badge>
                <Badge>{resource.category}</Badge>
                <ResourceVisibilityBadge visibility={resource.visibility} />
                {resource.pinned && <Badge tone="warn"><Pin size={12} aria-hidden /> Pinned</Badge>}
              </span>
              <FavoriteButton active={favorites.has(resource.id)} onToggle={() => toggleFavorite(resource.id)} title={resource.title} />
            </div>

            {resource.description && <p style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>{resource.description}</p>}

            <ResourcePreview resource={resource} onOpened={() => markOpened(resource.id)} />

            <TagList tags={resource.tags} />

            <dl className="kv">
              <dt>Saved by</dt><dd>{resource.createdBy === user.uid ? "You" : resource.createdByName || "A manager"}</dd>
              <dt>Created</dt><dd>{formatDate(resource.createdAt)}</dd>
              <dt>Updated</dt><dd>{formatDate(resource.updatedAt)}</dd>
            </dl>

            <div className="btn-row">
              {resource.visibility !== "personal" && <CopyButton text={savedUrl(resource.id)} />}
              {canPin(resource, role) && (
                <Button icon={resource.pinned ? PinOff : Pin} loading={busy === "pin"}
                  onClick={() => run("pin", () => setPinned(resource.id, !resource.pinned), query.reload)}>
                  {resource.pinned ? "Unpin" : "Pin for Everyone"}
                </Button>
              )}
              {manage && <Button icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
              {manage && <Button variant="danger" icon={Trash2} onClick={() => setConfirmingDelete(true)}>Delete</Button>}
            </div>
            {resource.visibility !== "personal" && (
              <span className="row-sub">The copied link only works for signed-in managers who are allowed to see this.</span>
            )}
          </div>
        </section>
      </div>

      {editing && <SavedResourceModal resource={resource} onClose={() => setEditing(false)} onSaved={query.reload} />}

      {confirmingDelete && (
        <Modal
          title={`Delete "${resource.title}"?`}
          onClose={() => setConfirmingDelete(false)}
          footer={
            <>
              <Button onClick={() => setConfirmingDelete(false)} disabled={busy === "delete"}>Cancel</Button>
              <Button variant="danger" icon={Trash2} loading={busy === "delete"}
                onClick={() => run("delete", () => deleteSaved(resource), () => navigate("/saved", { replace: true }))}>
                Delete
              </Button>
            </>
          }
        >
          <p>
            This resource will be removed from PF Management
            {resource.storagePath || resource.dataUrl ? ", along with its uploaded file" : ""}. This can't be undone.
          </p>
        </Modal>
      )}
    </>
  );
}
