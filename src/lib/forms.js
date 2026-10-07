// Shared definitions for signup forms (used by the editor and the public page).

export const FIELD_TYPES = {
  name: { label: "Name", defaultLabel: "Name" },
  email: { label: "Email", defaultLabel: "Email" },
  phone: { label: "Phone", defaultLabel: "Phone" },
  text: { label: "Text", defaultLabel: "" },
  select: { label: "Select", defaultLabel: "" },
};

export function newField(type) {
  const field = {
    id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: FIELD_TYPES[type].defaultLabel,
    required: type === "name",
  };
  if (type === "select") {
    field.options = ["", ""];
    field.multiple = false;
  }
  return field;
}

// The link ending: /form/<slug>. Either generated digits or chosen by the leader.
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export function randomSlug() {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 100000000;
  return String(digits).padStart(8, "0");
}

export function cleanSlug(value) {
  return value.toLowerCase().trim().replace(/^\/+/, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function formPath(slug) {
  return `/form/${slug}`;
}

export function formUrl(slug) {
  const base = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${base.replace(/\/$/, "")}${formPath(slug)}`;
}

// Problems with a form definition, or null if it can be saved.
export function validateForm({ title, fields }) {
  if (!title.trim()) return "Give the form a title.";
  if (fields.length === 0) return "Add at least one field.";
  for (const field of fields) {
    if (!field.label.trim()) return `Every field needs a label (check the ${FIELD_TYPES[field.type].label} field).`;
    if (field.type === "select" && field.options.filter((o) => o.trim()).length < 2) {
      return `"${field.label.trim()}" needs at least two options.`;
    }
  }
  return null;
}

// Strip empty options and whitespace before saving.
export function tidyFields(fields) {
  return fields.map((field) => {
    const tidy = { id: field.id, type: field.type, label: field.label.trim(), required: Boolean(field.required) };
    if (field.type === "select") {
      tidy.options = [...new Set(field.options.map((o) => o.trim()).filter(Boolean))];
      tidy.multiple = Boolean(field.multiple);
    }
    return tidy;
  });
}

// { fieldId: message } for a visitor's answers; empty when everything is fine.
export function validateAnswers(fields, answers) {
  const errors = {};
  for (const field of fields) {
    const value = answers[field.id];
    const empty = Array.isArray(value) ? value.length === 0 : !String(value ?? "").trim();
    if (empty) {
      if (field.required) errors[field.id] = "This is required.";
      continue;
    }
    if (field.type === "email" && !/^\S+@\S+\.\S+$/.test(value.trim())) {
      errors[field.id] = "Enter a valid email address.";
    }
    if (field.type === "phone" && value.replace(/\D/g, "").length < 7) {
      errors[field.id] = "Enter a valid phone number.";
    }
  }
  return errors;
}

export function answerText(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value ?? "";
}
