const APP_VERSION = "1.0";

// Größenlimit pro hochgeladener Datei (Schadensfoto) — muss zum
// Worker-Cap (admin-worker.js MAX_FILE_BYTES) passen.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// Ziel des "Beleg einreichen"-Knopfs (separates Repo/App, siehe CLAUDE.md).
const BELEG_EINGANG_URL = "https://tecko1985.github.io/sc-heiligenstadt-budget/beleg-eingang.html";

// Checklisten-Gruppen des Fahrer-Protokolls (1:1 aus der Papiervorlage). Jeder Eintrag
// { key, label } wird als Checkbox gerendert; key ist zugleich das Feld im Fahrt-Datensatz.
const ANFORDERUNGEN = [
  { key: "chkFuehrerschein", label: "Besitz eines gültigen Führerscheins (Kopie der Fahrerlaubnis alle 6 Monate in Trainerdaten hochladen)" },
  { key: "chkMindestalter", label: "Mindestalter des Fahrers: 23 Jahre" },
  { key: "chkKeinAlkohol", label: "Kein Alkohol- oder Drogenkonsum vor und während der Fahrzeugnutzung" }
];

const KONTROLLE_VOR = [
  { key: "chkSicherheitVor", label: "Überprüfung der Verkehrs- und Betriebssicherheit (z. B. Tanken, Motoröl, Wasser, etc.)" },
  { key: "chkSichtVor", label: "Sichtkontrolle zu Beschädigungen durchgeführt" }
];

const KONTROLLE_NACH = [
  { key: "chkVollgetankt", label: "Fahrzeug vollgetankt" },
  { key: "chkReinigung", label: "Fahrzeugreinigung durchgeführt (besenrein)" },
  { key: "chkSicherheitNach", label: "Erneute Überprüfung der Verkehrs- und Betriebssicherheit durchgeführt" },
  { key: "chkSichtNach", label: "Erneute Sichtkontrolle zu Beschädigungen durchgeführt" }
];

// Alle Checkbox-Keys in einer Liste — für Normalisierung/Default-Werte.
const ALLE_CHECK_KEYS = [].concat(
  ANFORDERUNGEN.map((c) => c.key),
  KONTROLLE_VOR.map((c) => c.key),
  KONTROLLE_NACH.map((c) => c.key)
);

// Konfigurierbarer CSV-Export der Fahrten-Liste (siehe initExportPanel/exportFahrtenCsv
// in app.js): jedes Feld einzeln per Checkbox an-/abwählbar, gruppiert wie das Fahrt-
// Formular (gleiche Legenden). "type" steuert nur die Formatierung des Zellwerts
// (exportFieldValue in app.js) — ohne "type" wird der Rohwert unverändert exportiert.
// Bewusst ohne interne Felder (id, fuehrerscheinKey) und Nicht-Tabellenwerte
// (maengelFotos-Array, unterschriftDataUrl-Bilddaten).
const EXPORT_FIELD_GROUPS = [
  {
    title: "Fahrzeug & Fahrt",
    fields: [
      { key: "erstelltVon", label: "Erstellt von (Benutzername)" },
      { key: "fahrerName", label: "Name des Fahrers" },
      { key: "kennzeichen", label: "Kennzeichen" },
      { key: "abteilung", label: "Abteilung / Mannschaft" },
      { key: "anzahlInsassen", label: "Anzahl der Insassen" },
      { key: "reiseziel", label: "Reiseziel" }
    ]
  },
  {
    title: "Kilometerstand",
    fields: [
      { key: "kmStart", label: "km Start" },
      { key: "kmEnde", label: "km Ende" }
    ]
  },
  {
    title: "Datum & Uhrzeit",
    fields: [
      { key: "datumStart", label: "Datum Start", type: "datum" },
      { key: "uhrzeitStart", label: "Uhrzeit Start" },
      { key: "datumEnde", label: "Datum Ende", type: "datum" },
      { key: "uhrzeitEnde", label: "Uhrzeit Ende" }
    ]
  },
  {
    title: "Übernahme / Übergabe",
    fields: [
      { key: "uebernahmeVon", label: "Übernahme von" },
      { key: "abholort", label: "Abholort" },
      { key: "uebergabeAn", label: "Übergabe an" },
      { key: "abstellort", label: "Abstellort" }
    ]
  },
  {
    title: "Anforderungen an den Fahrer",
    fields: ANFORDERUNGEN.map((c) => ({ key: c.key, label: c.label, type: "bool" }))
  },
  {
    title: "Fahrzeugkontrolle vor der Fahrt",
    fields: KONTROLLE_VOR.map((c) => ({ key: c.key, label: c.label, type: "bool" }))
  },
  {
    title: "Nach der Fahrt",
    fields: KONTROLLE_NACH.map((c) => ({ key: c.key, label: c.label, type: "bool" }))
  },
  {
    title: "Mängel & Status",
    fields: [
      { key: "maengelText", label: "Mängel / Beschädigungen" },
      { key: "status", label: "Status", type: "status" },
      { key: "quelle", label: "Quelle", type: "quelle" },
      { key: "erstelltAm", label: "Erstellt am", type: "timestamp" }
    ]
  }
];

// Abschließender Hinweis aus der Vorlage (unter dem Formular angezeigt).
const HINWEIS_ABSCHLUSS =
  "Fahrzeugcheckliste, Fahrzeugschlüssel, Beleg der Tankkarte (Name des Fahrers vermerken) und die " +
  "Tankkarte sind abschließend in den SCH-Briefkasten am Haupteingang des Gesundbrunnenstadions zu hinterlassen.";

const APP_CHANGELOG = [
  {
    version: "1.2",
    groups: [
      {
        title: "Bedienung am Handy",
        items: [
          "Eingabefelder sind am Handy mindestens 16 Pixel groß. Dadurch zoomt der iPhone-Browser beim Antippen eines Feldes nicht mehr ungefragt in die Seite hinein und bleibt danach verschoben stehen."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Foto-Upload auf älteren iPhones/iPads",
        items: [
          "Auf iOS-Geräten mit Safari älter als 15.4 schlug das Hochladen von Mängel-Fotos fehl („Ungültige Datei-Id“), weil die intern vergebene Id dort nicht im vom Server verlangten Format erzeugt wurde. Im externen Fahrten-Formular fielen die Fotos dabei sogar unbemerkt aus dem abgeschickten Datensatz. Die Id wird jetzt bei Bedarf selbst im richtigen Format erzeugt; auf neueren Geräten ändert sich nichts."
        ]
      }
    ]
  },
  {
    version: "1.0",
    groups: [
      {
        title: "Fahrtenbuch / Fahrer-Checkliste",
        items: [
          "Löst die Papier-„Fahrer-Checkliste für SCH“ ab: jeder eingeloggte Fahrer erfasst seine Fahrt mit Fahrzeug- und Fahrtdaten (Kennzeichen, Insassen, Reiseziel, Kilometerstand, Datum/Uhrzeit, Übernahme/Übergabe).",
          "Sicherheits-Checklisten vor und nach der Fahrt (gültiger Führerschein, Mindestalter, kein Alkohol, Verkehrssicherheit, Sichtkontrolle, vollgetankt, Reinigung) direkt zum Abhaken. Die Führerschein-Kopie selbst wird in Trainerdaten hinterlegt.",
          "Mängel/Beschädigungen als Freitext plus Foto-Upload — die Fotos landen sicher im Vereins-Nextcloud, kein Verschicken per Mail mehr nötig.",
          "Fahrt wird handschriftlich (Finger/Maus) unterschrieben und abgeschlossen.",
          "Beim Abschließen sind alle Felder außer Mängel/Beschädigungen sowie alle Checklisten-Punkte Pflicht; eine begonnene Fahrt kann aber jederzeit als „offen“ zwischengespeichert und später abgeschlossen werden."
        ]
      },
      {
        title: "Beleg einreichen",
        items: [
          "Über einen Knopf direkt an der Fahrt lässt sich ein Tankbeleg o. Ä. beim Vereinsbudget-Tool einreichen — Fahrer, Datum und Zweck sind schon vorausgefüllt, nur noch Belegfoto anhängen und absenden.",
          "Sobald ein Beleg eingegangen ist, zeigt die Fahrt eine Bestätigung mit Einreichdatum und einem „Anzeigen“-Knopf, der den eingereichten Beleg direkt im gewohnten Datei-Viewer öffnet."
        ]
      },
      {
        title: "CSV-Export",
        items: [
          "Export der Fahrten-Liste als CSV — jedes Feld (Fahrzeug & Fahrt, Kilometerstand, Datum & Uhrzeit, Übernahme/Übergabe, Checklisten, Mängel & Status) einzeln per Checkbox wählbar, berücksichtigt die aktuelle Such-/Filter-Einstellung. Sichtbar nur für Admin und die Gruppe „Fahrtenbuch Bearbeiter“."
        ]
      },
      {
        title: "Externes Fahrtenbuch für Eltern",
        items: [
          "Eigenständige Seite („extern.html“) für Eltern ohne eigenes Vereinskonto, die gelegentlich ein Vereinsfahrzeug fahren — geschützt durch einen einfachen Zugriffscode statt Login.",
          "Externe Fahrten enthalten dieselben Felder wie das interne Formular (Kopfdaten, Sicherheits-Checklisten, Mängelfotos, Unterschrift, alle Felder Pflicht) plus eine zusätzlich verpflichtende Führerschein-Kopie beim Eintragen — abgeschottet gespeichert, sichtbar nur für Admin und die Gruppe „Führerschein Einsicht“ über den Button „Führerschein ansehen“.",
          "Externe Fahrten erscheinen sofort in der normalen Fahrten-Liste, deutlich mit einem „🔗 Extern“-Badge gekennzeichnet, und sind nur für Admin/„Fahrtenbuch Bearbeiter“ sicht- und verwaltbar."
        ]
      },
      {
        title: "Rechte & Speicherung",
        items: [
          "Jeder eingeloggte Nutzer trägt und sieht seine eigenen Fahrten; Admin und die Gruppe „Fahrtenbuch Bearbeiter“ sehen und verwalten alle.",
          "Automatische Nextcloud-Synchronisierung über die zentrale Anmeldung (Tools-Übersicht) — kein separates Passwort nötig."
        ]
      }
    ]
  }
];
