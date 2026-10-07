import emailjs from "@emailjs/browser";
import {
  deleteDoc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";
import { col, docRef } from "./collections";
import { EMAILJS } from "../config/emailjs";

// Invitation flow
//
//   1. A main admin creates invitations/{token}. The token is 32 random bytes,
//      so the link itself is the secret; nobody can list invitations except
//      main admins.
//   2. EmailJS emails the link to the invited address.
//   3. The invitee opens /invite/{token}, sets a password, and in one batch
//      creates leaders/{uid} and marks the invitation accepted.
//
// Security rules (firestore.rules.leaders) enforce step 3: the leader doc can
// only be created by an account whose email matches a pending, unexpired
// invitation, with the role that invitation grants.

const INVITE_DAYS = 7;

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Set VITE_APP_URL once PF Management has a real address, so invitations sent
// from a local dev server don't link to localhost.
export function inviteUrl(token) {
  const base = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

export async function createInvitation({ name, email, role }, invitedBy) {
  const token = newToken();
  const invitation = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    status: "pending",
    invitedBy: invitedBy.uid,
    invitedByName: invitedBy.name,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
  };
  await setDoc(docRef("invitations", token), invitation);
  return { token, ...invitation };
}

export function sendInvitationEmail({ name, email, token }) {
  return emailjs.send(
    EMAILJS.serviceId,
    EMAILJS.templateId,
    { to_name: name, to_email: email, invite_url: inviteUrl(token) },
    { publicKey: EMAILJS.publicKey }
  );
}

// "valid" | "missing" | "expired" | "accepted"
export function invitationState(invitation) {
  if (!invitation) return "missing";
  if (invitation.status !== "pending") return "accepted";
  if (invitation.expiresAt.toMillis() < Date.now()) return "expired";
  return "valid";
}

export async function getInvitation(token) {
  const snap = await getDoc(docRef("invitations", token));
  return snap.exists() ? { token, ...snap.data() } : null;
}

export async function listInvitations() {
  const snap = await getDocs(query(col("invitations"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ token: d.id, ...d.data() }));
}

export function revokeInvitation(token) {
  return deleteDoc(docRef("invitations", token));
}

export async function listLeaders() {
  const snap = await getDocs(col("leaders"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

// Takes away someone's access by deleting their leaders/{uid} record. Their
// Firebase sign-in account is left alone (the app can't delete it, and it may
// also be their PF Audio App account); without the record the security rules
// refuse them everything. Main admins only.
export function removeLeader(uid) {
  return deleteDoc(docRef("leaders", uid));
}

// Called by the newly signed-in invitee. Both writes succeed or neither does.
export function acceptInvitation(invitation, uid) {
  const batch = writeBatch(db);
  batch.set(docRef("leaders", uid), {
    name: invitation.name,
    email: invitation.email,
    role: invitation.role,
    inviteToken: invitation.token,
    createdAt: serverTimestamp(),
  });
  batch.update(docRef("invitations", invitation.token), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
    acceptedBy: uid,
  });
  return batch.commit();
}
