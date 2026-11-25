// Orion Tower Manager: Google Drive and Sheets sync
// Paste all of this into Extensions > Apps Script of your "Orion Tower Data" Google Sheet.
// Then replace PASTE-YOUR-KEY-HERE below with the sync key shown in the app (More > Google Drive and Sheets).

const SECRET = "PASTE-YOUR-KEY-HERE";
const FOLDER = "Orion Tower App";

function doGet() { return out({ ok: true, app: "orion-sync", version: 1 }); }

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: "bad request" }); }
  if (!SECRET || SECRET === "PASTE-YOUR-KEY-HERE" || req.key !== SECRET) return out({ ok: false, error: "wrong key" });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (req.action === "pull") return out(pull());
    if (req.action === "push") return out(push(req));
    if (req.action === "putFile") return out(putFile(req));
    if (req.action === "getFile") return out(getFile(req));
    return out({ ok: false, error: "unknown action" });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function folder(name, parent) {
  const p = parent || DriveApp.getRootFolder();
  const it = p.getFoldersByName(name);
  return it.hasNext() ? it.next() : p.createFolder(name);
}

function dataFile() {
  const it = folder(FOLDER).getFilesByName("orion-data.json");
  return it.hasNext() ? it.next() : null;
}

function pull() {
  const f = dataFile();
  if (!f) return { ok: true, data: null };
  return { ok: true, data: JSON.parse(f.getBlob().getDataAsString()), savedAt: f.getLastUpdated().toISOString() };
}

function push(req) {
  const root = folder(FOLDER);
  const txt = JSON.stringify(req.data);
  const f = dataFile();
  if (f) f.setContent(txt); else root.createFile("orion-data.json", txt, "application/json");
  // one backup copy per day, kept in "Daily backups"
  const day = Utilities.formatDate(new Date(), "Asia/Karachi", "yyyy-MM-dd");
  const b = folder("Daily backups", root);
  const it = b.getFilesByName("orion-" + day + ".json");
  if (it.hasNext()) it.next().setContent(txt); else b.createFile("orion-" + day + ".json", txt, "application/json");
  if (req.tables) writeTables(req.tables);
  return { ok: true, savedAt: new Date().toISOString() };
}

function writeTables(tables) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(tables).forEach(function (name) {
    const rows = tables[name];
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clearContents();
    if (!rows || !rows.length) return;
    const w = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    const norm = rows.map(function (r) { const a = r.slice(); while (a.length < w) a.push(""); return a; });
    sh.getRange(1, 1, norm.length, w).setValues(norm);
    sh.getRange(1, 1, 1, w).setFontWeight("bold");
    sh.setFrozenRows(1);
  });
}

function putFile(req) {
  const f = folder("Photos and documents", folder(FOLDER));
  const old = f.getFilesByName(req.name);
  while (old.hasNext()) old.next().setTrashed(true);
  const blob = Utilities.newBlob(Utilities.base64Decode(req.base64), req.mime || "application/octet-stream", req.name);
  const file = f.createFile(blob);
  return { ok: true, fileId: file.getId() };
}

function getFile(req) {
  const b = DriveApp.getFileById(req.fileId).getBlob();
  return { ok: true, mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
}
