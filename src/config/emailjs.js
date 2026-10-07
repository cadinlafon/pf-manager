// EmailJS sends the invitation email straight from the browser. These three
// values are public identifiers (EmailJS is designed to expose them
// client-side) — the private key is never used here.
//
// The template must use these variables: {{to_name}}, {{to_email}}, {{invite_url}}.
// In the EmailJS template settings, "To Email" must be set to {{to_email}}.
export const EMAILJS = {
  serviceId: "service_hhsy35q",
  templateId: "template_7aftvfj",
  publicKey: "CnFo1Rsdnl3BY9_uS",
};
