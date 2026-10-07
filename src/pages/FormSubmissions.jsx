import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Inbox, Trash2 } from "lucide-react";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { deleteSubmission, getForm, listSubmissions } from "../firebase/forms";
import { answerText, formPath, formUrl } from "../lib/forms";
import { Button, Card, CopyButton, EmptyState, ErrorState, LoadingState, Notice, PageHeader } from "../components/ui";

const formatWhen = (ms) =>
  ms ? new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

function downloadCsv(form, rows) {
  // Prefix cells a spreadsheet would run as a formula, then quote everything.
  const cell = (value) => {
    const text = String(value ?? "");
    return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const lines = [
    ["Submitted", ...form.fields.map((f) => f.label)],
    ...rows.map((row) => [row.submittedAt ? new Date(row.submittedAt).toLocaleString("en-US") : "", ...form.fields.map((f) => answerText(row.answers[f.id]))]),
  ].map((line) => line.map(cell).join(","));

  const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${form.slug}-submissions.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function FormSubmissions() {
  const { slug } = useParams();
  const loader = useCallback(async () => {
    const form = await getForm(slug);
    return form ? { form, rows: await listSubmissions(slug) } : null;
  }, [slug]);
  const query = useQuery(loader);
  const [error, setError] = useState("");

  const back = (
    <Link to="/forms" className="btn">
      <ArrowLeft size={16} aria-hidden />
      All Forms
    </Link>
  );

  if (query.loading) return (<><PageHeader title="Submissions" action={back} /><Card><LoadingState rows={6} /></Card></>);
  if (query.error) return (<><PageHeader title="Submissions" action={back} /><section className="card"><ErrorState message={query.error} onRetry={query.reload} /></section></>);
  if (!query.data) return (<><PageHeader title="Submissions" action={back} /><section className="card"><EmptyState title="Form not found" message="It may have been deleted." /></section></>);

  const { form, rows } = query.data;

  const remove = async (row) => {
    if (!window.confirm("Delete this submission? This can't be undone.")) return;
    setError("");
    try {
      await deleteSubmission(slug, row.id);
      query.reload();
    } catch (err) {
      setError(firestoreMessage(err));
    }
  };

  return (
    <>
      <PageHeader title={form.title} subtitle={`${rows.length} ${rows.length === 1 ? "submission" : "submissions"} · ${formPath(slug)}`} action={back} />

      <div className="stack">
        {error && <Notice tone="error">{error}</Notice>}
        <div className="btn-row">
          <Button icon={Download} onClick={() => downloadCsv(form, rows)} disabled={rows.length === 0}>Export CSV</Button>
          <CopyButton text={formUrl(slug)} label="Copy Form Link" />
        </div>

        <section className="card">
          {rows.length === 0 ? (
            <EmptyState icon={Inbox} title="No submissions yet" message="Responses will appear here as people fill out the form." />
          ) : (
            <div className="card-body table-scroll" style={{ paddingTop: 18 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Submitted</th>
                    {form.fields.map((field) => <th key={field.id}>{field.label}</th>)}
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="nowrap">{formatWhen(row.submittedAt)}</td>
                      {form.fields.map((field) => (
                        <td key={field.id} style={{ overflowWrap: "anywhere" }}>{answerText(row.answers[field.id]) || "—"}</td>
                      ))}
                      <td style={{ minWidth: 0, padding: "4px 0" }}>
                        <button type="button" className="icon-btn" aria-label="Delete submission" onClick={() => remove(row)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
