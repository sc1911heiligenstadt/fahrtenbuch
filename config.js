const APP_VERSION = "1.0";

// Größenlimit pro hochgeladener Datei (Schadensfoto) — muss zum
// Worker-Cap (admin-worker.js MAX_FILE_BYTES) passen.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// Ziel des "Beleg einreichen"-Knopfs (separates Repo/App, siehe CLAUDE.md).
const BELEG_EINGANG_URL = "https://sc1911heiligenstadt.github.io/sc-heiligenstadt-budget/beleg-eingang.html";

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
    version: "1.1",
    groups: [
      {
        title: "Mannschaften kommen jetzt aus der einen Vereinsliste",
        items: [
          "Das Feld „Abteilung / Mannschaft“ schlägt beim Tippen die echten Mannschaften des Vereins vor — dieselbe Liste, die in der Tools-Übersicht gepflegt wird.",
          "Damit steht dieselbe Mannschaft in allen Fahrten gleich geschrieben, und die Suche findet sie zuverlässig.",
          "Ein eigener Eintrag bleibt möglich: Fahrten für Vorstand, Zeugwart oder eine Vereinsfahrt lassen sich weiterhin frei eintippen.",
          "Im Formular für Eltern ohne Vereinskonto bleibt das Feld ein reines Textfeld — dort gibt es keine Anmeldung und damit keinen Zugriff auf die Liste."
        ]
      }
    ]
  },
  {
    version: "1.0",
    groups: [
      {
        title: "Fahrer-Checkliste",
        items: [
          "Digitale Fassung der Papier-Checkliste für die Vereinsfahrzeuge: Kennzeichen, Insassen, Reiseziel, Kilometerstand, Datum und Uhrzeit, Übernahme und Übergabe.",
          "Sicherheitspunkte vor und nach der Fahrt zum Abhaken: gültiger Führerschein, Mindestalter, kein Alkohol, Verkehrssicherheit, Sichtkontrolle, vollgetankt, Reinigung.",
          "Mängel und Beschädigungen als Freitext samt Foto. Die Fotos landen in der Vereins-Nextcloud — nichts muss mehr per Mail verschickt werden.",
          "Die Fahrt wird mit dem Finger oder der Maus unterschrieben und abgeschlossen.",
          "Zum Abschließen sind alle Felder außer Mängel und alle Checklistenpunkte Pflicht. Eine begonnene Fahrt lässt sich aber jederzeit als offen zwischenspeichern und später fertigstellen.",
          "Die Führerschein-Kopie selbst liegt nicht hier, sondern in den Trainerdaten."
        ]
      },
      {
        title: "Beleg einreichen",
        items: [
          "Direkt an der Fahrt lässt sich ein Tankbeleg beim Vereinsbudget einreichen — Fahrer, Datum und Zweck sind bereits ausgefüllt, es fehlt nur das Foto.",
          "Ist ein Beleg eingegangen, zeigt die Fahrt eine Bestätigung mit Einreichdatum und einen Knopf, der den Beleg direkt öffnet."
        ]
      },
      {
        title: "Für Eltern ohne Vereinskonto",
        items: [
          "Eine eigene Seite für Eltern, die gelegentlich ein Vereinsfahrzeug fahren — geschützt durch einen Zugriffscode statt durch eine Anmeldung.",
          "Dieselben Felder wie im internen Formular: Kopfdaten, Sicherheitspunkte, Mängelfotos und Unterschrift, alles Pflicht.",
          "Zusätzlich verpflichtend ist dort die Führerschein-Kopie. Sie wird abgeschottet gespeichert und ist nur für Administratoren und die Gruppe „Führerschein Einsicht“ einsehbar.",
          "Externe Fahrten erscheinen sofort in der normalen Fahrtenliste, deutlich als extern gekennzeichnet."
        ]
      },
      {
        title: "Export",
        items: [
          "CSV-Export der Fahrtenliste, frei zusammenstellbar: Fahrzeug und Fahrt, Kilometerstand, Datum und Uhrzeit, Übernahme und Übergabe, Checklisten, Mängel und Status sind einzeln wählbar.",
          "Der Export übernimmt die eingestellte Suche und Filterung."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Jeder angemeldete Nutzer trägt seine eigenen Fahrten ein und sieht sie.",
          "Bearbeiten: die Gruppe „Fahrtenbuch Bearbeiter“ und Administratoren sehen und verwalten alle Fahrten, einschließlich der externen, und nutzen den CSV-Export.",
          "Den Führerschein aus einer externen Fahrt sehen nur Administratoren und die Gruppe „Führerschein Einsicht“.",
          "Der Reiter „Info“ ist für alle sichtbar."
        ]
      },
      {
        title: "Bedienung am Handy",
        items: [
          "Die Ansicht ist für das Handy gebaut — die Fahrt lässt sich direkt am Fahrzeug eintragen, samt Foto und Unterschrift.",
          "Eingabefelder sind mindestens 16 Pixel groß, damit der iPhone-Browser beim Antippen nicht ungefragt in die Seite hineinzoomt und verschoben stehen bleibt.",
          "Der Foto-Upload funktioniert auch auf älteren iPhones und iPads: die interne Datei-Kennung wird notfalls selbst im geforderten Format erzeugt. Zuvor schlug der Upload dort mit „Ungültige Datei-Id“ fehl, im externen Formular fielen die Fotos sogar unbemerkt aus dem Datensatz."
        ]
      },
      {
        title: "Daten & Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht."
        ]
      }
    ]
  }
];
