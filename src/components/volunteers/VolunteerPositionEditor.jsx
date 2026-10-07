import { Minus, Plus, Trash2 } from "lucide-react";
import { TextField } from "../ui";

// One position in the signup editor. `filled` is how many people are already
// signed up for it, which is the fewest spots it can be reduced to.
export default function VolunteerPositionEditor({ position, filled = 0, onChange, onRemove }) {
  const set = (patch) => onChange({ ...position, ...patch });
  const minSpots = Math.max(1, filled);
  const setSpots = (value) => set({ spotsNeeded: Math.min(500, Math.max(minSpots, Math.round(Number(value)) || minSpots)) });

  return (
    <div className="field-card">
      <TextField label="Position Name" id={`pos-name-${position.id}`} value={position.name} placeholder="e.g. Setup"
        onChange={(e) => set({ name: e.target.value })} />
      <TextField label="Description" id={`pos-desc-${position.id}`} value={position.description} placeholder="Optional — e.g. Help arrange tables and chairs."
        onChange={(e) => set({ description: e.target.value })} />

      <div className="field-card-head" style={{ flexWrap: "wrap" }}>
        <div className="btn-row">
          <span className="field-caption" id={`pos-spots-${position.id}`}>Spots needed</span>
          <div className="stepper" role="group" aria-labelledby={`pos-spots-${position.id}`}>
            <button type="button" onClick={() => setSpots(position.spotsNeeded - 1)} disabled={position.spotsNeeded <= minSpots} aria-label="One fewer spot">
              <Minus size={16} />
            </button>
            <input type="number" inputMode="numeric" min={minSpots} max={500} value={position.spotsNeeded}
              aria-label="Spots needed" onChange={(e) => setSpots(e.target.value)} />
            <button type="button" onClick={() => setSpots(position.spotsNeeded + 1)} aria-label="One more spot">
              <Plus size={16} />
            </button>
          </div>
          {filled > 0 && <span className="row-sub">{filled} signed up</span>}
        </div>
        <button type="button" className="btn danger" onClick={onRemove}>
          <Trash2 size={16} aria-hidden />
          Delete
        </button>
      </div>
    </div>
  );
}
