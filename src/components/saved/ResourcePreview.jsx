import { useEffect, useState } from "react";
import { Download, ExternalLink, FileX, Link2 } from "lucide-react";
import Modal from "../ui/Modal";
import { LoadingState, Notice } from "../ui";
import { getFileUrl } from "../../firebase/saved";
import { domainOf, formatBytes } from "../../lib/format";
import { canPreview, isFileType } from "../../lib/saved";

// The main content of a resource on its details page: the note text, the link,
// or the uploaded file (previewed in place for images and PDFs).
export default function ResourcePreview({ resource, onOpened }) {
  const needsFile = isFileType(resource.type);
  const [fileUrl, setFileUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // The file's address is requested fresh each time, and only here — where the
  // Storage rules have just confirmed this leader may open it.
  useEffect(() => {
    if (!needsFile) return;
    let cancelled = false;
    setFileUrl("");
    setFailed(false);
    getFileUrl(resource)
      .then((url) => !cancelled && setFileUrl(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [needsFile, resource.id, resource.storagePath]);

  if (resource.type === "note") {
    return <p className="note-content">{resource.content}</p>;
  }

  if (resource.type === "link") {
    return (
      <a className="link-preview" href={resource.url} target="_blank" rel="noopener noreferrer" onClick={onOpened}>
        <Link2 size={18} aria-hidden />
        <span>
          <strong>{domainOf(resource.url)}</strong>
          <span className="row-sub">{resource.url}</span>
        </span>
        <ExternalLink size={16} aria-hidden />
      </a>
    );
  }

  if (failed) return <Notice tone="error">This file couldn't be loaded. It may have been removed, or you may not have access to it.</Notice>;
  if (!fileUrl) return <LoadingState rows={3} />;

  const kind = canPreview(resource);
  const download = (
    <a className="btn primary" href={fileUrl} target="_blank" rel="noopener noreferrer" download={resource.fileName}>
      <Download size={16} aria-hidden />
      {kind ? "Open / Download" : "Download File"}
    </a>
  );

  return (
    <div className="form">
      {kind === "image" && (
        <>
          <button type="button" className="image-preview" onClick={() => setZoomed(true)} aria-label="View larger">
            <img src={fileUrl} alt={resource.title} />
          </button>
          {zoomed && (
            <Modal title={resource.title} onClose={() => setZoomed(false)}>
              <img src={fileUrl} alt={resource.title} className="image-full" />
            </Modal>
          )}
        </>
      )}
      {kind === "pdf" && <iframe className="pdf-preview" src={fileUrl} title={resource.title} />}
      {!kind && (
        <div className="placeholder-area" style={{ minHeight: 160 }}>
          <FileX size={32} aria-hidden />
          <p>This file cannot be previewed here.</p>
        </div>
      )}
      <div className="btn-row">
        {download}
        <span className="row-sub">{resource.fileName} · {formatBytes(resource.fileSize)}</span>
      </div>
    </div>
  );
}
