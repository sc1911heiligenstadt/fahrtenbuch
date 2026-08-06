# 🚐 Fahrtenbuch

Digitale Fahrer-Checkliste für Vereinsfahrzeuge: Fahrt mit Fahrzeug-/Fahrtdaten und Sicherheits-Checklisten erfassen, Mängel mit Fotos hochladen, unterschreiben.

**➡️ [Fahrtenbuch öffnen](https://sc1911heiligenstadt.github.io/fahrtenbuch/)**

## Seiten

| Seite | Wofür |
|---|---|
| [Fahrtenbuch](https://sc1911heiligenstadt.github.io/fahrtenbuch/) | Digitale Fahrer-Checkliste für Vereinsfahrzeuge: Fahrt mit Fahrzeug-/Fahrtdaten und Sicherheits-Checklisten erfassen, Mängel mit … |
| [Fahrtenbuch (extern)](https://sc1911heiligenstadt.github.io/fahrtenbuch/extern.html) | Für Eltern ohne Vereinskonto: Fahrt mit einem Vereinsfahrzeug eintragen und Führerschein-Kopie hochladen — zugriffscode-geschützt … |

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen.

Die Rechte gelten in drei Stufen: **Sehen** (nur ansehen), **Bearbeiten** (Einträge pflegen) und **Administrieren** (Einstellungen und Verwaltung). Wer welche Stufe hat, legt die Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `fahrtenbuch` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8796/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
