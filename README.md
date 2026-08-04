# Fahrtenbuch / Fahrer-Checkliste

Digitale Ablösung der Papier-„Fahrer-Checkliste für SCH“ — Gateway-App der
[ToolsUebersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/)-Familie. Jeder
eingeloggte Nutzer (Fahrer) erfasst pro Fahrt mit einem Vereinsfahrzeug ein
Fahrtenprotokoll mit Sicherheits-Checklisten und Unterschrift. Zusätzlich können
Eltern ohne eigenes Vereinskonto über eine separate, zugriffscode-geschützte
Seite (`extern.html`) Fahrten eintragen — siehe Abschnitt „Extern“.

Live: https://sc1911heiligenstadt.github.io/fahrtenbuch/ · Extern: https://sc1911heiligenstadt.github.io/fahrtenbuch/extern.html

## Funktionen

- **Fahrten:** Fahrzeug-/Fahrtdaten (Kennzeichen, Fahrer, Abteilung/Mannschaft,
  Insassen, Reiseziel, Kilometerstand, Datum/Uhrzeit Start+Ende, Übernahme/Übergabe),
  Sicherheits-Checklisten vor und nach der Fahrt, Mängel als Freitext **plus
  Foto-Upload**, handschriftliche **Unterschrift** (Canvas). Fahrten können als
  „offen“ zwischengespeichert und später abgeschlossen werden.
- **Checklisten:** gültiger Führerschein, Mindestalter, kein Alkohol, Verkehrs- und
  Betriebssicherheit, Sichtkontrolle, vollgetankt und Reinigung — direkt zum Abhaken.
  Die Führerschein-Kopie selbst wird in
  [Trainerdaten](https://sc1911heiligenstadt.github.io/Trainerdaten/) hinterlegt, nicht hier.
- **Rechte:** jeder eingeloggte Nutzer legt/sieht seine **eigenen** Fahrten;
  Admin und die Gruppe `fahrtenbuch-bearbeiter` sehen und verwalten **alle Fahrten**
  (serverseitig erzwungen, nicht nur in der Oberfläche versteckt).
- **Beleg einreichen:** aus einer Fahrt heraus direkt einen Tankbeleg o. Ä. beim
  Vereinsbudget-Tool einreichen; die Fahrt zeigt danach an, wann der Beleg
  eingegangen ist, inkl. Button zum Anzeigen der eingereichten Datei(en).

## Extern (für Eltern ohne Konto)

`extern.html` ist eine eigenständige, login-lose Seite nach dem Vorbild von
`sc-heiligenstadt-budget/beleg-eingang.html`: Zugriffscode statt Login, gleiches
Formular wie intern (Kopfdaten, alle 9 Sicherheits-Checkboxen, Mängelfotos,
Unterschrift) plus einem zusätzlichen Führerschein-Upload. Eingetragene Fahrten
erscheinen sofort in der normalen Fahrten-Liste (Feld `quelle:"extern"`, Badge
„🔗 Extern“) — nur Admin/`fahrtenbuch-bearbeiter` können sie verwalten, da
`erstelltVon` bei externen Einträgen leer ist. Die Führerschein-Kopie landet
abgeschottet (Nextcloud-Unterordner `fuehrerscheine-extern/<server-vergebener-
Schlüssel>`), sichtbar nur für Admin/Gruppe `fuehrerschein-einsicht` über den
Button „Führerschein ansehen“ am jeweiligen Eintrag.

Eigene Client-Datei `db-extern.js` (code-basierter statt session-basierter
Gateway-Zugriff, kein Bearer-Token) und `extern.js` — bewusst getrennt von
`db.js`/`app.js`, da `db.js` eine unveränderte 1:1-Kopiervorlage für andere
Gateway-Apps bleiben soll. Serverseitig drei neue, login-lose Aktionen in
`admin-worker.js` (`fahrtenbuch-extern-submit/-file-put/-fuehrerschein-put`),
geschützt durch das Worker-Secret `PW_FAHRTENBUCH_EXTERN` (ein gemeinsamer Code
für alle drei). Details siehe Kopf-Dokumentation in `admin-worker.js`.

## Architektur

Vanilla JS, kein Build-Step. Persistenz über das zentrale ToolsUebersicht-Login-Gateway
(`db.js`, `GATEWAY_APP_ID = "fahrtenbuch"`), Daten in Nextcloud unter
`.../05_Nachwuchsbereich/02_Förderung/Tools/Fahrtenbuch/fahrtenbuch.json`.
Mängel-Fotos liegen als Binärdateien im Unterordner `dateien/`
(Gateway-Aktionen `dav-file-put`/`dav-file-get`/`dav-file-delete`, ≤ 10 MB je Datei; in der
JSON nur die Referenz `{id, name, contentType}`). Die Unterschrift wird als kleine
PNG-DataURL inline gespeichert.

Dateien: `index.html`, `app.js`, `config.js`, `db.js`, `signature-pad.js`, `style.css`,
plus `extern.html`/`extern.js`/`db-extern.js` für die externe Variante
(siehe „Extern“). `db.js` ist aus `digitaler-stempel` übernommen (nur App-Id angepasst),
`signature-pad.js` aus `trainerkodex`/`TrainerCheckliste`.

## Deploy / Registrierung

- `E:\.claude\launch.json` — Eintrag `fahrtenbuch`, Port 8796 (lokaler Dev-Server).
- `E:\ToolsUebersicht\config.js` — `TOOLS`-Eintrag `id:"fahrtenbuch"` + `NEWS`-Eintrag.
- `E:\ToolsUebersicht\admin-worker.js` — `DAV_APPS["fahrtenbuch"]` + `ALLOWED_ORIGINS`
  um `http://localhost:8796`. **Worker-Redeploy nötig** (Cloudflare); der App-Ordner
  inkl. `dateien/` wird beim ersten Speichern per MKCOL-Autofix angelegt.
- Sichtbarkeit im Admin-Panel: **„Alle eingeloggten Nutzer“** (jeder Fahrer nutzt die
  App). Optional Gruppe `fahrtenbuch-bearbeiter` für die Voll-Sicht.
- Zusätzlich: Worker-Secret **`PW_FAHRTENBUCH_EXTERN`** (Cloudflare-Dashboard,
  Zugriffscode für `extern.html`) und `RESTRICTED_FILE_APPS["fahrtenbuch"]` (Unterordner
  `fuehrerscheine-extern`, Gruppe `fuehrerschein-einsicht`) in `admin-worker.js`.

## Akzeptierte Limitierungen

- Konfliktschutz = Erkennen (409) + Neuladen, kein Merge (Standard aller Gateway-Apps).
- Extern hochgeladene Mängelfotos/Führerschein-Kopien, deren Formular danach ohne
  Absenden verlassen wird, werden nicht automatisch aufgeräumt (kein Cleanup-
  Mechanismus ohne Login).
- `fahrtenbuch-extern-submit` schreibt unconditional (kein ETag/rev-Konfliktschutz) —
  für den erwarteten Nutzungsumfang (gelegentliche Elternfahrten) bewusst akzeptiert.
