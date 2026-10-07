import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";
import { COLLECTIONS, col, docRef } from "./collections";
import { PREVIEW } from "../lib/preview";
import { demoSignups } from "../lib/volunteers";

// Volunteer signups
//
//   volunteerSignups/{id}
//     title, description, date ("YYYY-MM-DD"), startTime/endTime ("HH:MM"), location
//     status: "open" | "closed" | "draft"
//     positions: [{ id, name, description, spotsNeeded }]
//     filledCounts: { [positionId]: number }
//     spotsByPosition: { [positionId]: spotsNeeded }   (copy of positions, for the security rules)
//     lastVolunteerId, cancelProof                     (bookkeeping for self-signup rules)
//     allowCancellation
//     createdBy, createdAt, updatedAt
//
//   volunteerSignups/{id}/volunteers/{volunteerId}
//     positionId, name, email, phone, createdAt
//     addedBy (leader-added)  |  source: "self" (signed up from the public page)
//
//   volunteerSignups/{id}/roster/{volunteerId}        (same ID as the volunteer doc)
//     positionId, name, createdAt
//
// The public page (/volunteer/{id}) shows who has signed up, like a paper
// signup sheet, so names are public — but only names. `volunteers` holds the
// contact details and only leaders can read it; `roster` is the public copy
// with just the name and position. Every change writes the volunteer doc, its
// roster entry and `filledCounts` in one batch so they can't drift apart.
//
// In dev preview mode there is no signed-in user, so everything is kept in this
// browser's localStorage instead and never touches Firestore.

const volunteersCol = (id) => collection(db, COLLECTIONS.volunteerSignups, id, "volunteers");
const rosterCol = (id) => collection(db, COLLECTIONS.volunteerSignups, id, "roster");
// Security rules can't search the positions array, so capacity is also kept as a map.
const spotsByPosition = (positions) => Object.fromEntries(positions.map((p) => [p.id, p.spotsNeeded]));
const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ?? null);

// ── Preview store ────────────────────────────────────────────────────
const PREVIEW_KEY = "pf-leaders-preview-volunteers";
function readPreview() {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY)) || { signups: {}, volunteers: {} };
  } catch {
    return { signups: {}, volunteers: {} };
  }
}
const writePreview = (store) => localStorage.setItem(PREVIEW_KEY, JSON.stringify(store));
const previewId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Dev preview only: adds two clearly labelled demo signups to this browser.
export function loadDemoSignups() {
  if (!PREVIEW) return;
  const store = readPreview();
  demoSignups().forEach(({ signup, volunteers }) => {
    const id = previewId("demo");
    store.signups[id] = { ...signup, createdAt: Date.now() };
    store.volunteers[id] = volunteers.map((v) => ({ id: previewId("v"), ...v, createdAt: Date.now() }));
  });
  writePreview(store);
}

// ── Signups ──────────────────────────────────────────────────────────
export async function listSignups() {
  if (PREVIEW) return Object.entries(readPreview().signups).map(([id, signup]) => ({ id, ...signup }));
  const snap = await getDocs(col("volunteerSignups"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: millis(d.data().createdAt) }));
}

export async function getSignup(id) {
  if (PREVIEW) {
    const signup = readPreview().signups[id];
    return signup ? { id, ...signup } : null;
  }
  const snap = await getDoc(docRef("volunteerSignups", id));
  return snap.exists() ? { id, ...snap.data(), createdAt: millis(snap.data().createdAt) } : null;
}

// Returns the new signup's id.
export async function createSignup(data, createdBy) {
  if (PREVIEW) {
    const store = readPreview();
    const id = previewId("s");
    store.signups[id] = { ...data, filledCounts: {}, createdAt: Date.now() };
    writePreview(store);
    return id;
  }
  const ref = await addDoc(col("volunteerSignups"), {
    ...data,
    spotsByPosition: spotsByPosition(data.positions),
    filledCounts: {},
    createdBy: createdBy.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// `removedPositionIds`: positions deleted in the editor. Their volunteers and
// counts are removed too, so nothing is left pointing at a missing position.
export async function updateSignup(id, data, removedPositionIds = []) {
  if (PREVIEW) {
    const store = readPreview();
    const filledCounts = { ...store.signups[id].filledCounts };
    removedPositionIds.forEach((pid) => delete filledCounts[pid]);
    store.signups[id] = { ...store.signups[id], ...data, filledCounts };
    store.volunteers[id] = (store.volunteers[id] || []).filter((v) => !removedPositionIds.includes(v.positionId));
    writePreview(store);
    return;
  }

  const batch = writeBatch(db);
  const changes = { ...data, spotsByPosition: spotsByPosition(data.positions), updatedAt: serverTimestamp() };
  if (removedPositionIds.length > 0) {
    const snap = await getDocs(volunteersCol(id));
    snap.docs.filter((d) => removedPositionIds.includes(d.data().positionId)).forEach((d) => {
      batch.delete(d.ref);
      batch.delete(doc(rosterCol(id), d.id));
    });
    removedPositionIds.forEach((pid) => {
      changes[`filledCounts.${pid}`] = deleteField();
    });
  }
  batch.update(docRef("volunteerSignups", id), changes);
  await batch.commit();
}

export async function setSignupStatus(id, status) {
  if (PREVIEW) {
    const store = readPreview();
    store.signups[id].status = status;
    writePreview(store);
    return;
  }
  await updateDoc(docRef("volunteerSignups", id), { status, updatedAt: serverTimestamp() });
}

// Deletes the signup and everyone signed up for it.
export async function deleteSignup(id) {
  if (PREVIEW) {
    const store = readPreview();
    delete store.signups[id];
    delete store.volunteers[id];
    writePreview(store);
    return;
  }
  const [volunteers, roster] = await Promise.all([getDocs(volunteersCol(id)), getDocs(rosterCol(id))]);
  await Promise.all([...volunteers.docs, ...roster.docs].map((d) => deleteDoc(d.ref)));
  await deleteDoc(docRef("volunteerSignups", id));
}

// ── Volunteers ───────────────────────────────────────────────────────
export async function listVolunteers(id) {
  const rows = PREVIEW
    ? readPreview().volunteers[id] || []
    : (await getDocs(volunteersCol(id))).docs.map((d) => ({ id: d.id, ...d.data(), createdAt: millis(d.data().createdAt) }));
  return [...rows].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export async function addVolunteer(id, positionId, { name, email, phone }, addedBy) {
  if (PREVIEW) {
    const store = readPreview();
    store.volunteers[id] = [...(store.volunteers[id] || []), { id: previewId("v"), positionId, name, email, phone, createdAt: Date.now() }];
    const counts = store.signups[id].filledCounts || {};
    store.signups[id].filledCounts = { ...counts, [positionId]: (counts[positionId] || 0) + 1 };
    writePreview(store);
    return;
  }
  const batch = writeBatch(db);
  const ref = doc(volunteersCol(id));
  batch.set(ref, { positionId, name, email, phone, addedBy: addedBy.uid, createdAt: serverTimestamp() });
  batch.set(doc(rosterCol(id), ref.id), { positionId, name, createdAt: serverTimestamp() });
  batch.update(docRef("volunteerSignups", id), { [`filledCounts.${positionId}`]: increment(1) });
  await batch.commit();
}

export async function removeVolunteer(id, volunteer) {
  if (PREVIEW) {
    const store = readPreview();
    store.volunteers[id] = (store.volunteers[id] || []).filter((v) => v.id !== volunteer.id);
    const counts = store.signups[id].filledCounts || {};
    store.signups[id].filledCounts = { ...counts, [volunteer.positionId]: Math.max(0, (counts[volunteer.positionId] || 0) - 1) };
    writePreview(store);
    return;
  }
  const batch = writeBatch(db);
  batch.delete(doc(volunteersCol(id), volunteer.id));
  batch.delete(doc(rosterCol(id), volunteer.id));
  batch.update(docRef("volunteerSignups", id), { [`filledCounts.${volunteer.positionId}`]: increment(-1) });
  await batch.commit();
}

// ── Public roster ────────────────────────────────────────────────────
// Names only: [{ id, positionId, name }], oldest first.
export async function listRoster(id) {
  const rows = PREVIEW
    ? (readPreview().volunteers[id] || []).map(({ id: volunteerId, positionId, name, createdAt }) => ({ id: volunteerId, positionId, name, createdAt }))
    : (await getDocs(rosterCol(id))).docs.map((d) => ({ id: d.id, ...d.data(), createdAt: millis(d.data().createdAt) }));
  return [...rows].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

// Leaders only: make the public roster match the volunteer list. Covers
// volunteers added before the roster existed; normally there is nothing to do.
export async function syncRoster(id, volunteers) {
  if (PREVIEW) return;
  const snap = await getDocs(rosterCol(id));
  const listed = new Map(snap.docs.map((d) => [d.id, d.data()]));
  const batch = writeBatch(db);
  let changes = 0;
  for (const volunteer of volunteers) {
    const entry = listed.get(volunteer.id);
    if (!entry || entry.name !== volunteer.name || entry.positionId !== volunteer.positionId) {
      batch.set(doc(rosterCol(id), volunteer.id), { positionId: volunteer.positionId, name: volunteer.name, createdAt: entry?.createdAt || serverTimestamp() });
      changes++;
    }
    listed.delete(volunteer.id);
  }
  for (const orphanId of listed.keys()) {
    batch.delete(doc(rosterCol(id), orphanId));
    changes++;
  }
  if (changes > 0) await batch.commit();
}

// ── Self-signup (public page) ────────────────────────────────────────
// The volunteer doc's ID is the SHA-256 of a random secret that stays in the
// visitor's browser. That secret is what lets them — and only them — cancel.
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Returns { volunteerId, secret } for the browser to remember.
export async function selfSignup(id, positionId, { name, email, phone }) {
  const secret = randomSecret();
  const volunteerId = await sha256Hex(secret);

  if (PREVIEW) {
    const store = readPreview();
    const signup = store.signups[id];
    const position = signup?.positions.find((p) => p.id === positionId);
    const count = signup?.filledCounts?.[positionId] || 0;
    if (!position || signup.status !== "open" || count >= position.spotsNeeded) {
      throw Object.assign(new Error("spot unavailable"), { code: "permission-denied" });
    }
    store.volunteers[id] = [...(store.volunteers[id] || []), { id: volunteerId, positionId, name, email, phone, source: "self", createdAt: Date.now() }];
    signup.filledCounts = { ...signup.filledCounts, [positionId]: count + 1 };
    writePreview(store);
    return { volunteerId, secret };
  }

  const batch = writeBatch(db);
  batch.set(doc(volunteersCol(id), volunteerId), { positionId, name, email, phone, source: "self", createdAt: serverTimestamp() });
  batch.set(doc(rosterCol(id), volunteerId), { positionId, name, createdAt: serverTimestamp() });
  batch.update(docRef("volunteerSignups", id), { [`filledCounts.${positionId}`]: increment(1), lastVolunteerId: volunteerId });
  await batch.commit();
  return { volunteerId, secret };
}

export async function cancelSelfSignup(id, { volunteerId, secret, positionId }) {
  if (PREVIEW) {
    const store = readPreview();
    const existed = (store.volunteers[id] || []).some((v) => v.id === volunteerId);
    store.volunteers[id] = (store.volunteers[id] || []).filter((v) => v.id !== volunteerId);
    if (existed && store.signups[id]) {
      const counts = store.signups[id].filledCounts || {};
      store.signups[id].filledCounts = { ...counts, [positionId]: Math.max(0, (counts[positionId] || 0) - 1) };
    }
    writePreview(store);
    return;
  }

  const batch = writeBatch(db);
  batch.delete(doc(volunteersCol(id), volunteerId));
  batch.delete(doc(rosterCol(id), volunteerId));
  batch.update(docRef("volunteerSignups", id), {
    [`filledCounts.${positionId}`]: increment(-1),
    lastVolunteerId: volunteerId,
    cancelProof: secret,
  });
  await batch.commit();
}
