const crypto = require("crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp }      = require("firebase-admin/app");
const { getAuth }            = require("firebase-admin/auth");  // Pataisyti veliau, kad siustu password naujam useriui 
const { getMessaging }       = require("firebase-admin/messaging");
const { getFirestore }       = require("firebase-admin/firestore");

initializeApp();

async function requireAdmin(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");
  const snap = await getFirestore().collection("users").doc(request.auth.uid).get();
  const role = snap.data()?.role;
  if (role !== "admin" && role !== "superadmin")
    throw new HttpsError("permission-denied", "Admin access required.");
}

const ALLOWED_ORIGINS = ["https://solarradar-8882e.web.app", "https://solarradar-8882e.firebaseapp.com"];

// Sukuria Auth useri
exports.createAuthUser = onCall(
  { region: "europe-west1", cors: ALLOWED_ORIGINS, invoker: "public" },
  async (request) => {
    await requireAdmin(request);

    const { email } = request.data;
    if (!email) throw new HttpsError("invalid-argument", "email is required.");

    const tempPassword = "Tmp@" + crypto.randomBytes(10).toString("base64url");

    try {
      const user = await getAuth().createUser({ email, password: tempPassword });
      return { uid: user.uid };
    } catch (err) {
      if (err.code === "auth/email-already-exists")
        throw new HttpsError("already-exists", "This email is already in use.");
      throw new HttpsError("internal", err.message);
    }
  }
);

// istrina Auth useri
exports.deleteAuthUser = onCall(
  { region: "europe-west1", cors: ALLOWED_ORIGINS, invoker: "public" },
  async (request) => {
    await requireAdmin(request);

    const { uid } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required.");

    if (uid === request.auth.uid)
      throw new HttpsError("failed-precondition", "Cannot delete your own account.");

    const targetSnap = await getFirestore().collection("users").doc(uid).get();
    if (targetSnap.data()?.role === "superadmin")
      throw new HttpsError("permission-denied", "Cannot delete a superadmin account.");

    try {
      await getAuth().deleteUser(uid);
      return { success: true };
    } catch (err) {
      if (err.code !== "auth/user-not-found") throw new HttpsError("internal", err.message);
      return { success: true };
    }
  }
);

// Cloud messages siuncia visim admin
async function notifyAdmins({ title, body, link, reportId }) {
  const db = getFirestore();

  const snap = await db
    .collection("users")
    .where("role", "in", ["admin", "superadmin"])
    .get();

  const tokens = [];
  snap.forEach((d) => {
    const arr = d.data().fcmTokens;
    if (Array.isArray(arr)) tokens.push(...arr);
  });

  if (tokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        icon:  "/favicon.ico",
        badge: "/favicon.ico",
        tag:   reportId || "solarradar",
      },
      fcmOptions: { link },
    },
  });

  // tokenu trinims
  const dead = new Set();
  response.responses.forEach((r, i) => { if (!r.success) dead.add(tokens[i]); });
  if (dead.size === 0) return;

  for (const d of snap.docs) {
    const arr = d.data().fcmTokens;
    if (!Array.isArray(arr)) continue;
    const cleaned = arr.filter((t) => !dead.has(t));
    if (cleaned.length !== arr.length) await d.ref.update({ fcmTokens: cleaned });
  }
}

// archivu trinimas (14 dienu)
exports.cleanupArchivedJobs = onSchedule(
  { schedule: "0 3 * * *", timeZone: "Europe/Vilnius", region: "europe-west1" },
  async () => {
    const db = getFirestore();
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const snap = await db
      .collection("jobs")
      .where("archived", "==", true)
      .where("archivedAt", "<", cutoff)
      .get();

    if (snap.empty) return;

    const BATCH_SIZE = 490;
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    console.log(`cleanupArchivedJobs: deleted ${snap.size} expired job(s).`);
  }
);

// reportai is appso 
exports.notifyAdminOnReportSubmit = onDocumentCreated(
  { document: "reports/{reportId}", region: "europe-west1" },
  async (event) => {
    const report = event.data.data();
    await notifyAdmins({
      title:    "New report submitted",
      body:     `${report.technicianName || "Technician"} submitted a report for ${report.jobTitle || "a job"}`,
      link:     `/reports/${event.params.reportId}`,
      reportId: event.params.reportId,
    });
  }
);

// appso userio reporto editas
exports.notifyAdminOnReportEdit = onDocumentUpdated(
  { document: "reports/{reportId}", region: "europe-west1" },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // siuncia jei keiciasi editedAt

    // Pakeisti su listeneriu veliau
    const tsBefore = before.editedAt?.toMillis?.() ?? null;
    const tsAfter  = after.editedAt?.toMillis?.()  ?? null;
    if (!tsAfter || tsAfter === tsBefore) return;

    await notifyAdmins({
      title:    "Report edited",
      body:     `${after.technicianName || "Technician"} edited their report for ${after.jobTitle || "a job"}`,
      link:     `/reports/${event.params.reportId}`,
      reportId: event.params.reportId,
    });
  }
);
