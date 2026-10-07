// Renders a signup form's fields for filling in. Used by the public form page
// and by the editor's live preview.
const INPUT_PROPS = {
  name: { type: "text", autoComplete: "name" },
  email: { type: "email", autoComplete: "email", inputMode: "email" },
  phone: { type: "tel", autoComplete: "tel", inputMode: "tel" },
};

function FieldLabel({ field, as: Tag = "label", htmlFor }) {
  return (
    <Tag htmlFor={htmlFor} className="field-label">
      {field.label || "Untitled field"}
      {field.required && <span className="required-mark" aria-hidden> *</span>}
    </Tag>
  );
}

export default function FormFields({ fields, answers, errors = {}, onChange, idPrefix = "ff", disabled = false }) {
  return fields.map((field) => {
    const id = `${idPrefix}-${field.id}`;
    const value = answers[field.id];
    const error = errors[field.id];

    if (field.type === "select") {
      const selected = field.multiple ? value || [] : value || "";
      const toggle = (option) => {
        if (!field.multiple) return onChange(field.id, option);
        onChange(field.id, selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]);
      };
      return (
        <fieldset key={field.id} className="choices" disabled={disabled}>
          <FieldLabel field={field} as="legend" />
          {field.multiple && <span className="row-sub">Choose all that apply.</span>}
          {field.options.filter(Boolean).map((option) => (
            <label key={option} className="check">
              <input
                type={field.multiple ? "checkbox" : "radio"}
                name={id}
                checked={field.multiple ? selected.includes(option) : selected === option}
                onChange={() => toggle(option)}
              />
              {option}
            </label>
          ))}
          {error && <span className="field-error" role="alert">{error}</span>}
        </fieldset>
      );
    }

    const shared = {
      id,
      className: "input",
      value: value || "",
      disabled,
      "aria-invalid": Boolean(error),
      onChange: (e) => onChange(field.id, e.target.value),
    };

    return (
      <div key={field.id} className="field">
        <FieldLabel field={field} htmlFor={id} />
        {field.type === "text" ? <textarea {...shared} rows={3} /> : <input {...shared} {...INPUT_PROPS[field.type]} />}
        {error && <span className="field-error" role="alert">{error}</span>}
      </div>
    );
  });
}
