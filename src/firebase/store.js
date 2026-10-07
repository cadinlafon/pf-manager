import { addDoc, deleteDoc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { col, docRef } from "./collections";
import { PREVIEW } from "../lib/preview";

// A plain list-of-records collection (inventory, finance ledger, email list):
// list everything, add, edit, delete. `name` is a key of COLLECTIONS.
//
// In dev preview mode there is no signed-in user, so records are kept in this
// browser's localStorage instead and never touch Firestore.
export function makeStore(name) {
  const previewKey = `pf-leaders-preview-${name}`;
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(previewKey)) || [];
    } catch {
      return [];
    }
  };
  const write = (rows) => localStorage.setItem(previewKey, JSON.stringify(rows));
  const millis = (value) => (typeof value?.toMillis === "function" ? value.toMillis() : value ?? null);

  return {
    async list() {
      if (PREVIEW) return read();
      const snap = await getDocs(col(name));
      return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: millis(d.data().createdAt) }));
    },
    async create(data, createdBy) {
      if (PREVIEW) {
        write([...read(), { id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...data, createdAt: Date.now() }]);
        return;
      }
      await addDoc(col(name), { ...data, createdBy: createdBy.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    },
    async update(id, data) {
      if (PREVIEW) {
        write(read().map((row) => (row.id === id ? { ...row, ...data } : row)));
        return;
      }
      await updateDoc(docRef(name, id), { ...data, updatedAt: serverTimestamp() });
    },
    async remove(id) {
      if (PREVIEW) {
        write(read().filter((row) => row.id !== id));
        return;
      }
      await deleteDoc(docRef(name, id));
    },
  };
}

export const inventoryStore = makeStore("inventory");
export const transactionStore = makeStore("transactions");
export const emailListStore = makeStore("emailList");
// Groups of people: { name, description, memberIds: [id from leaderPeople] }.
export const groupStore = makeStore("groups");
