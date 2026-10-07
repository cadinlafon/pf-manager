import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Lock, MailX } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useQuery, firestoreMessage } from "../hooks/useQuery";
import { acceptInvitation, getInvitation, invitationState } from "../firebase/invitations";
import { LEADER_ROLES } from "../firebase/collections";
import { Button, EmptyState, ErrorState, Field, LoadingState, Notice, TextField } from "../components/ui";

const PROBLEMS = {
  missing: {
    title: "This invitation link isn't valid",
    message: "It may have been revoked or copied incorrectly. Ask a main admin to send a new invitation.",
  },
  expired: {
    title: "This invitation has expired",
    message: "Ask a main admin to send you a new one.",
  },
  accepted: {
    title: "This invitation has already been used",
    message: "If that was you, sign in with the password you chose.",
  },
};

function AcceptForm({ invitation }) {
  const { user, signIn, createAccount, signOut, refreshAccess } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // The invited email may already have a PF Audio App account (same Firebase
  // project). Then they confirm that account's password instead of choosing one.
  const [existingAccount, setExistingAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const signedInAsOther = user && user.email?.toLowerCase() !== invitation.email;
  const signedInAsInvitee = user && !signedInAsOther;

  const finish = async (uid) => {
    await acceptInvitation(invitation, uid);
    await refreshAccess();
    navigate("/dashboard", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!signedInAsInvitee) {
      if (!existingAccount && password.length < 8) return setError("Choose a password with at least 8 characters.");
      if (!existingAccount && password !== confirm) return setError("Passwords don't match.");
      if (existingAccount && !password) return setError("Enter your password.");
    }

    setSubmitting(true);
    try {
      let uid = user?.uid;
      if (!signedInAsInvitee) {
        const credential = existingAccount
          ? await signIn(invitation.email, password)
          : await createAccount(invitation.email, password);
        uid = credential.user.uid;
      }
      await finish(uid);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setExistingAccount(true);
        setPassword("");
        setConfirm("");
        setError("");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("That password isn't right for this account.");
      } else if (err.code === "auth/weak-password") {
        setError("Please choose a stronger password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a moment and try again.");
      } else if (err.code?.startsWith("auth/")) {
        setError("Couldn't set up the account. Please try again.");
      } else {
        // Account exists/signed in, but the leader record couldn't be written.
        setError(`Your account is ready, but manager access couldn't be granted. ${firestoreMessage(err)}`);
      }
      setSubmitting(false);
    }
  };

  if (signedInAsOther) {
    return (
      <div className="form">
        <Notice tone="warn">
          You're signed in as {user.email}, but this invitation is for {invitation.email}. Sign out to continue.
        </Notice>
        <Button variant="primary" block onClick={signOut}>Sign out</Button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div>
        <h2>{existingAccount || signedInAsInvitee ? "Accept your invitation" : "Create your account"}</h2>
        <p className="lede">
          {invitation.name}, you've been invited to PF Management, Palouse Fellowship's management system, as {LEADER_ROLES[invitation.role]}.
        </p>
      </div>

      {existingAccount && (
        <Notice>
          This email already has a Palouse Fellowship account (from the PF Audio App). Enter that account's password
          to add manager access to it. <Link to="/login">Forgot it?</Link>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <Field label="Email" id="invite-email">
        <div className="input-wrap trail">
          <input id="invite-email" className="input" type="email" value={invitation.email} disabled readOnly aria-describedby="invite-email-hint" />
          <Lock size={16} aria-hidden />
        </div>
        <span id="invite-email-hint" className="row-sub">Set by your invitation and can't be changed.</span>
      </Field>

      {!signedInAsInvitee && (
        <TextField label="Password" id="invite-password" type="password"
          autoComplete={existingAccount ? "current-password" : "new-password"}
          value={password} onChange={(e) => setPassword(e.target.value)} />
      )}
      {!signedInAsInvitee && !existingAccount && (
        <TextField label="Confirm Password" id="invite-confirm" type="password" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      )}

      <Button type="submit" variant="primary" block loading={submitting}>
        {existingAccount || signedInAsInvitee ? "Accept Invitation" : "Create Account"}
      </Button>
    </form>
  );
}

export default function Invitation() {
  const { token } = useParams();
  const { loading: authLoading } = useAuth();
  const loader = useCallback(() => getInvitation(token), [token]);
  const query = useQuery(loader);

  // Wait for Firebase Auth only on first load. Submitting the form signs the
  // invitee in, which briefly sets auth loading again — the form must stay
  // mounted through that so it can finish and show any error.
  const [authReady, setAuthReady] = useState(!authLoading);
  useEffect(() => {
    if (!authLoading) setAuthReady(true);
  }, [authLoading]);

  const state = query.loading || query.error ? null : invitationState(query.data);

  let body;
  if (query.loading || !authReady) {
    body = <LoadingState rows={4} />;
  } else if (query.error) {
    body = <ErrorState message={query.error} onRetry={query.reload} />;
  } else if (state !== "valid") {
    body = (
      <EmptyState icon={MailX} title={PROBLEMS[state].title} message={PROBLEMS[state].message}
        action={<Link to="/login" className="btn primary">Go to Sign In</Link>} />
    );
  } else {
    body = <AcceptForm invitation={query.data} />;
  }

  return (
    <div className="auth">
      <div className="auth-hero">
        <img src="/icons/icon-192.png" alt="" />
        <h1>Welcome to PF Management</h1>
        <p>Palouse Fellowship Management</p>
      </div>

      <div className="auth-body">
        <div className="card auth-card">{body}</div>
        <p className="auth-foot">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
