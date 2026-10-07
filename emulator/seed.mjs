// Creates test accounts in the LOCAL emulators (never the real project).
// Run after `npm run emulators` has started:  npm run emulators:seed
//
// These credentials only exist inside the emulator on this computer.
export const TEST_ACCOUNTS = [
  { email: "admin@test.local", password: "emulator-admin-1", name: "Test Admin", userRole: "admin" },
  { email: "leader@test.local", password: "emulator-leader-1", name: "Test Manager", leaderRole: "leader" },
  { email: "listener@test.local", password: "emulator-listener-1", name: "Test Listener", userRole: "user" },
];

const AUTH = "http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1";
const STORE = "http://127.0.0.1:8787/v1/projects/demo-pf-management/databases/(default)/documents";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json() };
}

for (const account of TEST_ACCOUNTS) {
  let result = await post(`${AUTH}/accounts:signUp?key=demo`, { email: account.email, password: account.password, returnSecureToken: true });
  if (!result.ok) {
    // Already seeded — look the account up instead.
    result = await post(`${AUTH}/accounts:signInWithPassword?key=demo`, { email: account.email, password: account.password, returnSecureToken: true });
  }
  const uid = result.data.localId;
  if (!uid) throw new Error(`Could not create ${account.email}: ${JSON.stringify(result.data)}`);

  const write = async (path, fields) => {
    const res = await fetch(`${STORE}/${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: "Bearer owner" },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: value }])) }),
    });
    if (!res.ok) throw new Error(`Could not write ${path}: ${await res.text()}`);
  };

  // The audio app's users/{uid} doc; role "admin" there is what makes someone a
  // PF Management main admin. An invited leader has a leaders/{uid} doc instead.
  if (account.userRole) await write(`users/${uid}`, { fullName: account.name, email: account.email, role: account.userRole });
  if (account.leaderRole) await write(`leaders/${uid}`, { name: account.name, email: account.email, role: account.leaderRole });
  console.log(`Seeded ${account.email} (${account.userRole || account.leaderRole})`);
}
