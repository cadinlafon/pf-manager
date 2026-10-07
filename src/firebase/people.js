import { addDoc, deleteDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { col, docRef } from "./collections";
import { PREVIEW } from "../lib/preview";

// The church's people directory: leaderPeople/{id} = { name, email, status, address }.
//
// In dev preview mode there is no signed-in user, so people are kept in this
// browser's localStorage instead and never touch Firestore.

export const PEOPLE_STATUSES = ["Member", "Regular Attender", "Visitor", "Inactive"];

const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ?? null);

const PREVIEW_KEY = "pf-leaders-preview-people";
function readPreview() {
  try {
    return JSON.parse(localStorage.getItem(PREVIEW_KEY)) || [];
  } catch {
    return [];
  }
}
const writePreview = (people) => localStorage.setItem(PREVIEW_KEY, JSON.stringify(people));

export async function listPeople() {
  if (PREVIEW) return readPreview();
  const snap = await getDocs(col("people"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: millis(d.data().createdAt) }));
}

export async function createPerson(person, createdBy) {
  if (PREVIEW) {
    writePreview([...readPreview(), { id: `p${Date.now()}`, ...person, createdAt: Date.now() }]);
    return;
  }
  await addDoc(col("people"), { ...person, createdBy: createdBy.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}

export async function updatePerson(id, person) {
  if (PREVIEW) {
    writePreview(readPreview().map((row) => (row.id === id ? { ...row, ...person } : row)));
    return;
  }
  await updateDoc(docRef("people", id), { ...person, updatedAt: serverTimestamp() });
}

export async function deletePerson(id) {
  if (PREVIEW) {
    writePreview(readPreview().filter((row) => row.id !== id));
    return;
  }
  await deleteDoc(docRef("people", id));
}
