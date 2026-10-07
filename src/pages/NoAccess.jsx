import { ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui";

// Shown to someone who signed in successfully (for example with a PF Audio App
// listener account) but isn't a leader.
export default function NoAccess() {
  const { user, signOut } = useAuth();

  return (
    <div className="fullscreen">
      <div className="state">
        <div className="state-icon"><ShieldAlert size={22} aria-hidden /></div>
        <strong>This account doesn't have manager access</strong>
        <p>
          You're signed in as {user?.email}, but PF Management is only for invited Palouse Fellowship managers.
          Ask a main admin to give this account access.
        </p>
        <Button variant="primary" onClick={signOut}>Sign out</Button>
      </div>
    </div>
  );
}
