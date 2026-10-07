import { collection, doc } from "firebase/firestore";
import { db } from "./config";

// Firestore layout for PF Management.
//
// This Firebase project is shared with the PF Audio App, which already owns
// `users` (one doc per account, including public listeners). Everything PF
// Leaders adds lives in its own collections so the two apps never collide.
//
//   users/{uid}            EXISTING (audio app). Read-only here: name, role.
//   leaders/{uid}          LIVE. Who may use PF Management. { name, email, role, inviteToken, createdAt }
//   invitations/{token}    LIVE. Leader invites. { name, email, role, status, invitedBy, expiresAt, acceptedAt }
//                          See src/firebase/invitations.js.
//   leaderConfig/{name}    LIVE. Shared settings. `googleCalendar`: { calendarIds, timezone, connectedBy… }
//   leaderForms/{slug}     LIVE. Signup forms; the doc ID is the public link ending.
//     /submissions/{id}    { title, description, fields[], status } / { answers, submittedAt }
//   volunteerSignups/{id}  LIVE. Volunteer signup sheets + /volunteers subcollection.
//                          See src/firebase/volunteers.js.
//   leaderPeople/{id}      LIVE. People directory. { name, email, status, address }
//   leaderInventory/{id}   LIVE. { name, quantity, category, location, notes }
//   leaderTransactions/{id} LIVE. Finance ledger. { date, type, category, description, amount, method, personName, notes }
//   leaderEmailList/{id}   LIVE. { firstName, lastName, email }
//   leaderSaved/{id}       LIVE. Saved resources (links, notes, uploaded files). See src/firebase/saved.js.
//   leaderSavedUsers/{uid} LIVE. Each leader's own favorites + recently opened.
//   leaderConfig/church    LIVE. { name, address, phone, email, website }
//   leaderAnnouncements/{id}  LIVE. { title, body, createdBy, createdByName, createdAt }
//                          (the audio app has its own public announcements)
//
// Every collection needs the rules in firestore.rules.leaders.
export const COLLECTIONS = {
  users: "users",
  leaders: "leaders",
  invitations: "invitations",
  config: "leaderConfig",
  forms: "leaderForms",
  volunteerSignups: "volunteerSignups",
  people: "leaderPeople",
  inventory: "leaderInventory",
  transactions: "leaderTransactions",
  emailList: "leaderEmailList",
  saved: "leaderSaved",
  savedUsers: "leaderSavedUsers",
  announcements: "leaderAnnouncements",
};

export const LEADER_ROLES = {
  main_admin: "Main Admin",
  leader: "Manager",
};

export const col = (name) => collection(db, COLLECTIONS[name]);
export const docRef = (name, id) => doc(db, COLLECTIONS[name], id);
