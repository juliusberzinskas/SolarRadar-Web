const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
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

// ── HTTP: delete Firebase Auth user ──────────────────────────────────────────
exports.deleteAuthUser = onRequest(
  { region: "europe-west1", cors: true },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
    const { uid } = req.body;
    if (!uid) { res.status(400).json({ error: "Missing uid" }); return; }
    try {
      await getAuth().deleteUser(uid);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error("deleteAuthUser error:", err);
      res.status(500).json({ error: err.message });
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
