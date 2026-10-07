# PF Management

Palouse Fellowship Management — a private admin app for church managers.

Everything in the app saves to Firestore. There is no sample data.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5280 and sign in with a manager account.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on port 5280, using the real Firebase project |
| `npm run dev:preview` | Dev server with a stand-in manager and no sign-in; data stays in the browser (development only) |
| `npm run emulators` | Start local Firebase emulators with the security rules loaded |
| `npm run emulators:seed` | Create the test accounts in the emulators |
| `npm run dev:emulators` | Dev server on port 5292 pointed at the emulators |
| `npm run test:rules` | Run the security-rules tests |
| `npm run build` | Production build into `dist/` |

## Settings (`.env`)

Copy `.env.example` to `.env`. Restart the dev server or rebuild after changing a value.

| Setting | Effect |
| --- | --- |
| `VITE_FINANCE_ENABLED` | `false` shows Finance in the menu as "Unavailable" and blocks the page. Anything else (or unset) keeps it on. |
| `VITE_APP_URL` | Base address used in invitation, form and volunteer links. Defaults to wherever the app is open. |

## What's in the app

| Page | What it does | Firestore |
| --- | --- | --- |
| Dashboard | Counts, upcoming calendar events, volunteer signups that need people, latest announcements | — |
| Calendar | The church's public Google Calendar, embedded | `leaderConfig/googleCalendar` |
| Finance | A hand-kept ledger of income and expenses, with a quick form for recording tithes | `leaderTransactions` |
| People | Directory (name, email, member status, address) with three views: All People, Members (status is Member), and Groups you put people into | `leaderPeople`, `leaderGroups` |
| Inventory | Equipment and supplies | `leaderInventory` |
| Saved | Resource library: links, notes, and uploaded documents, images and files, each Personal, Managers or Main Admins only; personal favorites, pinning, recently opened | `leaderSaved`, `leaderSavedUsers/{uid}`; files in Storage at `leaderSaved/{id}/` |
| Signup Forms | Build a form, share `/form/{ending}`, collect submissions | `leaderForms/{slug}` + `submissions` |
| Volunteers | Signup sheets with positions; public page `/volunteer/{id}` with self-signup | `volunteerSignups/{id}` + `volunteers`, `roster` |
| Announcements | Posts to all managers, with comments and one attachment; feeds the notification bell | `leaderAnnouncements/{id}` + `comments` |
| Email List | Contacts, with copy-all and CSV export | `leaderEmailList` |
| Settings | Church information, your account, managers and invitations, calendar connection, theme | `leaderConfig/church`, `leaders`, `invitations` |

Not included, because each needs a server component this app doesn't have: bank connections, Mailchimp sync, and automatic emails (volunteer confirmations and reminders). The email list exports a CSV with the column names Mailchimp imports.

## Firebase

PF Management uses the **same Firebase project as the PF Audio App** (`palousefellowshipsermonapp`), configured in `src/firebase/config.js`. Managers sign in with their existing account.

Because the audio app allows public sign-up on that project, signing in is not enough. `src/context/AuthContext.jsx` only lets an account in if it is:

- an audio app admin (`users/{uid}.role == "admin"`) — these are Main Admins, or
- listed in `leaders/{uid}` (added by accepting an invitation).

Everyone else sees a "no manager access" screen.

### Security rules — required

There are two rule files, one per Firebase service. Both are fragments to paste into the Firebase console, because the project's rules also hold the PF Audio App's rules. Do not replace the existing rules with either file.

| File | Paste inside | Console page |
| --- | --- | --- |
| `firestore.rules.leaders` | `match /databases/{database}/documents { ... }` | Firestore → Rules |
| `storage.rules.leaders` | `match /b/{bucket}/o { ... }` | Storage → Rules |

Both need `rules_version = '2';` as the first line. The Storage rules read Firestore to check who is a manager and who may see each file; the console asks once for permission to allow that.

Until the Firestore rules are published the app can't save anything (or, if the project's current rules are open, data isn't protected). Until the Storage rules are published, uploads in Saved won't work.

### Deploying

The app is published at **https://pfmanagment.web.app**, a second Hosting site (`pfmanagment`) in the same Firebase project.

```bash
npm run deploy
```

That builds and publishes to that one site only. `firebase.json` contains nothing but that Hosting site, so a deploy from this folder cannot touch the PF Audio App's site or the project's Firestore rules. Keep it that way: don't add a `firestore` section here, because the project's rules also contain the audio app's rules (see above).

The build bakes in the values from `.env`, so check them before deploying.

### Invitations

Main admins invite managers from Settings → Managers. That creates `invitations/{token}` (a random 64-character token, valid 7 days) and emails the link through EmailJS (`src/config/emailjs.js`; the template uses `{{to_name}}`, `{{to_email}}`, `{{invite_url}}`, and its "To Email" field must be `{{to_email}}`). The invitee opens `/invite/{token}`, sets a password, and gets a `leaders/{uid}` record. If their email already has a PF Audio App account they confirm that password instead. If the email fails to send, the link is shown so it can be passed on by hand.

### Saved files

Uploaded files follow the visibility of their resource: the Storage rules look up `leaderSaved/{id}` and only let the same people open the file who can see that record. Nobody, including a main admin, can open another manager's Personal resource. Files are limited to 25 MB, and programs and web pages are refused.

The app never stores a file's download link. A Firebase download link works for anyone who has it, so one is requested only at the moment a permitted manager opens the file. "Copy Link" copies the in-app address (`/saved/{id}`), which requires sign-in and permission.

### Manager details

Each manager's name, phone, email and role are on `leaders/{uid}`. A manager can change their own name and phone from Settings → Account; a main admin can change another manager's name, phone and role from Settings → Managers. The email is the sign-in address and isn't editable in the app. Main admins who came in through the PF Audio App get a `leaders/{uid}` record the first time they save their details.

### Volunteer self-signup

Anyone with a signup's public link can take an open spot without an account, and cancel from the same browser if the signup allows it. Names of who signed up are public on that page (`roster`); emails and phone numbers are leader-only (`volunteers`). The rules only let a visitor add one volunteer and raise that position's count by one, together, while the signup is open and the position has room; cancelling requires a secret kept in the visitor's browser.

## Testing locally

The emulators give you a throwaway Firebase on this computer, with the real security rules enforced and nothing touching church data.

```bash
npm run emulators        # terminal 1
npm run emulators:seed   # terminal 2, once the emulators are up
npm run dev:emulators    # then open http://localhost:5292
```

Test accounts are listed in `emulator/seed.mjs`. Emulator data is erased when the emulators stop.

`npm run test:rules` runs `emulator/rules.test.mjs`, which checks what managers, non-managers and the public can and can't do in both Firestore and Storage. Run it after changing either rules file.

## Structure

```
src/
├── components/
│   ├── calendar/      Embedded calendar, connect dialog
│   ├── forms/         Signup form field renderer
│   ├── layout/        AppLayout, TopBar
│   ├── navigation/    Sidebar (desktop), BottomNav (mobile), navItems
│   ├── routing/       ProtectedRoute
│   ├── saved/         Resource card, add/edit dialog, file preview
│   ├── ui/            Button, Card, Modal, form fields, loading/empty/error states
│   └── volunteers/    Signup card, position editor, status badge, progress bar
├── config/            EmailJS IDs
├── context/           Auth, theme, announcements (live list + unread tracking)
├── firebase/          config, collection names, and one data module per feature
├── hooks/             useQuery, useCalendarConfig
├── lib/               Feature switches, formatting, forms/volunteers/calendar logic
├── pages/             One file per route
└── styles/            tokens.css (colors, light/dark), app.css
emulator/              Local emulator config, seed script, rules tests
firestore.rules.leaders
storage.rules.leaders
```
