import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { CircleCheck, FileX } from "lucide-react";
import { firestoreMessage, useQuery } from "../hooks/useQuery";
import { getForm, submitForm } from "../firebase/forms";
import { validateAnswers } from "../lib/forms";
import FormFields from "../components/forms/FormFields";
import { Button, EmptyState, ErrorState, LoadingState, Notice } from "../components/ui";

// The public side of a signup form: anyone with the link can fill it in, no
// sign-in. This page shows nothing about PF Management itself.
function FillForm({ form }) {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [website, setWebsite] = useState(""); // honeypot: real people never see or fill this
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problems = validateAnswers(form.fields, answers);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setSubmitting(true);
    setFailed("");
    try {
      // Only send answers for fields on the form, trimmed.
      const clean = {};
      for (const field of form.fields) {
        const value = answers[field.id];
        if (Array.isArray(value) ? value.length : String(value ?? "").trim()) {
          clean[field.id] = Array.isArray(value) ? value : value.trim();
        }
      }
      if (!website) await submitForm(form.slug, clean);
      setDone(true);
    } catch (err) {
      setFailed(err.code === "permission-denied" ? "This form can't accept responses right now. Please try again later." : firestoreMessage(err));
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <EmptyState icon={CircleCheck} title="Thank you!" message="Your response has been recorded."
        action={<Button onClick={() => { setAnswers({}); setDone(false); }}>Submit another response</Button>} />
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div>
        <h2>{form.title}</h2>
        {form.description && <p className="lede" style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{form.description}</p>}
      </div>
      {failed && <Notice tone="error">{failed}</Notice>}
      {Object.keys(errors).length > 0 && <Notice tone="error">Please fix the highlighted fields.</Notice>}

      <FormFields
        fields={form.fields}
        answers={answers}
        errors={errors}
        disabled={submitting}
        onChange={(id, value) => {
          setAnswers((current) => ({ ...current, [id]: value }));
          setErrors((current) => ({ ...current, [id]: undefined }));
        }}
      />

      <div className="sr-only" aria-hidden>
        <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      <Button type="submit" variant="primary" block loading={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
    </form>
  );
}

export default function PublicForm() {
  const { slug } = useParams();
  const loader = useCallback(() => getForm(slug), [slug]);
  const query = useQuery(loader);
  const form = query.data && !Array.isArray(query.data) ? query.data : null;

  let body;
  if (query.loading) {
    body = <LoadingState rows={5} />;
  } else if (query.error) {
    body = <ErrorState message="This form couldn't be loaded. Please try again." onRetry={query.reload} />;
  } else if (!form) {
    body = <EmptyState icon={FileX} title="Form not found" message="This link may be mistyped, or the form may have been removed." />;
  } else if (form.status !== "open") {
    body = <EmptyState icon={FileX} title={form.title} message="This form is no longer accepting responses." />;
  } else {
    body = <FillForm form={form} />;
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <img src="/icons/icon-192.png" alt="" />
        <h1>Palouse Fellowship</h1>
      </div>
      <div className="auth-body" style={{ maxWidth: 560 }}>
        <div className="card auth-card">{body}</div>
      </div>
    </div>
  );
}
