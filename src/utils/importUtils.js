import ExcelJS from "exceljs";
import {
  collection,
  serverTimestamp,
  writeBatch,
  doc,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";

export const SITES_HEADERS  = ["name", "address", "region", "capacityKw", "status"];
export const MEMBERS_HEADERS = ["displayName", "email", "hiredAt", "active", "expertise"];

export const VALID_REGIONS = [
  "Alytus","Druskininkai","Kaunas","Klaipėda","Marijampolė",
  "Mažeikiai","Panevėžys","Plungė","Šiauliai","Tauragė","Telšiai","Utena","Vilnius",
];
export const VALID_EXPERTISE = ["electrician", "inv_elect", "mount_spec", "panel_spec"];

// excel template parsisiuntimas --------------------

export async function downloadTemplate(type) {
  const headers = type === "sites" ? SITES_HEADERS : MEMBERS_HEADERS;
  const examples = type === "sites"
    ? [["Saules Parkas", "Kauno g. 1, Kaunas", "Kaunas", 250, "active"]]
    : [["Jonas Jonaitis", "jonas@example.com", "2023-01-15", "true", "electrician,mount_spec"]];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(type === "sites" ? "Sites" : "Members");
  ws.addRow(headers);
  examples.forEach((row) => ws.addRow(row));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}_template.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// file parsing ---------------------

export async function parseFile(file) {
  try {
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();

    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = new TextDecoder().decode(buffer);
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return [];
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
      return lines.slice(1).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      });
    }

    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("No worksheet found.");

    const headers = [];
    const rows = [];
    ws.eachRow((row, rowNum) => {
      const vals = row.values.slice(1).map((v) =>
        v === null || v === undefined ? "" : String(v)
      );
      if (rowNum === 1) {
        headers.push(...vals);
      } else {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        rows.push(obj);
      }
    });
    return rows;
  } catch {
    throw new Error("Could not read file. Make sure it is a valid CSV or Excel file.");
  }
}

// validacija -------------------------------

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

// tikrinimas pagal ID 01,02.... ------------------------------------

async function reserveIds(counterName, count) {
  const counterRef = doc(db, "counters", counterName);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().value : 0;
    tx.set(counterRef, { value: current + count });
    return current + 1;
  });
}

// importai is firestore batch

const BATCH_SIZE = 490;

export async function importSites(rows) {
  let startId = await reserveIds("sites", rows.length);
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

export async function importMembers(rows, existingEmails) {
  const emailSet = new Set((existingEmails || []).map((e) => e.toLowerCase()));

  const newRows = rows.filter((row) => !emailSet.has(String(row.email || "").trim().toLowerCase()));
  const skipped = rows.length - newRows.length;

  let startNum = newRows.length > 0 ? await reserveIds("members", newRows.length) : 1;

  let imported = 0;
  const errors = [];

  for (let i = 0; i < newRows.length; i += BATCH_SIZE) {
    const chunk = newRows.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const row of chunk) {
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
          email: String(row.email || "").trim().toLowerCase(),
          role: "technician",
          active: String(row.active).toLowerCase() !== "false",
          hiredAt: String(row.hiredAt || "").trim() || null,
          expertise,
          photoUrl: null,
          createdAt: serverTimestamp(),
        });
        imported++;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e.message}`);
      }
    }
    await batch.commit();
  }
  return { imported, skipped, errors };
}
