import { deleteDoc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { docRef } from "./collections";
import { PREVIEW } from "../lib/preview";

// The connected church calendar is one shared document, leaderConfig/googleCalendar,
// so every leader sees the same calendar. Main admins connect/disconnect it.
//
// In dev preview mode there is no signed-in user, so it is kept in this
// browser's localStorage instead and never touches Firestore.
const DOC = "googleCalendar";
const PREVIEW_KEY = "pf-leaders-preview-calendar";

export async function getCalendarConfig() {
  if (PREVIEW) {
    try {
      return JSON.parse(localStorage.getItem(PREVIEW_KEY));
    } catch {
      return null;
    }
  }
  const snap = await getDoc(docRef("config", DOC));
  return snap.exists() ? snap.data() : null;
}

export async function saveCalendarConfig({ calendarIds, timezone }, connectedBy) {
  const config = { calendarIds, timezone, connectedBy: connectedBy.uid, connectedByName: connectedBy.name };
  if (PREVIEW) {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(config));
    return;
  }
  await setDoc(docRef("config", DOC), { ...config, connectedAt: serverTimestamp() });
}

export async function clearCalendarConfig() {
  if (PREVIEW) {
    localStorage.removeItem(PREVIEW_KEY);
    return;
  }
  await deleteDoc(docRef("config", DOC));
}
