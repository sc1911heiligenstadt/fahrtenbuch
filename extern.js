// ---------- 1:1 aus app.js übernommene DOM-Helfer (bei Änderung dort auch hier nachziehen) ----------
// 1:1 wie in app.js — siehe die Begründung dort. Für dieses externe Formular
// zählt es doppelt: es wird typischerweise auf einem beliebigen fremden Handy
// geöffnet, also gerade auch auf altem iOS.
function uuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) +
         "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v == null ? "" : v; }
function collectChecks(target) {
  document.querySelectorAll("#fx-form input[data-check]").forEach((el) => { target[el.dataset.check] = el.checked; });
}

// ---------- State ----------
let currentFahrtId = "";
let editingFotos = [];         // [{id,name,contentType,file}]
let fuehrerscheinFile = null;  // aktuell angehängte Datei (lokal) oder null
let fuehrerscheinMeta = null;  // {name} nur fürs Chip-UI
let fuehrerscheinOwner = "";   // vom Server nach dem ersten Upload vergebener Schlüssel
let signaturePad = null;
let externCode = "";

// Label-Override NUR für die externe Seite — config.js (ANFORDERUNGEN/ALLE_CHECK_KEYS)
// bleibt für die interne Seite unverändert korrekt (Verweis auf Trainerdaten ergibt für
// externe Eltern keinen Sinn, die dort kein Konto haben).
const ANFORDERUNGEN_EXTERN_LABELS = {
  chkFuehrerschein: "Besitz eines gültigen Führerscheins (Kopie im Abschnitt „Führerschein-Kopie“ weiter unten hochladen)"
};
function renderChecksExtern(containerId, defs) {
  document.getElementById(containerId).innerHTML = defs.map((c) => {
    const label = ANFORDERUNGEN_EXTERN_LABELS[c.key] || c.label;
    return `<label class="checkbox-row"><input type="checkbox" data-check="${escapeHtml(c.key)}" required /> <span>${escapeHtml(label)}</span></label>`;
  }).join("");
}

function prepareNewFahrt() {
  currentFahrtId = uuid();
  editingFotos = [];
  fuehrerscheinFile = null;
  fuehrerscheinMeta = null;
  fuehrerscheinOwner = "";
}

// ---------- Code-Gate ----------
async function confirmCode() {
  const code = val("fx-code").trim();
  const errEl = document.getElementById("fx-code-error");
  errEl.textContent = "";
  if (!code) return;
  const btn = document.getElementById("btn-code-confirm");
  btn.disabled = true;
  try {
    await externVerifyCode(code);
    externCode = code;
    setExternCode(code);
    document.getElementById("fx-gate").classList.add("hidden");
    document.getElementById("fx-form").classList.remove("hidden");
    // Canvas ist jetzt sichtbar -> Backing-Bitmap neu setzen (0x0-Falle beim
    // Erzeugen hinter .hidden, siehe signature-pad.js).
    signaturePad.resize();
  } catch (e) {
    errEl.textContent = "Fehler: " + e.message;
  } finally {
    btn.disabled = false;
  }
}

// ---------- Foto-Liste (Mängelfotos) ----------
function renderFotoList() {
  const el = document.getElementById("fx-foto-list");
  if (!editingFotos.length) { el.innerHTML = `<p class="muted" style="margin:0;">Noch keine Fotos.</p>`; return; }
  el.innerHTML = editingFotos.map((f) => `
    <div class="foto-chip" data-foto="${escapeHtml(f.id)}">
      <span class="foto-name">📷 ${escapeHtml(f.name)}</span>
      <button type="button" class="foto-view" data-view-foto="${escapeHtml(f.id)}">ansehen</button>
      <button type="button" class="foto-remove" data-remove-foto="${escapeHtml(f.id)}" title="Entfernen">×</button>
    </div>`).join("");
}
async function addFotos(fileList) {
  const btn = document.getElementById("btn-foto-upload");
  const files = Array.from(fileList || []);
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) { alert(`„${file.name}“ ist zu groß (max. ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB).`); continue; }
    const id = uuid();
    btn.disabled = true; btn.textContent = "Lädt hoch…";
    try {
      await externUploadFoto(externCode, id, file, file.name, file.type || "image/jpeg");
      editingFotos.push({ id, name: file.name, contentType: file.type || "image/jpeg", file });
      renderFotoList();
    } catch (e) {
      alert("Upload fehlgeschlagen: " + e.message);
    } finally {
      btn.disabled = false; btn.textContent = "Foto hinzufügen…";
    }
  }
}
function removeFotoFromEditing(id) {
  if (!confirm("Dieses Foto entfernen?")) return;
  // Bereits hochgeladene Datei bleibt serverseitig liegen (akzeptierte Limitierung,
  // kein Cleanup-Mechanismus ohne Login) — nur die lokale Zuordnung zur Fahrt entfällt.
  editingFotos = editingFotos.filter((f) => f.id !== id);
  renderFotoList();
}

// ---------- Führerschein-Upload ----------
function renderFuehrerscheinChip() {
  const el = document.getElementById("fx-fuehrerschein-list");
  if (!fuehrerscheinMeta) { el.innerHTML = `<p class="muted" style="margin:0;">Noch keine Datei hochgeladen.</p>`; return; }
  el.innerHTML = `
    <div class="foto-chip">
      <span class="foto-name">🪪 ${escapeHtml(fuehrerscheinMeta.name)}</span>
      <button type="button" class="foto-view" id="btn-view-fuehrerschein-local">ansehen</button>
      <button type="button" class="foto-remove" id="btn-remove-fuehrerschein" title="Entfernen">×</button>
    </div>`;
}
async function uploadFuehrerschein(file) {
  const btn = document.getElementById("btn-fuehrerschein-upload");
  btn.disabled = true; btn.textContent = "Lädt hoch…";
  try {
    fuehrerscheinOwner = await externUploadFuehrerschein(externCode, fuehrerscheinOwner, file, file.type || "application/octet-stream");
    fuehrerscheinFile = file;
    fuehrerscheinMeta = { name: file.name };
    renderFuehrerscheinChip();
  } catch (e) {
    alert("Upload fehlgeschlagen: " + e.message);
  } finally {
    btn.disabled = false; btn.textContent = "Führerschein hochladen…";
  }
}
function removeFuehrerschein() {
  if (!confirm("Führerschein-Anhang entfernen?")) return;
  // Owner-Schlüssel bleibt im Speicher (falls direkt neu hochgeladen wird, wird
  // dieselbe Datei ersetzt statt eine zweite verwaist anzulegen) — nur die
  // Zuordnung zur aktuellen Fahrt (fuehrerscheinFile) entfällt.
  fuehrerscheinFile = null;
  fuehrerscheinMeta = null;
  renderFuehrerscheinChip();
}

// ---------- Datei-Viewer (rein lokal, kein Server-Roundtrip nötig) ----------
async function showInViewer(name, contentType, getBlob) {
  const modal = document.getElementById("viewer-modal");
  const body = document.getElementById("viewer-body");
  document.getElementById("viewer-title").textContent = name || "Datei";
  body.innerHTML = `<p class="muted" id="viewer-loading">Wird geladen…</p>`;
  modal.classList.remove("hidden");
  try {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    modal.dataset.objurl = url;
    const ct = contentType || blob.type || "";
    if (/^image\//.test(ct)) {
      body.innerHTML = `<img src="${url}" alt="${escapeHtml(name || "")}" class="viewer-img" />`;
    } else if (ct === "application/pdf") {
      body.innerHTML = `<iframe src="${url}" class="viewer-frame" title="${escapeHtml(name || "")}"></iframe>`;
    } else {
      body.innerHTML = `<a class="btn" href="${url}" download="${escapeHtml(name || "datei")}">Herunterladen</a>`;
    }
  } catch (e) {
    body.innerHTML = `<p class="muted">Datei nicht abrufbar: ${escapeHtml(e.message)}</p>`;
  }
}
function viewLocalFile(file, name, contentType) { return showInViewer(name, contentType, () => Promise.resolve(file)); }
function closeViewer() {
  const modal = document.getElementById("viewer-modal");
  modal.classList.add("hidden");
  if (modal.dataset.objurl) { URL.revokeObjectURL(modal.dataset.objurl); delete modal.dataset.objurl; }
  document.getElementById("viewer-body").innerHTML = "";
}

// ---------- Submit ----------
async function submitFahrt(e) {
  e.preventDefault();
  const fahrerName = val("fx-fahrer").trim();
  const reiseziel = val("fx-reiseziel").trim();
  // Pflichtfelder + Checkboxen prüft der Browser schon vor dem submit-Event (required-
  // Attribute); hier nur noch, was HTML-Validierung nicht abdeckt.
  if (!fahrerName) { alert("Bitte den Namen des Fahrers angeben."); return; }
  if (!reiseziel) { alert("Bitte ein Reiseziel angeben."); return; }
  if (signaturePad.isEmpty()) { alert("Bitte unterschreiben, um die Fahrt einzutragen."); return; }
  if (!fuehrerscheinFile) { alert("Bitte eine Führerschein-Kopie hochladen, um die Fahrt einzutragen."); return; }

  const fahrt = {
    id: currentFahrtId,
    fahrerName, reiseziel,
    kennzeichen: val("fx-kennzeichen").trim(),
    abteilung: val("fx-abteilung").trim(),
    anzahlInsassen: val("fx-insassen").trim(),
    kmStart: val("fx-kmstart").trim(),
    kmEnde: val("fx-kmende").trim(),
    datumStart: val("fx-datumstart"),
    uhrzeitStart: val("fx-uhrzeitstart"),
    datumEnde: val("fx-datumende"),
    uhrzeitEnde: val("fx-uhrzeitende"),
    uebernahmeVon: val("fx-uebernahme").trim(),
    abholort: val("fx-abholort").trim(),
    uebergabeAn: val("fx-uebergabe").trim(),
    abstellort: val("fx-abstellort").trim(),
    maengelText: val("fx-maengel").trim(),
    maengelFotos: editingFotos.map((f) => ({ id: f.id, name: f.name, contentType: f.contentType })),
    unterschriftDataUrl: signaturePad.toDataURL(),
    fuehrerscheinKey: fuehrerscheinFile ? fuehrerscheinOwner : null
  };
  collectChecks(fahrt);

  const btn = document.getElementById("btn-fx-submit");
  btn.disabled = true; btn.textContent = "Wird gesendet…";
  try {
    await externSubmitFahrt(externCode, fahrt);
    showSuccess(fahrt);
  } catch (e) {
    alert("Absenden fehlgeschlagen: " + e.message + "\n\nDie Eingaben bleiben erhalten — bitte erneut versuchen.");
  } finally {
    btn.disabled = false; btn.textContent = "Fahrt eintragen";
  }
}

function showSuccess(fahrt) {
  const rows = [
    ["Fahrer", fahrt.fahrerName],
    ["Kennzeichen", fahrt.kennzeichen || "—"],
    ["Reiseziel", fahrt.reiseziel],
    ["Datum", [fahrt.datumStart, fahrt.datumEnde].filter(Boolean).join(" – ") || "—"],
    ["Kilometerstand", [fahrt.kmStart, fahrt.kmEnde].filter(Boolean).join(" → ") || "—"],
    ["Mängel", fahrt.maengelText || "keine"],
    ["Führerschein-Kopie", fahrt.fuehrerscheinKey ? "hochgeladen" : "nicht hochgeladen"]
  ];
  document.getElementById("fx-success-summary").innerHTML = rows.map(([k, v]) =>
    `<div class="form-field"><label>${escapeHtml(k)}</label><span>${escapeHtml(v)}</span></div>`).join("");
  document.getElementById("fx-form").classList.add("hidden");
  document.getElementById("fx-success").classList.remove("hidden");

  // .onclick statt addEventListener: showSuccess() kann pro Seitenaufruf mehrfach
  // laufen ("Weitere Fahrt eintragen"), .onclick ersetzt den Handler jedes Mal
  // sauber statt Listener für alte fahrt-Objekte anzuhäufen.
  document.getElementById("btn-fx-submit-beleg").onclick = () => {
    const desc = `Fahrt ${fahrt.datumStart || ""} nach ${fahrt.reiseziel || "?"}${fahrt.kennzeichen ? " (" + fahrt.kennzeichen + ")" : ""}`;
    const params = new URLSearchParams({ name: fahrt.fahrerName || "", date: fahrt.datumStart || "", desc, fahrtId: fahrt.id || "" });
    window.open(BELEG_EINGANG_URL + "?" + params.toString(), "_blank");
  };
}

function resetForm() {
  ["fx-kennzeichen", "fx-fahrer", "fx-abteilung", "fx-insassen", "fx-reiseziel", "fx-kmstart", "fx-kmende",
   "fx-datumstart", "fx-uhrzeitstart", "fx-datumende", "fx-uhrzeitende", "fx-uebernahme", "fx-abholort",
   "fx-uebergabe", "fx-abstellort", "fx-maengel"].forEach((id) => setVal(id, ""));
  document.querySelectorAll("#fx-form input[data-check]").forEach((el) => { el.checked = false; });
  prepareNewFahrt();
  renderFotoList();
  renderFuehrerscheinChip();
  signaturePad.resetSilent();
  document.getElementById("fx-success").classList.add("hidden");
  document.getElementById("fx-form").classList.remove("hidden");
  signaturePad.resize();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Start ----------
function init() {
  signaturePad = createSignaturePad(document.getElementById("fx-signature"));
  renderChecksExtern("fx-anforderungen", ANFORDERUNGEN);
  renderChecksExtern("fx-kontrolle-vor", KONTROLLE_VOR);
  renderChecksExtern("fx-kontrolle-nach", KONTROLLE_NACH);
  document.getElementById("fx-hinweis").textContent = HINWEIS_ABSCHLUSS;
  prepareNewFahrt();
  renderFotoList();
  renderFuehrerscheinChip();

  setVal("fx-code", getExternCode());
  document.getElementById("btn-code-confirm").addEventListener("click", confirmCode);
  document.getElementById("fx-code").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); confirmCode(); } });

  document.getElementById("fx-form").addEventListener("submit", submitFahrt);
  document.getElementById("btn-signature-clear").addEventListener("click", () => signaturePad.clear());

  document.getElementById("btn-foto-upload").addEventListener("click", () => document.getElementById("fx-foto-input").click());
  document.getElementById("fx-foto-input").addEventListener("change", (e) => { addFotos(e.target.files); e.target.value = ""; });
  document.getElementById("fx-foto-list").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove-foto]");
    if (rm) { removeFotoFromEditing(rm.dataset.removeFoto); return; }
    const vw = e.target.closest("[data-view-foto]");
    if (vw) { const f = editingFotos.find((x) => x.id === vw.dataset.viewFoto); if (f) viewLocalFile(f.file, f.name, f.contentType); }
  });

  document.getElementById("btn-fuehrerschein-upload").addEventListener("click", () => document.getElementById("fx-fuehrerschein-input").click());
  document.getElementById("fx-fuehrerschein-input").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) uploadFuehrerschein(file);
  });
  document.getElementById("fx-fuehrerschein-list").addEventListener("click", (e) => {
    if (e.target.closest("#btn-remove-fuehrerschein")) { removeFuehrerschein(); return; }
    if (e.target.closest("#btn-view-fuehrerschein-local") && fuehrerscheinFile) {
      viewLocalFile(fuehrerscheinFile, fuehrerscheinMeta.name, fuehrerscheinFile.type);
    }
  });

  document.getElementById("btn-fx-reset").addEventListener("click", resetForm);

  document.getElementById("viewer-close").addEventListener("click", closeViewer);
  document.getElementById("viewer-modal").addEventListener("click", (e) => { if (e.target.id === "viewer-modal") closeViewer(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("viewer-modal").classList.contains("hidden")) closeViewer();
  });
}

// ---------- Info-Tab / Versionshistorie ----------
function activateTab(name) {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.toggle("active", s.id === "tab-" + name));
}

function renderVersionInfo() {
  document.querySelectorAll("#version-badge, #version-badge-2").forEach((el) => { if (el) el.textContent = "v" + APP_VERSION; });
  const list = document.getElementById("changelog-list");
  if (!list) return;
  list.innerHTML = APP_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <div class="cv">Version ${entry.version}</div>
      ${entry.groups.map((g) => `
        <div class="changelog-group">
          <div class="cg-title">${g.title}</div>
          <ul class="cg-items">${g.items.map((i) => `<li>${i}</li>`).join("")}</ul>
        </div>`).join("")}
    </div>`).join("");
}

function setupInfoTab() {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => {
    b.addEventListener("click", () => activateTab(b.dataset.tab));
  });
  renderVersionInfo();
}

document.addEventListener("DOMContentLoaded", () => { init(); setupInfoTab(); });
