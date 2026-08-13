// ---------- Helpers ----------
// Fahrt- und Foto-Ids. Beide gehen an den Worker (dav-file-put, fahrtenbuch-
// belege-list/-beleg-file-get, die extern-Aktionen) und werden dort gegen
// FILE_ID_RE geprüft, das AUSSCHLIESSLICH das UUID-Format akzeptiert. Der
// frühere Fallback ("f" + 8 Hex) war zwar gegen den fehlenden crypto.randomUUID
// abgesichert, lieferte aber kein UUID-Format: auf iOS mit Safari < 15.4 schlug
// der Foto-Upload dadurch mit HTTP 400 fehl, und beim externen Formular fielen
// die Fotos beim Absenden serverseitig still aus dem Datensatz. crypto.getRandom-
// Values gibt es dort seit jeher — daraus bauen wir das Format selbst zusammen:
// 16 Zufallsbytes, Version 4 und Variante gesetzt.
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

const WOCHENTAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function fmtDatum(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  const wd = WOCHENTAGE_KURZ[d.getDay()];
  return `${wd}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function fmtTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}
const STATUS_LABEL = { offen: "offen", abgeschlossen: "abgeschlossen" };
const STATUS_FARBE = { offen: "#c9941f", abgeschlossen: "#2d8c4e" };

// ---------- State ----------
let appData = { meta: {}, fahrten: [] };
let currentUser = null;
let currentTab = "fahrten";

let editingFahrtId = null;           // null = neue Fahrt
let editingFotos = [];               // [{id,name,contentType}] – Arbeitskopie
let originalFotoIds = [];            // Foto-Ids beim Öffnen (bereits gespeicherte Fahrt)
let addedFotoIds = [];              // in dieser Sitzung neu hochgeladene Ids
let signaturePad = null;

// ---------- Normalisierung ----------
function normalizeFoto(f) {
  const d = f && typeof f === "object" ? f : {};
  if (!d.id) return null;
  return { id: String(d.id), name: typeof d.name === "string" ? d.name : "Foto", contentType: typeof d.contentType === "string" ? d.contentType : "" };
}
function normalizeFahrt(f) {
  const d = f && typeof f === "object" ? f : {};
  const out = {
    id: d.id || uuid(),
    erstelltVon: typeof d.erstelltVon === "string" ? d.erstelltVon : "",
    erstelltAm: typeof d.erstelltAm === "string" ? d.erstelltAm : "",
    fahrerName: typeof d.fahrerName === "string" ? d.fahrerName : "",
    kennzeichen: typeof d.kennzeichen === "string" ? d.kennzeichen : "",
    abteilung: typeof d.abteilung === "string" ? d.abteilung : "",
    anzahlInsassen: typeof d.anzahlInsassen === "string" ? d.anzahlInsassen : (d.anzahlInsassen != null ? String(d.anzahlInsassen) : ""),
    reiseziel: typeof d.reiseziel === "string" ? d.reiseziel : "",
    kmStart: d.kmStart != null ? String(d.kmStart) : "",
    kmEnde: d.kmEnde != null ? String(d.kmEnde) : "",
    datumStart: typeof d.datumStart === "string" ? d.datumStart : "",
    datumEnde: typeof d.datumEnde === "string" ? d.datumEnde : "",
    uhrzeitStart: typeof d.uhrzeitStart === "string" ? d.uhrzeitStart : "",
    uhrzeitEnde: typeof d.uhrzeitEnde === "string" ? d.uhrzeitEnde : "",
    uebernahmeVon: typeof d.uebernahmeVon === "string" ? d.uebernahmeVon : "",
    abholort: typeof d.abholort === "string" ? d.abholort : "",
    uebergabeAn: typeof d.uebergabeAn === "string" ? d.uebergabeAn : "",
    abstellort: typeof d.abstellort === "string" ? d.abstellort : "",
    maengelText: typeof d.maengelText === "string" ? d.maengelText : "",
    maengelFotos: Array.isArray(d.maengelFotos) ? d.maengelFotos.map(normalizeFoto).filter(Boolean) : [],
    unterschriftDataUrl: (typeof d.unterschriftDataUrl === "string" && /^data:image\//.test(d.unterschriftDataUrl)) ? d.unterschriftDataUrl : "",
    status: d.status === "abgeschlossen" ? "abgeschlossen" : "offen",
    quelle: d.quelle === "extern" ? "extern" : "intern",
    fuehrerscheinKey: (typeof d.fuehrerscheinKey === "string" && d.fuehrerscheinKey) ? d.fuehrerscheinKey : null
  };
  ALLE_CHECK_KEYS.forEach((k) => { out[k] = !!d[k]; });
  return out;
}
function normalizeData(data) {
  const d = data && typeof data === "object" ? data : {};
  const meta = d.meta && typeof d.meta === "object" ? Object.assign({}, d.meta) : {};
  return {
    meta,
    fahrten: Array.isArray(d.fahrten) ? d.fahrten.map(normalizeFahrt) : []
  };
}

// ---------- Zugriff ----------
function canEdit() { return !!currentUser && (currentUser.isAdmin || !!currentUser.canEdit); }
function myUsername() { return currentUser ? currentUser.username : ""; }
function myName() {
  if (!currentUser) return "";
  const n = `${currentUser.vorname || ""} ${currentUser.nachname || ""}`.trim();
  return n || currentUser.username || "";
}
function canManageFahrt(fahrt) { return canEdit() || (fahrt.erstelltVon && fahrt.erstelltVon === myUsername()); }
// Analog mayViewRestricted() im Worker: Admin oder Mitglied der Gruppe fuehrerschein-einsicht.
function mayViewFuehrerschein() { return !!currentUser && (currentUser.isAdmin || (currentUser.groupIds || []).includes("fuehrerschein-einsicht")); }

// ---------- Fahrten-Liste ----------
function visibleFahrten() {
  return canEdit() ? appData.fahrten.slice() : appData.fahrten.filter((f) => f.erstelltVon === myUsername());
}
function fillFahrerFilter() {
  const el = document.getElementById("fahrten-fahrer");
  if (!el) return;
  const cur = el.value;
  const namen = Array.from(new Set(appData.fahrten.map((f) => f.fahrerName).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  el.innerHTML = `<option value="">Alle Fahrer</option>` + namen.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (namen.includes(cur)) el.value = cur;
}
// Suche/Fahrer-Filter + Sortierung — einzige Quelle für "was ist gerade sichtbar",
// genutzt von renderFahrten() (Bildschirmliste) UND vom CSV-Export (exportFahrtenCsv),
// damit beide garantiert dieselbe Menge zeigen/exportieren.
function filteredFahrten() {
  const q = val("fahrten-search").trim().toLowerCase();
  const ff = canEdit() ? val("fahrten-fahrer") : "";
  const all = visibleFahrten();
  return all.filter((f) => {
    if (ff && f.fahrerName !== ff) return false;
    if (q && !`${f.reiseziel} ${f.abteilung} ${f.kennzeichen} ${f.fahrerName}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (b.datumStart || "").localeCompare(a.datumStart || "") || (b.erstelltAm || "").localeCompare(a.erstelltAm || ""));
}
function renderFahrten() {
  const all = visibleFahrten();
  const rows = filteredFahrten();
  updateExportInfoLine();

  document.getElementById("fahrten-list").innerHTML = rows.map((f) => {
    const farbe = STATUS_FARBE[f.status] || STATUS_FARBE.offen;
    const sub = [f.abteilung, canEdit() ? ("Fahrer: " + (f.fahrerName || "—")) : null].filter(Boolean).map(escapeHtml).join(" · ");
    const fotos = f.maengelFotos.length ? ` · 📷 ${f.maengelFotos.length}` : "";
    const externBadge = f.quelle === "extern" ? ` <span class="badge-extern" title="Von einem externen Nutzer eingetragen">🔗 Extern</span>` : "";
    return `<div class="fahrt-row" data-id="${escapeHtml(f.id)}">
      <div class="fr-main">
        <div class="fr-title">${escapeHtml(fmtDatum(f.datumStart))} — ${escapeHtml(f.reiseziel || "ohne Ziel")}</div>
        <div class="fr-sub muted">${sub}${fotos}</div>
      </div>
      <span class="status-badge" style="background:${farbe}">${escapeHtml(STATUS_LABEL[f.status] || f.status)}</span>${externBadge}
    </div>`;
  }).join("");
  document.getElementById("fahrten-count").textContent = `${rows.length} von ${all.length}`;
  document.getElementById("fahrten-empty").classList.toggle("hidden", rows.length > 0);
}

// ---------- CSV-Export (konfigurierbar) ----------
// Jedes Feld einzeln per Checkbox wählbar (EXPORT_FIELD_GROUPS in config.js).
// Exportiert immer genau die aktuell gefilterte/gesuchte Liste (filteredFahrten()) —
// für Nutzer ohne Bearbeiten-Recht ist das automatisch nur die eigene Historie
// (visibleFahrten() greift schon davor), kein Sonderfall nötig.
function initExportPanel() {
  renderExportFieldCheckboxes();
  document.getElementById("btn-export-toggle").addEventListener("click", () => {
    const panel = document.getElementById("export-panel");
    const willOpen = panel.style.display === "none";
    panel.style.display = willOpen ? "" : "none";
    if (willOpen) updateExportInfoLine();
  });
  document.getElementById("btn-export-felder-alle").addEventListener("click", () => setAllExportCheckboxes(true));
  document.getElementById("btn-export-felder-keine").addEventListener("click", () => setAllExportCheckboxes(false));
  document.getElementById("btn-export-csv").addEventListener("click", exportFahrtenCsv);
}
function renderExportFieldCheckboxes() {
  const wrap = document.getElementById("export-field-groups");
  wrap.innerHTML = EXPORT_FIELD_GROUPS.map((group) => `
    <div style="font-size:13px; font-weight:700; color:var(--blue); text-transform:uppercase; letter-spacing:0.3px; margin:14px 0 8px;">${escapeHtml(group.title)}</div>
    <div class="checkbox-list">
      ${group.fields.map((f) => `
        <label class="checkbox-row"><input type="checkbox" class="export-field-cb" data-field="${escapeHtml(f.key)}" checked /> <span>${escapeHtml(f.label)}</span></label>
      `).join("")}
    </div>
  `).join("");
  wrap.querySelectorAll(".export-field-cb").forEach((cb) => cb.addEventListener("change", updateExportInfoLine));
}
function setAllExportCheckboxes(checked) {
  document.querySelectorAll(".export-field-cb").forEach((cb) => { cb.checked = checked; });
  updateExportInfoLine();
}
function updateExportInfoLine() {
  const el = document.getElementById("export-info-line");
  if (!el) return;
  const total = document.querySelectorAll(".export-field-cb").length;
  const checked = document.querySelectorAll(".export-field-cb:checked").length;
  const rowCount = filteredFahrten().length;
  el.textContent = `${checked} von ${total} Feldern ausgewählt · exportiert ${rowCount} Fahrten (aktuelle Filterung/Suche).`;
}
function csvCell(value) {
  const s = value == null ? "" : String(value);
  return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportFieldValue(f, fahrt) {
  const v = fahrt[f.key];
  switch (f.type) {
    case "datum": return v ? fmtDatum(v) : "";
    case "timestamp": return v ? fmtTimestamp(v) : "";
    case "bool": return v ? "Ja" : "Nein";
    case "status": return STATUS_LABEL[v] || v || "";
    case "quelle": return v === "extern" ? "Extern" : "Intern";
    default: return v == null ? "" : v;
  }
}
function exportFahrtenCsv() {
  const selectedKeys = Array.from(document.querySelectorAll(".export-field-cb:checked")).map((cb) => cb.dataset.field);
  if (!selectedKeys.length) { alert("Bitte mindestens ein Feld für den Export auswählen."); return; }
  const rows = filteredFahrten();
  if (!rows.length) { alert("Die aktuelle Filterung/Suche ergibt keine Treffer zum Exportieren."); return; }

  const fieldLookup = new Map(EXPORT_FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f]));
  const cols = selectedKeys.map((key) => fieldLookup.get(key)).filter(Boolean);
  const lines = [cols.map((f) => f.label), ...rows.map((f) => cols.map((c) => exportFieldValue(c, f)))];
  // Semikolon statt Komma + UTF-8-BOM: deutsches Excel erkennt das Trennzeichen
  // damit automatisch beim Doppelklick und zeigt Umlaute korrekt.
  const csv = String.fromCharCode(0xFEFF) + lines.map((line) => line.map(csvCell).join(";")).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fahrtenbuch_export_" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

// ---------- Fahrt-Formular ----------
function renderChecks(containerId, defs, fahrt) {
  document.getElementById(containerId).innerHTML = defs.map((c) =>
    `<label class="checkbox-row"><input type="checkbox" data-check="${escapeHtml(c.key)}" required ${fahrt && fahrt[c.key] ? "checked" : ""} /> <span>${escapeHtml(c.label)}</span></label>`
  ).join("");
}
function renderFotoList() {
  const el = document.getElementById("ff-foto-list");
  if (!editingFotos.length) { el.innerHTML = `<p class="muted" style="margin:0;">Noch keine Fotos.</p>`; return; }
  el.innerHTML = editingFotos.map((f) => `
    <div class="foto-chip" data-foto="${escapeHtml(f.id)}">
      <span class="foto-name">📷 ${escapeHtml(f.name)}</span>
      <button type="button" class="foto-view" data-view-foto="${escapeHtml(f.id)}">ansehen</button>
      <button type="button" class="foto-remove" data-remove-foto="${escapeHtml(f.id)}" title="Entfernen">×</button>
    </div>`).join("");
}
function openFahrt(id) {
  const fahrt = id ? appData.fahrten.find((f) => f.id === id) : null;
  if (id && !fahrt) return;
  if (fahrt && !canManageFahrt(fahrt)) { alert("Diese Fahrt gehört einem anderen Fahrer."); return; }
  editingFahrtId = fahrt ? fahrt.id : null;
  editingFotos = fahrt ? fahrt.maengelFotos.map((f) => Object.assign({}, f)) : [];
  originalFotoIds = editingFotos.map((f) => f.id);
  addedFotoIds = [];

  document.getElementById("fahrt-modal-title").textContent = fahrt ? "Fahrt bearbeiten" : "Neue Fahrt";
  setVal("ff-kennzeichen", fahrt ? fahrt.kennzeichen : "");
  setVal("ff-fahrer", fahrt ? fahrt.fahrerName : myName());
  setVal("ff-abteilung", fahrt ? fahrt.abteilung : "");
  setVal("ff-insassen", fahrt ? fahrt.anzahlInsassen : "");
  setVal("ff-reiseziel", fahrt ? fahrt.reiseziel : "");
  setVal("ff-kmstart", fahrt ? fahrt.kmStart : "");
  setVal("ff-kmende", fahrt ? fahrt.kmEnde : "");
  setVal("ff-datumstart", fahrt ? fahrt.datumStart : "");
  setVal("ff-uhrzeitstart", fahrt ? fahrt.uhrzeitStart : "");
  setVal("ff-datumende", fahrt ? fahrt.datumEnde : "");
  setVal("ff-uhrzeitende", fahrt ? fahrt.uhrzeitEnde : "");
  setVal("ff-uebernahme", fahrt ? fahrt.uebernahmeVon : "");
  setVal("ff-abholort", fahrt ? fahrt.abholort : "");
  setVal("ff-uebergabe", fahrt ? fahrt.uebergabeAn : "");
  setVal("ff-abstellort", fahrt ? fahrt.abstellort : "");
  setVal("ff-maengel", fahrt ? fahrt.maengelText : "");
  renderChecks("ff-anforderungen", ANFORDERUNGEN, fahrt);
  renderChecks("ff-kontrolle-vor", KONTROLLE_VOR, fahrt);
  renderChecks("ff-kontrolle-nach", KONTROLLE_NACH, fahrt);
  renderFotoList();
  document.getElementById("ff-hinweis").textContent = HINWEIS_ABSCHLUSS;
  document.getElementById("btn-delete-fahrt").classList.toggle("hidden", !(fahrt && canManageFahrt(fahrt)));
  const isExtern = !!(fahrt && fahrt.quelle === "extern");
  document.getElementById("ff-extern-info").classList.toggle("hidden", !isExtern);
  const fsBtn = document.getElementById("btn-view-fuehrerschein");
  const hasFuehrerschein = !!(fahrt && fahrt.fuehrerscheinKey && mayViewFuehrerschein());
  fsBtn.classList.toggle("hidden", !hasFuehrerschein);
  fsBtn.dataset.owner = fahrt && fahrt.fuehrerscheinKey ? fahrt.fuehrerscheinKey : "";

  document.getElementById("ff-beleg-info").classList.toggle("hidden", !fahrt);
  const belegStatus = document.getElementById("ff-beleg-status");
  belegStatus.textContent = "";
  if (fahrt) {
    const belegBtn = document.getElementById("btn-submit-beleg");
    belegBtn.dataset.fahrtId = fahrt.id;
    belegBtn.dataset.fahrerName = fahrt.fahrerName || "";
    belegBtn.dataset.datumStart = fahrt.datumStart || "";
    belegBtn.dataset.reiseziel = fahrt.reiseziel || "";
    belegBtn.dataset.kennzeichen = fahrt.kennzeichen || "";
    loadBelegStatus(fahrt.id, belegStatus);
  }

  document.getElementById("fahrt-modal").classList.remove("hidden");
  // Signatur-Canvas ist jetzt sichtbar -> Größe/Backing neu setzen, dann Inhalt laden.
  signaturePad.resize();
  signaturePad.resetSilent();
  if (fahrt && fahrt.unterschriftDataUrl) signaturePad.loadDataURL(fahrt.unterschriftDataUrl);
  signaturePad.resize();
  document.getElementById("ff-kennzeichen").focus();
}
// Fragt asynchron ab, ob über den Beleg-Knopf schon ein Beleg zu dieser Fahrt
// eingereicht wurde, und zeigt bei Treffer eine Bestätigung inkl. "Anzeigen"-Knopf
// je angehängter Datei. Rein informativ — Fehler (z.B. Aktion noch nicht deployed)
// werden bewusst still ignoriert, das Formular selbst darf davon nie blockiert werden.
async function loadBelegStatus(fahrtId, statusEl) {
  try {
    const { belege } = await gatewayListBelege(fahrtId);
    if (editingFahrtId !== fahrtId) return; // Modal wurde inzwischen gewechselt/geschlossen
    statusEl.innerHTML = "";
    if (!belege || !belege.length) return;
    const b = belege[0];
    statusEl.appendChild(document.createTextNode(`📎 Beleg eingereicht am ${fmtTimestamp(b.submittedAt)} `));
    const files = Array.isArray(b.files) ? b.files : [];
    files.forEach((f, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn small secondary";
      btn.textContent = files.length > 1 ? `Anzeigen (${i + 1})` : "Anzeigen";
      btn.addEventListener("click", () => viewBeleg(fahrtId, f.fileName, f.fileMime));
      statusEl.appendChild(btn);
    });
  } catch (_) { /* rein informative Anzeige, darf still fehlschlagen */ }
}
async function closeFahrt(discardUploads) {
  document.getElementById("fahrt-modal").classList.add("hidden");
  if (discardUploads && addedFotoIds.length) {
    // In dieser Sitzung hochgeladene, aber nie gespeicherte Fotos wieder entfernen.
    const ids = addedFotoIds.slice();
    ids.forEach((id) => { gatewayDeleteFile(id).catch(() => {}); });
  }
  editingFahrtId = null; editingFotos = []; originalFotoIds = []; addedFotoIds = [];
}
function collectChecks(target) {
  document.querySelectorAll("#fahrt-form input[data-check]").forEach((el) => { target[el.dataset.check] = el.checked; });
}
async function saveFahrt(status) {
  const fahrerName = val("ff-fahrer").trim();
  const reiseziel = val("ff-reiseziel").trim();
  if (!fahrerName) { alert("Bitte den Namen des Fahrers angeben."); return; }
  if (status === "abgeschlossen") {
    // Abschließen erzwingt alle Pflichtfelder (alles außer Mängel) + alle Checklisten-
    // Häkchen; Zwischenspeichern ("offen") bleibt bewusst unvollständig möglich
    // (deshalb novalidate am Formular, Prüfung nur hier).
    if (!document.getElementById("fahrt-form").reportValidity()) return;
    if (!reiseziel) { alert("Bitte ein Reiseziel angeben."); return; }
    if (signaturePad.isEmpty()) { alert("Bitte unterschreiben, um die Fahrt abzuschließen."); return; }
  }
  let fahrt = editingFahrtId ? appData.fahrten.find((f) => f.id === editingFahrtId) : null;
  if (!fahrt) {
    fahrt = normalizeFahrt({ id: uuid(), erstelltVon: myUsername(), erstelltAm: new Date().toISOString() });
    appData.fahrten.push(fahrt);
  }
  fahrt.fahrerName = fahrerName;
  fahrt.kennzeichen = val("ff-kennzeichen").trim();
  fahrt.abteilung = val("ff-abteilung").trim();
  fahrt.anzahlInsassen = val("ff-insassen").trim();
  fahrt.reiseziel = reiseziel;
  fahrt.kmStart = val("ff-kmstart").trim();
  fahrt.kmEnde = val("ff-kmende").trim();
  fahrt.datumStart = val("ff-datumstart");
  fahrt.uhrzeitStart = val("ff-uhrzeitstart");
  fahrt.datumEnde = val("ff-datumende");
  fahrt.uhrzeitEnde = val("ff-uhrzeitende");
  fahrt.uebernahmeVon = val("ff-uebernahme").trim();
  fahrt.abholort = val("ff-abholort").trim();
  fahrt.uebergabeAn = val("ff-uebergabe").trim();
  fahrt.abstellort = val("ff-abstellort").trim();
  fahrt.maengelText = val("ff-maengel").trim();
  collectChecks(fahrt);
  fahrt.unterschriftDataUrl = signaturePad.toDataURL();
  fahrt.status = status;

  // Fotos abgleichen: entfernte (Original oder in dieser Sitzung hochgeladen) löschen.
  const keepIds = editingFotos.map((f) => f.id);
  const toDelete = originalFotoIds.concat(addedFotoIds).filter((id, i, a) => a.indexOf(id) === i && !keepIds.includes(id));
  toDelete.forEach((id) => { gatewayDeleteFile(id).catch(() => {}); });
  fahrt.maengelFotos = editingFotos.map((f) => ({ id: f.id, name: f.name, contentType: f.contentType }));

  addedFotoIds = []; // gespeichert -> nicht mehr als "unbestätigt" behandeln
  await closeFahrt(false);
  renderAll();
  await saveNow();
}
async function deleteFahrt() {
  if (!editingFahrtId) return;
  const fahrt = appData.fahrten.find((f) => f.id === editingFahrtId);
  if (!fahrt || !canManageFahrt(fahrt)) return;
  if (!confirm("Diese Fahrt wirklich löschen?")) return;
  fahrt.maengelFotos.forEach((f) => { gatewayDeleteFile(f.id).catch(() => {}); });
  appData.fahrten = appData.fahrten.filter((f) => f.id !== editingFahrtId);
  addedFotoIds = []; // beim Löschen nichts extra aufräumen (Original-Fotos sind oben dran)
  await closeFahrt(false);
  renderAll();
  await saveNow();
}

// ---------- Foto-Upload (im Fahrt-Formular) ----------
async function addFotos(fileList) {
  const btn = document.getElementById("btn-foto-upload");
  const files = Array.from(fileList || []);
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) { alert(`„${file.name}“ ist zu groß (max. ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB).`); continue; }
    const id = uuid();
    btn.disabled = true; btn.textContent = "Lädt hoch…";
    try {
      await gatewayUploadFile(id, file, file.name, file.type || "image/jpeg");
      editingFotos.push({ id, name: file.name, contentType: file.type || "image/jpeg" });
      addedFotoIds.push(id);
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
  editingFotos = editingFotos.filter((f) => f.id !== id);
  renderFotoList();
}

// ---------- Datei-Viewer ----------
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
// Mängel-Foto (offener dateien/-Ordner, nur Tool-Zugriff nötig).
function viewFile(id, name, contentType) { return showInViewer(name, contentType, () => gatewayFetchFileBlob(id)); }
// Führerschein-Kopie eines extern eingetragenen Eintrags (abgeschotteter Bereich,
// dav-restricted-get mit Session-Token — funktioniert unverändert für Admin/
// fuehrerschein-einsicht, owner = der beim Upload vom Server vergebene Schlüssel).
async function gatewayFetchRestrictedBlob(owner) {
  const token = getSessionToken();
  if (!token) throw new NotLoggedInError();
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ action: "dav-restricted-get", app: GATEWAY_APP_ID, owner })
  });
  if (resp.status === 401) throw new NotLoggedInError("Sitzung abgelaufen");
  if (resp.status === 403) throw new Error("Kein Zugriff auf diese Datei.");
  if (resp.status === 404) throw new Error("Datei nicht gefunden.");
  if (!resp.ok) throw new Error("Datei nicht abrufbar (HTTP " + resp.status + ")");
  return resp.blob();
}
function viewFuehrerscheinExtern(owner) {
  if (!owner) return;
  showInViewer("Führerschein (extern hochgeladen)", "", () => gatewayFetchRestrictedBlob(owner));
}
function viewBeleg(fahrtId, fileName, fileMime) {
  if (!fileName) return;
  showInViewer(fileName, fileMime || "", () => gatewayFetchBelegBlob(fahrtId, fileName));
}
function closeViewer() {
  const modal = document.getElementById("viewer-modal");
  modal.classList.add("hidden");
  if (modal.dataset.objurl) { URL.revokeObjectURL(modal.dataset.objurl); delete modal.dataset.objurl; }
  document.getElementById("viewer-body").innerHTML = "";
}

// ---------- Einstellungen / Meta / Nutzer ----------
function renderMeta() {
  const m = appData.meta || {};
  const rows = [
    ["Fahrten erfasst", String(appData.fahrten.length)],
    ["Letzter Stand", m.stand ? new Date(m.stand).toLocaleString("de-DE") : "—"]
  ];
  document.getElementById("meta-view").innerHTML = rows.map(([k, v]) =>
    `<div class="form-field"><label>${escapeHtml(k)}</label><span>${escapeHtml(v)}</span></div>`).join("");
}
function renderVersionInfo() {
  document.querySelectorAll("#version-badge, #version-badge-2").forEach((el) => { if (el) el.textContent = "v" + APP_VERSION; });
  const list = document.getElementById("changelog-list");
  if (!list) return;
  list.innerHTML = APP_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <div class="cv">Version ${escapeHtml(entry.version)}</div>
      ${entry.groups.map((g) => `
        <div class="changelog-group">
          <div class="cg-title">${escapeHtml(g.title)}</div>
          <ul class="cg-items">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        </div>`).join("")}
    </div>`).join("");
}
function renderHeaderUser() {
  const el = document.getElementById("header-user");
  const el2 = document.getElementById("einstellungen-user");
  if (!currentUser) { if (el) el.textContent = ""; if (el2) el2.textContent = ""; return; }
  const rolle = currentUser.isAdmin ? " (Admin)" : (canEdit() ? " (Bearbeiter)" : "");
  if (el) el.textContent = "👤 " + myName() + rolle;
  if (el2) el2.textContent = "Angemeldet als " + myName() + rolle +
    (canEdit() ? " — sieht und verwaltet alle Fahrten." : " — legt und sieht eigene Fahrten an.");
}
function applyEditVisibility() {
  const editable = canEdit();
  document.body.classList.toggle("can-edit", editable);
  document.querySelectorAll(".editor-only").forEach((el) => el.classList.toggle("hidden", !editable));
}

function renderAll() {
  fillFahrerFilter();
  renderFahrten();
  renderMeta();
  renderVersionInfo();
  applyEditVisibility();
}

// ---------- Tabs ----------
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.toggle("active", s.id === "tab-" + tab));
  if (tab === "fahrten") { fillFahrerFilter(); renderFahrten(); }
  if (tab === "info") { renderMeta(); renderVersionInfo(); }
}

// ---------- Gateway: Laden / Speichern / Konflikte ----------
function setSaveStatus(text, kind) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.textContent = text;
  el.className = "header-status" + (kind ? " is-" + kind : "");
}
async function saveNow() { return doPersist(); }

// Es darf immer nur EIN dav-save unterwegs sein. gatewayRev (das ETag, mit dem der
// Worker Konflikte erkennt) wird erst aktualisiert, wenn ein Save zurückkommt —
// ein zweiter Save, der währenddessen startet, schickt also dasselbe, inzwischen
// veraltete ETag und wird zwangsläufig mit 409 abgelehnt. Für die bearbeitende
// Person sah das aus wie "ein anderes Gerät hat geändert", obwohl sie allein war,
// und reloadAfterConflict() verwarf dabei ihre letzte Eingabe.
// Deshalb: Änderungen, die während eines laufenden Saves anfallen, nur vormerken
// und danach in einem Rutsch nachschreiben. appData wird ohnehin immer komplett
// geschrieben, es geht also nichts verloren, wenn mehrere Änderungen zusammenfallen.
let saveRunner = null;
let saveDirty = false;
// Fuer das Sicherheitsnetz beim Verlassen der Seite (beforeunload unter
// runSaveLoop): "es liegt etwas an" und "der letzte Versuch ging schief".
// Beides wird eigens gepflegt statt aus saveDirty/saveRunner abgeleitet -- der
// Debounce-Timer laeuft schon, bevor saveDirty ueberhaupt gesetzt ist, und
// genau dieses Fenster ist der Fall, den das Netz auffangen soll.
let ungespeicherteAenderungen = false;
let letzterSaveFehlgeschlagen = false;

function doPersist() {
  saveDirty = true;
  ungespeicherteAenderungen = true;
  if (!saveRunner) saveRunner = runSaveLoop().finally(() => { saveRunner = null; });
  return saveRunner;
}
async function runSaveLoop() {
  let ok = true;
  while (saveDirty) {
    saveDirty = false;
    ok = await writeToGateway();
    // Bei Konflikt/Fehler wurde der Stand neu geladen bzw. der Login-Screen
    // gezeigt — dann NICHT blind nachschreiben, das würde den fremden Stand
    // wieder überbügeln.
    if (!ok) { saveDirty = false; break; }
  }
  // Nach einem sauberen Durchlauf ist alles draussen, sonst liegt noch etwas an.
  ungespeicherteAenderungen = !ok;
  letzterSaveFehlgeschlagen = !ok;
  return ok;
}

// Sicherheitsnetz beim Verlassen der Seite: ein noch nicht abgelaufener
// Debounce-Timer und ein gerade laufender fetch gehen beim Entladen beide
// verloren -- der Browser bricht laufende Requests ab. Der keepalive-Request
// ueberlebt das Schliessen des Tabs.
//
// Nachgefragt wird NUR, wenn dieser Weg nicht traegt (Daten ueber der
// 64-KB-Grenze, kein Token, oder der letzte regulaere Versuch schlug schon
// fehl). Sonst kaeme die Rueckfrage bei JEDEM Schliessen kurz nach einer
// Aenderung -- also staendig -- und wuerde reflexhaft weggeklickt, gerade dann
// wenn sie einmal wirklich zaehlt.
window.addEventListener("beforeunload", (e) => {
  if (!ungespeicherteAenderungen) return;
  // Apps mit zusaetzlichem lokalem Datei-Modus duerfen hier nichts ins Gateway
  // schicken: dort ist die lokale Datei die Wahrheit, nicht Nextcloud.
  if (typeof storageMode !== "undefined" && storageMode !== "gateway") return;
  const abgeschickt = gatewaySaveBeacon(appData);
  if (abgeschickt && !letzterSaveFehlgeschlagen) return;
  e.preventDefault();
  e.returnValue = "";
});
async function writeToGateway() {
  setSaveStatus("Speichern…", "pending");
  try {
    appData.meta = Object.assign({}, appData.meta, { stand: new Date().toISOString() });
    await gatewaySave(appData);
    const t = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    setSaveStatus("Gespeichert " + t, "ok");
    return true;
  } catch (e) {
    if (e instanceof ConflictError) { await reloadAfterConflict(); setSaveStatus("Von anderem Gerät aktualisiert", ""); return false; }
    if (e instanceof NotLoggedInError) { showConnectScreen("Sitzung abgelaufen — bitte neu anmelden."); return false; }
    console.error("Speichern fehlgeschlagen", e);
    setSaveStatus("Nicht gespeichert", "error");
    alert("Speichern fehlgeschlagen: " + e.message);
    return false;
  }
}
async function reloadAfterConflict() {
  try {
    const data = await gatewayLoad();
    appData = normalizeData(data);
    renderAll();
    alert("Die Daten wurden zwischenzeitlich auf einem anderen Gerät geändert — die aktuelle Version wurde neu geladen. Bitte die letzte Änderung bei Bedarf erneut vornehmen.");
  } catch (e) { console.error("Neuladen nach Konflikt fehlgeschlagen", e); }
}

// ---------- Start ----------
function showConnectScreen(errorMsg) {
  document.getElementById("connect-screen").style.display = "";
  document.getElementById("app-shell").style.display = "none";
  document.getElementById("cloud-error").textContent = errorMsg ? "Fehler: " + errorMsg : "";
}
// Vorschläge fürs Feld „Abteilung / Mannschaft" aus der zentralen Vereinsliste.
let vereinsMannschaften = [];

// Füllt die datalist am Abteilungsfeld. ⚠️ Eine datalist SCHLÄGT nichts vor, was
// nicht drinsteht, verbietet aber auch nichts — genau das ist hier gewollt:
// die echten Mannschaften zur Auswahl, „Vorstand" weiter frei tippbar.
function renderVereinsListe() {
  const dl = document.getElementById("vereins-mannschaften");
  if (!dl) return;
  dl.innerHTML = vereinsMannschaften
    .map((m) => `<option value="${escapeHtml(m.kurz)}">${escapeHtml(m.lang)}${m.liga ? " · " + escapeHtml(m.liga) : ""}</option>`)
    .join("");
}

async function startApp() {
  document.getElementById("connect-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "";
  renderAll();
  try { currentUser = await fetchMe(); } catch (_) { /* best effort */ }
  renderHeaderUser();
  renderAll();
  // Kommt zum Schluss: die Liste füllt nur ein Vorschlagsfeld, das Fahrtenbuch
  // ist ohne sie schon vollständig bedienbar.
  vereinsMannschaften = await fetchVereinsMannschaften();
  renderVereinsListe();
}
async function init() {
  setupListeners();
  signaturePad = createSignaturePad(document.getElementById("ff-signature"));
  if (!getSessionToken()) { showConnectScreen(); return; }
  try {
    const data = await gatewayLoad();
    appData = normalizeData(data);
    await startApp();
  } catch (e) {
    if (e instanceof NotLoggedInError) { showConnectScreen(); return; }
    console.error("Nextcloud-Zugriff über Login fehlgeschlagen", e);
    showConnectScreen(e.message);
  }
}

function setupListeners() {
  document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));

  // Fahrten-Liste
  ["fahrten-search", "fahrten-fahrer"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", renderFahrten);
    el.addEventListener("change", renderFahrten);
  });
  document.getElementById("fahrten-list").addEventListener("click", (e) => {
    const row = e.target.closest(".fahrt-row");
    if (row) openFahrt(row.dataset.id);
  });
  document.getElementById("btn-new-fahrt").addEventListener("click", () => openFahrt(null));
  initExportPanel();

  // Fahrt-Modal
  document.getElementById("fahrt-modal-close").addEventListener("click", () => closeFahrt(true));
  document.getElementById("btn-cancel-fahrt").addEventListener("click", () => closeFahrt(true));
  document.getElementById("btn-save-fahrt-offen").addEventListener("click", () => saveFahrt("offen"));
  document.getElementById("btn-save-fahrt-abschluss").addEventListener("click", () => saveFahrt("abgeschlossen"));
  document.getElementById("btn-delete-fahrt").addEventListener("click", deleteFahrt);
  document.getElementById("fahrt-modal").addEventListener("click", (e) => { if (e.target.id === "fahrt-modal") closeFahrt(true); });
  document.getElementById("fahrt-form").addEventListener("submit", (e) => { e.preventDefault(); saveFahrt("offen"); });

  // Signatur
  document.getElementById("btn-signature-clear").addEventListener("click", () => signaturePad.clear());

  // Foto-Upload im Formular
  document.getElementById("btn-foto-upload").addEventListener("click", () => document.getElementById("ff-foto-input").click());
  document.getElementById("ff-foto-input").addEventListener("change", (e) => { addFotos(e.target.files); e.target.value = ""; });
  document.getElementById("ff-foto-list").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove-foto]");
    if (rm) { removeFotoFromEditing(rm.dataset.removeFoto); return; }
    const vw = e.target.closest("[data-view-foto]");
    if (vw) { const f = editingFotos.find((x) => x.id === vw.dataset.viewFoto); if (f) viewFile(f.id, f.name, f.contentType); }
  });

  document.getElementById("btn-view-fuehrerschein").addEventListener("click", (e) => {
    viewFuehrerscheinExtern(e.currentTarget.dataset.owner);
  });

  document.getElementById("btn-submit-beleg").addEventListener("click", (e) => {
    const ds = e.currentTarget.dataset;
    const desc = `Fahrt ${fmtDatum(ds.datumStart)} nach ${ds.reiseziel || "?"}${ds.kennzeichen ? " (" + ds.kennzeichen + ")" : ""}`;
    const params = new URLSearchParams({ name: ds.fahrerName || "", date: ds.datumStart || "", desc, fahrtId: ds.fahrtId || "" });
    window.open(BELEG_EINGANG_URL + "?" + params.toString(), "_blank");
  });

  // Viewer
  document.getElementById("viewer-close").addEventListener("click", closeViewer);
  document.getElementById("viewer-modal").addEventListener("click", (e) => { if (e.target.id === "viewer-modal") closeViewer(); });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("viewer-modal").classList.contains("hidden")) closeViewer();
    else if (!document.getElementById("fahrt-modal").classList.contains("hidden")) closeFahrt(true);
  });
}

document.addEventListener("DOMContentLoaded", init);
