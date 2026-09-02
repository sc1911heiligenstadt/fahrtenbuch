// Gateway-Zugriff für extern.html: KEIN Bearer-Token (kein Login möglich),
// stattdessen ein Zugriffscode, der bei jedem Call im Body mitgeschickt wird.
// Bewusst eigenständig statt in db.js integriert: db.js ist laut CLAUDE.md eine
// 1:1-Kopiervorlage für andere Gateway-Apps — fahrtenbuch-spezifische,
// code-basierte Funktionen würden diese Copy-Paste-Eigenschaft brechen.
const GATEWAY_URL = "https://landingpage.michel-brunner.workers.dev"; // muss zu db.js passen
const EXTERN_CODE_STORAGE_KEY = "fahrtenbuch_extern_code";

class WrongCodeError extends Error {
  constructor(message) {
    super(message || "Falscher Zugriffscode");
    this.name = "WrongCodeError";
  }
}

function getExternCode() {
  try { return localStorage.getItem(EXTERN_CODE_STORAGE_KEY) || ""; } catch (_) { return ""; }
}
function setExternCode(code) {
  try { localStorage.setItem(EXTERN_CODE_STORAGE_KEY, code); } catch (_) {}
}

// 1:1 aus db.js (blobToBase64).
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || "");
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    r.readAsDataURL(blob);
  });
}

async function externRequest(payload) {
  let resp;
  try {
    resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    throw new Error("Server nicht erreichbar. Bitte Internetverbindung prüfen.");
  }
  if (resp.status === 403) {
    let detail = "Falscher Zugriffscode";
    try { const b = await resp.json(); if (b && b.error) detail = b.error; } catch (_) {}
    throw new WrongCodeError(detail);
  }
  if (!resp.ok) {
    let detail = "";
    try { const b = await resp.json(); if (b && b.error) detail = ": " + b.error; } catch (_) {}
    throw new Error(`Gateway-Fehler (HTTP ${resp.status})${detail}`);
  }
  return resp.json();
}

// Nutzt die bestehende, unveränderte verify-action-password-Aktion rein für den
// Code-Gate-Screen (sofortiges Feedback, bevor das lange Formular gezeigt wird).
// Ersetzt NICHT die eigene Codeprüfung der drei Schreib-Aktionen unten.
async function externVerifyCode(code) {
  await externRequest({ action: "verify-action-password", scope: "fahrtenbuch-extern", password: code });
  return true; // wirft WrongCodeError bei 403, kommt sonst hier nie mit false an
}

async function externSubmitFahrt(code, fahrt) {
  const body = await externRequest({ action: "fahrtenbuch-extern-submit", code, fahrt });
  return body.id;
}

async function externUploadFoto(code, id, blob, filename, contentType) {
  if (blob.size > MAX_FILE_BYTES) {
    throw new Error("Datei ist zu groß (max. " + Math.round(MAX_FILE_BYTES / 1024 / 1024) + " MB).");
  }
  const dataBase64 = await blobToBase64(blob);
  await externRequest({
    action: "fahrtenbuch-extern-file-put",
    code, id, name: filename, contentType: contentType || "image/jpeg", dataBase64
  });
}

// existingOwner: leer beim ersten Upload; bei Re-Upload/Ersetzen den zuvor vom
// Server erhaltenen Wert mitgeben. Rückgabe ist immer der maßgebliche Owner
// (bei Erst-Upload neu vom Server vergeben).
async function externUploadFuehrerschein(code, existingOwner, blob, contentType) {
  if (blob.size > MAX_FILE_BYTES) {
    throw new Error("Datei ist zu groß (max. " + Math.round(MAX_FILE_BYTES / 1024 / 1024) + " MB).");
  }
  const dataBase64 = await blobToBase64(blob);
  const body = await externRequest({
    action: "fahrtenbuch-extern-fuehrerschein-put",
    code, owner: existingOwner || "",
    contentType: contentType || "application/octet-stream",
    dataBase64
  });
  return body.owner;
}
