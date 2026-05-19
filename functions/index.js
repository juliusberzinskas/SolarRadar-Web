const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp }      = require("firebase-admin/app");
const { getAuth }            = require("firebase-admin/auth");
const { getMessaging }       = require("firebase-admin/messaging");
const { getFirestore }       = require("firebase-admin/firestore");

initializeApp();

// ── Callable: create Firebase Auth user (avoids signing out the current admin) ─
exports.createAuthUser = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

    const { email } = request.data;
    if (!email) throw new HttpsError("invalid-argument", "email is required.");

    const tempPassword =
      "Tmp@" +
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 4).toUpperCase();

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

// ── Callable: delete Firebase Auth user ──────────────────────────────────────
exports.deleteAuthUser = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

    const { uid } = request.data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required.");

    try {
      await getAuth().deleteUser(uid);
      return { success: true };
    } catch (err) {
      console.error("deleteAuthUser error:", err);
      throw new HttpsError("internal", err.message);
    }
  }
);

// ── Shared: send FCM to all admins ────────────────────────────────────────────
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

  // Remove tokens that are no longer valid
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

// ── Scheduled: delete archived jobs older than 14 days (runs daily at 03:00) ──
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

// ── Firestore trigger: new report submitted ───────────────────────────────────
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

// ── Firestore trigger: technician edited a report ─────────────────────────────
exports.notifyAdminOnReportEdit = onDocumentUpdated(
  { document: "reports/{reportId}", region: "europe-west1" },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // Only fire when the technician's editedAt timestamp actually changed
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
