import { getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { docRef } from "./collections";
import { PREVIEW } from "../lib/preview";

// Church details shown in Settings: one shared document, leaderConfig/church.
// Any leader can read it; main admins can change it.
//
// In dev preview mode it is kept in this browser's localStorage instead.
const DOC = "church";
const PREVIEW_KEY = "pf-leaders-preview-church";
export const EMPTY_CHURCH = { name: "Palouse Fellowship", address: "", phone: "", email: "", website: "" };

export async function getChurchInfo() {
  if (PREVIEW) {
    try {
      return { ...EMPTY_CHURCH, ...JSON.parse(localStorage.getItem(PREVIEW_KEY)) };
    } catch {
      return EMPTY_CHURCH;
    }
  }
  const snap = await getDoc(docRef("config", DOC));
  return { ...EMPTY_CHURCH, ...(snap.exists() ? snap.data() : {}) };
}

export async function saveChurchInfo({ name, address, phone, email, website }, updatedBy) {
  const info = { name, address, phone, email, website };
  if (PREVIEW) {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(info));
    return;
  }
  await setDoc(docRef("config", DOC), { ...info, updatedBy: updatedBy.uid, updatedAt: serverTimestamp() });
}
