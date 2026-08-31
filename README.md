# 🚐 Fahrtenbuch

Die digitale Fahrer-Checkliste für die Vereinsfahrzeuge: Vor der Fahrt die
Sicherheitspunkte durchgehen, Fahrzeug- und Fahrtdaten erfassen, Mängel mit
Fotos melden und unterschreiben. So steht später fest, in welchem Zustand ein
Fahrzeug übernommen und zurückgegeben wurde.

**➡️ [Fahrtenbuch öffnen](https://sc1911heiligenstadt.github.io/fahrtenbuch/)**

## Seiten

| Seite | Wofür |
|---|---|
| [Fahrtenbuch](https://sc1911heiligenstadt.github.io/fahrtenbuch/) | Für alle mit Vereinskonto: Fahrt eintragen, Checkliste ausfüllen, Mängel melden, unterschreiben |
| [Fahrtenbuch (extern)](https://sc1911heiligenstadt.github.io/fahrtenbuch/extern.html) | Für Eltern **ohne Vereinskonto**: Fahrt eintragen und Führerschein-Kopie hochladen — zugriffscode-geschützt statt Login |

## Warum die Führerschein-Kopie

Wer ein Vereinsfahrzeug fährt, muss eine gültige Fahrerlaubnis haben — das ist
Sache des Vereins, nicht Vertrauenssache. Die Eltern-Seite nimmt die Kopie
deshalb gleich mit entgegen; sie landet in der Vereins-Nextcloud, nicht im Repo.

## Mängel

Ein gemeldeter Mangel gehört zur Fahrt, nicht in eine separate Liste: Er wird
mit **Fotos** direkt beim Eintragen erfasst und bleibt dem Fahrzeug zugeordnet.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen. Die Eltern-Seite braucht **keine Anmeldung**, sondern einen **Zugriffscode**.

Die Rechte gelten in drei Stufen: **Sehen** (Fahrten und gemeldete Mängel ansehen), **Bearbeiten** (eine Fahrt eintragen, Checkliste ausfüllen, Mängel mit Fotos melden, unterschreiben) und **Administrieren** (Fahrzeuge und Zugriffscode für die Eltern-Seite pflegen). Wer welche Stufe hat, legt die Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `fahrtenbuch` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8796/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
