import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="fullscreen">
      <div className="state">
        <div className="state-icon"><Compass size={22} aria-hidden /></div>
        <strong>Page not found</strong>
        <p>That page doesn't exist in PF Management.</p>
        <Link to="/dashboard" className="btn primary">Go to Dashboard</Link>
      </div>
    </div>
  );
}
