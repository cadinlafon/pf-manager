// Wraps ../firestore.rules.leaders into a complete rules file for the local
// emulator. (The real project's rules also contain the PF Audio App's rules,
// which is why the PF Management rules are kept as a paste-in fragment.)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fragment = readFileSync(join(here, "..", "firestore.rules.leaders"), "utf8");

writeFileSync(
  join(here, "firestore.rules"),
  `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Stand-in for the PF Audio App's users rules.
    match /users/{userId} {
      allow read: if request.auth != null;
    }

${fragment}
  }
}
`
);
console.log("Wrote emulator/firestore.rules");

const storageFragment = readFileSync(join(here, "..", "storage.rules.leaders"), "utf8");
writeFileSync(
  join(here, "storage.rules"),
  `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
${storageFragment}
  }
}
`
);
console.log("Wrote emulator/storage.rules");
