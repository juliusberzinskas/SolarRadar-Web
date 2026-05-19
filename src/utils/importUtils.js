import * as XLSX from "xlsx";
import {
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

export const SITES_HEADERS  = ["name", "address", "region", "capacityKw", "status"];
export const MEMBERS_HEADERS = ["displayName", "email", "hiredAt", "active", "expertise"];

export const VALID_REGIONS = [
  "Alytus","Druskininkai","Kaunas","Klaipėda","Marijampolė",
  "Mažeikiai","Panevėžys","Plungė","Šiauliai","Tauragė","Telšiai","Utena","Vilnius",
];
export const VALID_EXPERTISE = ["electrician", "inv_elect", "mount_spec", "panel_spec"];

// ── Template download ─────────────────────────────────────────────────────────

export function downloadTemplate(type) {
  const headers = type === "sites" ? SITES_HEADERS : MEMBERS_HEADERS;
  const examples = type === "sites"
    ? [["Saules Parkas", "Kauno g. 1, Kaunas", "Kaunas", 250, "active"]]
    : [["Jonas Jonaitis", "jonas@example.com", "2023-01-15", "true", "electrician,mount_spec"]];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type === "sites" ? "Sites" : "Members");
  XLSX.writeFile(wb, `${type}_template.xlsx`);
}

// ── File parsing ──────────────────────────────────────────────────────────────

export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        resolve(rows);
      } catch {
        reject(new Error("Could not read file. Make sure it is a valid CSV or Excel file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateSiteRow(row, idx) {
  const errors = [];
  if (!String(row.name || "").trim()) errors.push("name is required");
  if (!String(row.address || "").trim()) errors.push("address is required");
  if (row.region && !VALID_REGIONS.includes(String(row.region).trim()))
    errors.push(`region "${row.region}" is not valid`);
  const cap = parseFloat(row.capacityKw);
  if (row.capacityKw !== "" && (isNaN(cap) || cap <= 0))
    errors.push("capacityKw must be a positive number");
  if (row.status && !["active", "inactive"].includes(String(row.status).trim()))
    errors.push('status must be "active" or "inactive"');
  return errors.length ? { row: idx + 1, errors } : null;
}

export function validateMemberRow(row, idx) {
  const errors = [];
  if (!String(row.displayName || "").trim()) errors.push("displayName is required");
  if (!String(row.email || "").trim()) errors.push("email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email).trim()))
    errors.push("email format is invalid");
  if (row.hiredAt && !/^\d{4}-\d{2}-\d{2}$/.test(String(row.hiredAt).trim()))
    errors.push("hiredAt must be YYYY-MM-DD format");
  if (row.expertise) {
    const keys = String(row.expertise).split(",").map((k) => k.trim()).filter(Boolean);
    const invalid = keys.filter((k) => !VALID_EXPERTISE.includes(k));
    if (invalid.length) errors.push(`invalid expertise keys: ${invalid.join(", ")}`);
  }
  return errors.length ? { row: idx + 1, errors } : null;
}

export function validateRows(type, rows) {
  const fn = type === "sites" ? validateSiteRow : validateMemberRow;
  return rows.map((r, i) => fn(r, i)).filter(Boolean);
}

// ── Sequential ID helpers ─────────────────────────────────────────────────────

async function getNextSiteId() {
  const snap = await getDocs(collection(db, "sites"));
  const nums = snap.docs
    .map((d) => d.data().siteId)
    .filter((id) => /^\d+$/.test(id))
    .map((id) => parseInt(id, 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(3, "0");
}

async function getNextMemberId() {
  const snap = await getDocs(collection(db, "users"));
  const nums = snap.docs
    .map((d) => d.data().memberId)
    .filter((id) => /^SR\d+$/.test(id))
    .map((id) => parseInt(id.slice(2), 10));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `SR${String(next).padStart(2, "0")}`;
}

// ── Firestore batch import ────────────────────────────────────────────────────

const BATCH_SIZE = 490;

export async function importSites(rows) {
  let startId = parseInt(await getNextSiteId(), 10);
  let imported = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const row of chunk) {
      try {
        const siteId = String(startId).padStart(3, "0");
        startId++;
        const ref = doc(collection(db, "sites"));
        batch.set(ref, {
          siteId,
          name: String(row.name || "").trim(),
          address: String(row.address || "").trim(),
          region: String(row.region || "").trim(),
          capacityKw: parseFloat(row.capacityKw) || 0,
          status: ["active", "inactive"].includes(String(row.status).trim())
            ? String(row.status).trim()
            : "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        imported++;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }
    await batch.commit();
  }
  return { imported, errors };
}

export async function importMembers(rows) {
  const snap = await getDocs(collection(db, "users"));
  const existingEmails = new Set(snap.docs.map((d) => d.data().email?.toLowerCase()));

  let startNum = (() => {
    const nums = snap.docs
      .map((d) => d.data().memberId)
      .filter((id) => /^SR\d+$/.test(id))
      .map((id) => parseInt(id.slice(2), 10));
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  })();

  let imported = 0;
  const errors = [];
  const skipped = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const row of chunk) {
      const email = String(row.email || "").trim().toLowerCase();
      if (existingEmails.has(email)) {
        skipped.push(email);
        continue;
      }
      try {
        const memberId = `SR${String(startNum).padStart(2, "0")}`;
        startNum++;
        const expertiseRaw = String(row.expertise || "");
        const expertise = expertiseRaw
          .split(",")
          .map((k) => k.trim())
          .filter((k) => VALID_EXPERTISE.includes(k));

        const ref = doc(collection(db, "users"));
        batch.set(ref, {
          memberId,
          displayName: String(row.displayName || "").trim(),
          email,
          role: "technician",
          active: String(row.active).toLowerCase() !== "false",
          hiredAt: String(row.hiredAt || "").trim() || null,
          expertise,
          photoUrl: null,
          createdAt: serverTimestamp(),
        });
        existingEmails.add(email);
        imported++;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }
    await batch.commit();
  }
  return { imported, skipped: skipped.length, errors };
}
