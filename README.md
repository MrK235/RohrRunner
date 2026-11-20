# RohrRunner

**Rohrnetze zeichnen. Betriebspunkte prüfen. Ergebnisse nachvollziehen.**

RohrRunner ist eine lokale Browseranwendung zur grafischen Erfassung und technischen Vorbemessung von Kältemittelrohrnetzen. Auf einem PDF-Grundriss oder einer leeren Zeichenfläche entstehen rechtwinklige Leitungsnetze mit Verbund, Kühlstellen, Lasten und Betriebspunkten.

**Version 1.0.10** · PWA · Tauri Desktop · Kein Build-Schritt · Keine npm-Laufzeitpakete · Lokale Projektverwaltung

[Öffentliches Repository auf GitHub](https://github.com/MrK235/RohrRunner)

> [!IMPORTANT]
> RohrRunner ist ein Planungs- und Vorbemessungswerkzeug, keine technische Freigabe. Ergebnisse und Anwendungsgrenzen müssen vor der Ausführung durch die verantwortliche Fachplanung geprüft werden. Weder Normerfüllung noch globale Optimalität werden zugesichert.

## Schnellstart

1. Unter Windows `RohrRunner.bat`, unter Linux `./RohrRunner.sh` starten; beide Skripte starten den lokalen Server und öffnen RohrRunner im Browser. Alternativ kann `index.html` direkt geöffnet werden.
2. Optional einen PDF-Grundriss laden und den Maßstab mit zwei Punkten oder über `m / px` kalibrieren.
3. Einen Verbund und Kühlstellen setzen, Leistungen in kW eintragen und die Leitungen rechtwinklig verbinden.
4. Im Reiter **Berechnung** Kältemittel, Temperaturen und Grenzwerte prüfen.
5. **Netz berechnen** wählen und die Ergebnisse im Reiter **Ergebnis** prüfen.

Ein Server und Node.js sind für die Nutzung nicht erforderlich. RohrRunner kann über das Web-App-Menü des Browsers als PWA installiert werden. Dafür wird die Anwendung einmal über HTTPS oder den lokalen Entwicklungsserver geöffnet; die lokalen Laufzeitdateien werden für die Offline-Nutzung gecacht. Zusätzlich steht eine native Desktop-Verpackung mit Tauri zur Verfügung. Unter Linux wird daraus ein AppImage gebaut; die Windows-NSIS-Konfiguration ist vorbereitet und wird auf einem Windows-System gebaut. Für die Entwicklung steht ein lokaler Server zur Verfügung:

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
- Getrennte Berechnungsarten für Kältemittelkreise und Kälteträgerkreise mit Wasser, Ethylen- oder Propylenglykol
- Glykolkonzentration in Masse-%, Vor-/Rücklauftemperatur, kritischer Kreisdruckverlust und automatische Rohrwahl
- Rohrserien Viega Temponox Edelstahl und schwarzes Stahlrohr S195T nach EN 10255 M
- Druckverluste, Geschwindigkeiten, Temperaturverluste und Warnungen
- Kühlstellen und Rohrstrecken in der Ergebnisansicht; Rohrstrecken von den Kühlstellen über T-Stücke bis zum Verbund sortiert
- Lokale Projektverwaltung, `.rohrrunner`-Import, Ergebnis-CSV und Plan-PDF
- Projektpaket als ZIP mit vollständiger `.rohrrunner`, verfügbaren Berechnungs-/Material-CSV und Plan-PDF; der Plan mit PDF-Grundriss wird nur bei geladenem PDF ergänzt

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

## Medien und Startwerte

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

Für indirekte Kälteträgerkreise stehen Wasser, Ethylenglykol-Wasser und Propylenglykol-Wasser zur Verfügung. Die Glykolkonzentration wird als Masse-% eingegeben; das CoolProp-8.0.0-Stoffmodell deckt 0 bis 60 Masse-% ab. Der angezeigte Gefrierpunkt gehört zum Stoffdatenmodell und ist keine Produktempfehlung. Handelsübliche Inhibitorpakete und konkrete Produkt-/Werkstofffreigaben werden nicht modelliert.

## Berechnungsmodell und Grenzen

Der Kältemittel-Solver berechnet stationäre, einphasige Saug- und Flüssigkeitsleitungen in einem zusammenhängenden, kreisfreien Netzbaum. Der Kälteträger-Solver berechnet einen stationären, geschlossenen Flüssigkeitskreis und zählt Vor- und Rücklauf-Druckverluste entlang des ungünstigsten Pfads zusammen. Die eingezeichnete Baumstrecke repräsentiert den gemeinsamen Verlauf von Vor- und Rücklauf. Die automatische Rohrwahl ist eine begrenzte Upgrade-Heuristik und keine globale Kostenoptimierung.

Nicht abgedeckt sind unter anderem transkritisches CO₂, Druckgasleitungen, Verdichter- und Ventilauslegung, kombinierte Kreise, zeitabhängige Lasten, vollständige Teillast-Ölrückführung sowie Pumpenkennlinie, Durchflussabgleich, Druckhaltung und Wärmeaufnahme/Abgabe über die Kälteträgerrohre. Annahmen, Gleichungen und Gültigkeitsbereiche stehen in der [Berechnungsanleitung](PLAN.md); bekannte Einschränkungen in [BUGS.md](BUGS.md).

## Projekte und Datenschutz

Projekte werden im verwendeten Browser in IndexedDB gespeichert, einschließlich Netz, Einstellungen, Maßstab, letztem Ergebnis und gegebenenfalls PDF. **Sichern** erstellt ein ZIP-Paket mit der vollständigen `.rohrrunner`-Projektdatei, verfügbaren Berechnungs- und Material-CSV sowie dem Plan-PDF ohne Hintergrund. Wenn ein PDF-Grundriss geladen ist, enthält das ZIP zusätzlich den Plan mit PDF-Hintergrund. Die `.rohrrunner`-Datei enthält den geladenen Grundriss eingebettet und kann nach dem Entpacken direkt wieder geöffnet werden.

Es gibt keinen Anwendungsserver und keine Cloud-Synchronisierung. Projektdateien und Grundrisse können vertrauliche Daten enthalten; vor dem Teilen sind Inhalt und Metadaten zu prüfen. Für PDF-Funktionen verwendet der Browser die lokal mitgelieferten Bibliotheken.

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

# Desktop-Entwicklung und Linux-AppImage
npm install
npm run tauri:dev
npm run tauri:build:linux

# Windows auf einem Windows-System
npm run tauri:build:windows
```

Das Linux-AppImage liegt nach dem Build unter `src-tauri/target/release/bundle/appimage/`. Die Tauri-Anwendung lädt dieselben statischen Dateien wie die Browser- und PWA-Variante; Projekte und Berechnungen bleiben lokal. Für Windows ist das NSIS-Bundle einschließlich Anwendungssymbol und WebView2-Bootstrapper in `src-tauri/tauri.conf.json` vorbereitet.

Der Browser-/Solver-Testlauf benötigt Node.js, aber keine zusätzlichen npm-Laufzeitpakete; die Tauri-CLI wird nur für Desktop-Entwicklung und -Builds benötigt. Ein manueller Browser-Test wurde vom Projektverantwortlichen bestätigt; eine systematische Prüfung aller Browser- und Betriebssystemkombinationen liegt nicht vor. Die Berechnungsergebnisse sind noch nicht unabhängig anhand von Referenzfällen verifiziert. Die Tests und der Browser-Test ersetzen keine fachliche Anlagenprüfung.

Mehr dazu: [Architektur](ARCHITECTURE.md) · [Mitwirken](CONTRIBUTING.md) · [Änderungsprotokoll](CHANGELOG.md) · [Sicherheitsmeldungen](SECURITY.md)

**Lizenzhinweis:** Die Lizenzen der mitgelieferten Drittbibliotheken liegen bei `vendor/coolprop/LICENSE`, `vendor/pdfjs/LICENSE` und `vendor/pdf-lib/LICENSE`. RohrRunner selbst hat derzeit keine separate Lizenzdatei oder erklärte Projektlizenz; diese Drittbibliothekslizenzen gelten nicht für das übrige Projekt.
