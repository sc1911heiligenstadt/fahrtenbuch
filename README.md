# 🚐 Fahrtenbuch

Die digitale Fahrer-Checkliste für die Vereinsfahrzeuge: Vor der Fahrt die
Sicherheitspunkte durchgehen, Fahrzeug- und Fahrtdaten erfassen, Mängel mit
Fotos melden und unterschreiben. So steht später fest, in welchem Zustand ein
Fahrzeug übernommen und zurückgegeben wurde.

**➡️ [Fahrtenbuch öffnen](https://sc1911heiligenstadt.github.io/fahrtenbuch/)**

## Seiten

| Seite | Wofür |
|---|---|
| [Fahrtenbuch](https://sc1911heiligenstadt.github.io/fahrtenbuch/) (`index.html`) | Für alle mit Vereinskonto: Fahrt eintragen, Checkliste ausfüllen, Mängel melden, unterschreiben |
| [Fahrtenbuch (extern)](https://sc1911heiligenstadt.github.io/fahrtenbuch/extern.html) (`extern.html`) | Für Eltern **ohne Vereinskonto**: Fahrt eintragen und Führerschein-Kopie hochladen — zugriffscode-geschützt statt Login |

Beide Seiten fragen dieselben Angaben ab. Externe Fahrten erscheinen sofort in
der normalen Fahrtenliste, deutlich als extern gekennzeichnet.

## Was die Checkliste abfragt

Kopfdaten (Kennzeichen, Abteilung/Mannschaft, Insassen, Reiseziel,
Kilometerstand, Datum und Uhrzeit, Übernahme und Übergabe), die Anforderungen an
den Fahrer (gültiger Führerschein, Mindestalter 23, kein Alkohol), die Kontrolle
**vor** der Fahrt (Betriebssicherheit, Sichtkontrolle) und **nach** der Fahrt
(vollgetankt, besenrein, erneute Kontrolle) — und zum Schluss die Unterschrift
mit dem Finger oder der Maus.

Zum Abschließen sind alle Felder außer den Mängeln Pflicht. Eine begonnene Fahrt
lässt sich jederzeit **als offen** zwischenspeichern und später fertigstellen.

Das Feld *Abteilung / Mannschaft* schlägt die echten Mannschaften des Vereins
vor; Fahrten für Vorstand oder Zeugwart lassen sich frei eintippen. Auf der
Eltern-Seite bleibt es ein reines Textfeld — dort gibt es keine Anmeldung und
damit keinen Zugriff auf die Liste.

## Warum die Führerschein-Kopie

Wer ein Vereinsfahrzeug fährt, muss eine gültige Fahrerlaubnis haben — das ist
Sache des Vereins, nicht Vertrauenssache. Die Eltern-Seite nimmt die Kopie
deshalb gleich mit entgegen; sie landet abgeschottet in der Vereins-Nextcloud,
nicht im Repo, und ist nur für Administratoren und die Gruppe *Führerschein
Einsicht* einsehbar. Für Trainer mit Vereinskonto liegt die Kopie dagegen in
[Trainerdaten](https://sc1911heiligenstadt.github.io/Trainerdaten/), nicht hier.

## Mängel

Ein gemeldeter Mangel gehört zur Fahrt, nicht in eine separate Liste: Er wird
mit **Fotos** direkt beim Eintragen erfasst und bleibt dem Fahrzeug zugeordnet.
Wird eine Fahrt gelöscht oder ein Foto entfernt, verschwindet es auch aus der
Cloud; klappt das nicht, sagt die App, wie viele Fotos liegen geblieben sind.

## Tankbeleg

An jeder Fahrt sitzt ein Knopf, der den Tankbeleg beim Vereinsbudget einreicht —
Fahrer, Datum und Zweck sind schon ausgefüllt, es fehlt nur das Foto. Ist ein
Beleg eingegangen, zeigt die Fahrt das Einreichdatum und öffnet ihn auf Klick.

## CSV-Export

Der Knopf **CSV-Export** über der Liste stellt die Spalten frei zusammen —
Fahrzeug und Fahrt, Kilometerstand, Datum und Uhrzeit, Übernahme und Übergabe,
Checklisten, Mängel und Status sind einzeln wählbar. Ausgegeben wird genau die
Menge, die Suche und Filter gerade zeigen. Einen PDF-Export gibt es hier nicht.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen. Die Eltern-Seite braucht **keine Anmeldung**, sondern einen **Zugriffscode**.

Die Rechte gelten hier in zwei Stufen: **jeder angemeldete Nutzer** trägt seine
eigenen Fahrten ein und sieht nur diese; **Bearbeiten** (die Gruppe *Fahrtenbuch
Bearbeiter* und Administratoren) sieht und verwaltet alle Fahrten einschließlich
der externen und nutzt den CSV-Export. Die Führerschein-Kopie aus einer externen
Fahrt sehen ausschließlich Administratoren und die Gruppe *Führerschein
Einsicht*. Wer in welcher Gruppe ist, legt die Tools-Übersicht fest.

Fällt die Anmeldung weg, während die App offen ist, wird der Bildschirm samt der
Dialoge daneben geräumt; zurück geht es über ein Neuladen der Seite.

## Lokal starten

Über den Eintrag `fahrtenbuch` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8796/`.

## Technik

| Datei | Zweck |
|---|---|
| `index.html` | die angemeldete Seite: Fahrtenliste, Fahrt-Dialog, Info-Reiter |
| `extern.html` | die Seite **ohne Anmeldung** für Eltern, mit Zugriffscode |
| `config.js` | Version, Checklisten-Punkte, Export-Felder, Changelog |
| `db.js` | Anbindung an das Gateway der Tools-Übersicht |
| `db-extern.js` | derselbe Weg ohne Sitzungstoken, mit Zugriffscode im Body |
| `app.js` / `extern.js` | Masken, Regeln, Uploads je Seite |
| `signature-pad.js` | die Unterschrift auf Touch und Maus |
| `style.css` | Gestaltung beider Seiten |

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser. Eine hochgeladene Datei ist auf 10 MB begrenzt.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
