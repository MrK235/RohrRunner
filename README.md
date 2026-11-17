# RohrRunner

**Rohrnetze zeichnen. Betriebspunkte prüfen. Ergebnisse nachvollziehen.**

RohrRunner ist eine lokale Browseranwendung zur grafischen Erfassung und technischen Vorbemessung von Kältemittelrohrnetzen. Auf einem PDF-Grundriss oder einer leeren Zeichenfläche entstehen rechtwinklige Leitungsnetze mit Verbund, Kühlstellen, Lasten und Betriebspunkten.

**Version 1.0.1** · PWA · Kein Build-Schritt · Keine npm-Laufzeitpakete · Lokale Projektverwaltung

[Öffentliches Repository auf GitHub](https://github.com/MrK235/RohrRunner)

> [!IMPORTANT]
> RohrRunner ist ein Planungs- und Vorbemessungswerkzeug, keine technische Freigabe. Ergebnisse und Anwendungsgrenzen müssen vor der Ausführung durch die verantwortliche Fachplanung geprüft werden. Weder Normerfüllung noch globale Optimalität werden zugesichert.

## Schnellstart

1. Unter Windows `RohrRunner.bat`, unter Linux `./RohrRunner.sh` starten; beide Skripte starten den lokalen Server und öffnen RohrRunner im Browser. Alternativ kann `index.html` direkt geöffnet werden.
2. Optional einen PDF-Grundriss laden und den Maßstab mit zwei Punkten oder über `m / px` kalibrieren.
3. Einen Verbund und Kühlstellen setzen, Leistungen in kW eintragen und die Leitungen rechtwinklig verbinden.
4. Im Reiter **Berechnung** Kältemittel, Temperaturen und Grenzwerte prüfen.
5. **Netz berechnen** wählen und die Ergebnisse im Reiter **Ergebnis** prüfen.

Ein Server und Node.js sind für die Nutzung nicht erforderlich. RohrRunner kann über das Web-App-Menü des Browsers als PWA installiert werden. Dafür wird die Anwendung einmal über HTTPS oder den lokalen Entwicklungsserver geöffnet; die lokalen Laufzeitdateien werden für die Offline-Nutzung gecacht. Für die Entwicklung steht ein lokaler Server zur Verfügung:

```bash
npm run serve
# anschließend http://127.0.0.1:4173 öffnen
```

`ROHRRUNNER_PORT` kann den Port ändern. Alle benötigten Laufzeitbibliotheken einschließlich PDF.js, pdf-lib und CoolProp liegen im Projekt und werden lokal geladen. Die Anwendung funktioniert daher auch ohne Internetverbindung; externe Links in der Oberfläche sind nur optionale Projektverweise.

## Funktionen

- PDF-Grundriss als Zeichenunterlage, Kalibrierung, Zoom und Verschieben
- Orthogonale Leitungen, automatische T-Stücke sowie Undo/Redo
- Mehrere Kühlstellen mit frei definierbaren Leistungen
- Saug- und Flüssigkeitsleitungen mit automatischer oder manueller Rohrwahl
- Betriebspunkte, Höhendifferenzen, Zusatzlängen und Einzelwiderstände je Abschnitt
- Druckverluste, Geschwindigkeiten, Temperaturverluste und Warnungen
- Kühlstellen und Rohrstrecken in der Ergebnisansicht; Rohrstrecken von den Kühlstellen über T-Stücke bis zum Verbund sortiert
- Lokale Projektverwaltung, `.rohrrunner`-Import, Ergebnis-CSV und Plan-PDF
- Projektpaket als ZIP mit `.rohrrunner`, verfügbaren Berechnungs-/Material-CSV und PDF-Grundriss plus Plan-PDF

## Ergebnis-CSV

Der CSV-Export enthält zunächst Projektinformationen und Vorgabewerte in zwei nebeneinander angeordneten Beschreibungs-/Wertspalten. Erweiterte interne Berechnungsparameter werden nicht exportiert.

Danach folgen die Ergebniswerte je Rohrstrecke in derselben Reihenfolge wie in der Ergebnisansicht:

- Rohrstrecke von–nach
- Länge
- Rohrleitung SL und FL in getrennten Spalten
- berechnete Verdampfungs- und Flüssigkeitstemperatur
- Druckverlust SL und FL in K
- Geschwindigkeit SL und FL in m/s
- Leistung in kW

Zahlen werden mit zwei Nachkommastellen und der Einheit direkt hinter dem Wert ausgegeben. Das CSV nutzt Semikolontrennung und Dezimalkommas für eine gute Weiterverarbeitung in deutscher Tabellenkalkulation.

## Kältemittel und Startwerte

Unterstützt werden **R513A**, **R448A** und **R744 / CO₂**. R744 wird nur im unterkritischen Bereich ausgelegt; transkritische Druckgasleitungen sind nicht enthalten.

| Vorgabe | Startwert R513A / R448A |
| --- | ---: |
| Gleichzeitigkeit | 1,00 |
| Verdampfung / Verflüssigung | −10 °C / 45 °C |
| Überhitzung / Unterkühlung | 25 K / 2 K |
| Druckverlust SL / FL max. | 2 K / 1 K |
| Steigleitung min. / Sauggasgeschwindigkeit max. | 7 m/s / 30 m/s |
| Auslegungsdruck | 28 bar Überdruck |

Beim Wechsel auf R744 werden passende CO₂-Startwerte gesetzt. Gespeicherte Betriebspunkte werden beim Öffnen eines Projekts nicht überschrieben.

## Berechnungsmodell und Grenzen

Der Solver berechnet stationäre, einphasige Saug- und Flüssigkeitsleitungen in einem zusammenhängenden, kreisfreien Netzbaum. Die Flüssigkeitstemperatur bleibt im Modell entlang der Flüssigkeitsleitung konstant. Die automatische Rohrwahl ist eine begrenzte Upgrade-Heuristik und keine globale Kostenoptimierung.

Nicht abgedeckt sind unter anderem transkritisches CO₂, Druckgasleitungen, Verdichter- und Ventilauslegung, kombinierte Kreise, zeitabhängige Lasten und eine vollständige Teillast-Ölrückführung. Annahmen, Gleichungen und Gültigkeitsbereiche stehen in der [Berechnungsanleitung](rohrnetz-berechnung-anleitung.md); bekannte Einschränkungen in [BUGS.md](BUGS.md).

## Projekte und Datenschutz

Projekte werden im verwendeten Browser in IndexedDB gespeichert, einschließlich Netz, Einstellungen, Maßstab, letztem Ergebnis und gegebenenfalls PDF. **Sichern** erstellt ein ZIP-Paket mit der `.rohrrunner`-Projektdatei, verfügbaren Berechnungs- und Material-CSV sowie dem Original-Grundriss und dem exportierten Plan-PDF. Die `.rohrrunner`-Datei enthält den Grundriss zusätzlich eingebettet und kann nach dem Entpacken direkt wieder geöffnet werden.

Es gibt keinen Anwendungsserver und keine Cloud-Synchronisierung. Projektdateien und Grundrisse können vertrauliche Daten enthalten; vor dem Teilen sind Inhalt und Metadaten zu prüfen. Für PDF-Funktionen lädt der Browser Bibliotheken von Cloudflare bzw. jsDelivr.

## Entwicklung

RohrRunner besteht aus statischen Browserdateien. Wichtige Bereiche:

- `src/app.js` – Oberfläche, Editor und Exporte
- `src/editor-core.js` – Geometrie und Netzbearbeitung
- `src/engine.js` – Berechnung und Dimensionierung
- `src/stoffdaten.js` – Stoffdatenzugriff
- `src/worker.js` / `src/worker-bundle.js` – Berechnungs-Worker
- `src/zip.js` – ZIP-Erstellung für lokale Projektpakete
- `vendor/pdfjs/` und `vendor/pdf-lib/` – lokale PDF-Bibliotheken inklusive Lizenzen
- `data/pipe-catalog.json` / `data/pipe-catalog.js` – Rohrkatalog
- `manifest.webmanifest`, `sw.js`, `src/pwa.js` – PWA-Manifest, Offline-Cache und Registrierung
- `RohrRunner.bat`, `RohrRunner.sh` – Startskripte für lokalen Server und Browser

```bash
npm test                 # nur Tests zu geänderten Dateien
npm run test:all         # vollständige Testsuite, nur bei Bedarf
npm run build:worker
```

Der Testlauf benötigt Node.js, aber keine zusätzlichen npm-Pakete. Ein manueller Browser-Test wurde vom Projektverantwortlichen bestätigt; eine systematische Prüfung aller Browser- und Betriebssystemkombinationen liegt nicht vor. Die Berechnungsergebnisse sind noch nicht unabhängig anhand von Referenzfällen verifiziert. Die Tests und der Browser-Test ersetzen keine fachliche Anlagenprüfung.

Mehr dazu: [Architektur](ARCHITECTURE.md) · [Mitwirken](CONTRIBUTING.md) · [Änderungsprotokoll](CHANGELOG.md) · [Sicherheitsmeldungen](SECURITY.md)

**Lizenzhinweis:** Die Lizenzen der mitgelieferten Drittbibliotheken liegen bei `vendor/coolprop/LICENSE`, `vendor/pdfjs/LICENSE` und `vendor/pdf-lib/LICENSE`. RohrRunner selbst hat derzeit keine separate Lizenzdatei oder erklärte Projektlizenz; diese Drittbibliothekslizenzen gelten nicht für das übrige Projekt.
