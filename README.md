# RohrRunner

**Rohrnetze zeichnen. Betriebspunkte prüfen. Ergebnisse nachvollziehen.**

RohrRunner ist eine lokale Browseranwendung zur grafischen Erfassung und technischen Vorbemessung von Kältemittelrohrnetzen. Auf einem PDF-Grundriss oder einer leeren Zeichenfläche entstehen rechtwinklige Leitungsnetze mit Start, Kühlstellen, Lasten und Betriebspunkten.

**Version 1.2.0** · PWA · Tauri Desktop · Kein Build-Schritt · Keine npm-Laufzeitpakete · Lokale Projektverwaltung

[Öffentliches Repository auf GitHub](https://github.com/MrK235/RohrRunner)

> [!IMPORTANT]
> RohrRunner ist ein Planungs- und Vorbemessungswerkzeug, keine technische Freigabe. Ergebnisse und Anwendungsgrenzen müssen vor der Ausführung durch die verantwortliche Fachplanung geprüft werden. Weder Normerfüllung noch globale Optimalität werden zugesichert.

## Schnellstart

1. Unter Windows `RohrRunner.bat`, unter Linux `./RohrRunner.sh` starten; beide Skripte starten den lokalen Server und öffnen RohrRunner im Browser. Alternativ kann `index.html` direkt geöffnet werden.
2. Optional einen PDF-Grundriss laden und den Maßstab mit zwei Punkten oder über `m / px` kalibrieren.
3. Einen Start und Kühlstellen setzen, Leistungen in kW eintragen und die Leitungen rechtwinklig verbinden. Beim Leitungszeichnen nimmt Rechtsklick den letzten Richtungswechsel zurück; Doppelklick beendet die Leitung mit einem T-Stück an der angeklickten Position.
4. Im Reiter **Berechnung** Kältemittel, Temperaturen und Grenzwerte prüfen.
5. **Netz berechnen** wählen und die Ergebnisse im Reiter **Ergebnis** prüfen.

Tastatur: Mit Tab die Zeichenfläche oder bestehende Knoten und Rohrstrecken fokussieren. Auf der Zeichenfläche verschieben Pfeiltasten die Position (Umschalt für Einzelschritte), Eingabe setzt einen Punkt; beim Leitungszeichnen nimmt Rückschritt die letzte Ecke zurück und **F** beendet die Leitung am aktuellen Punkt. Bestehende Knoten und Strecken werden mit Eingabe aktiviert. Das freie Verschieben vorhandener Objekte benötigt weiterhin einen Pointer.

Ein Server und Node.js sind für die Nutzung nicht erforderlich. RohrRunner kann über das Web-App-Menü des Browsers als PWA installiert werden. Dafür wird die Anwendung einmal über HTTPS oder den lokalen Entwicklungsserver geöffnet; nur die bekannten lokalen Laufzeitdateien werden für die Offline-Nutzung gecacht. Zusätzlich steht eine native Desktop-Verpackung mit Tauri zur Verfügung. Unter Linux wird daraus ein AppImage gebaut; die Windows-NSIS-Konfiguration ist vorbereitet und wird auf einem Windows-System gebaut. Für die Entwicklung steht ein lokaler Server zur Verfügung:

```bash
npm run serve
# anschließend http://127.0.0.1:4173 öffnen
```

`ROHRRUNNER_PORT` kann den Port ändern. Die Desktop-WebView begrenzt Ressourcen über eine Content Security Policy; die lokal mitgelieferten PDF-/Stoffdatenmodule benötigen dabei weiterhin dynamische Codeauswertung (`unsafe-eval`). Alle benötigten Laufzeitbibliotheken einschließlich PDF.js, pdf-lib und CoolProp liegen im Projekt und werden lokal geladen. Die Anwendung funktioniert daher auch ohne Internetverbindung; externe Links in der Oberfläche sind nur optionale Projektverweise.

## Funktionen

- PDF-Grundriss als Zeichenunterlage, Kalibrierung, Zoom und Verschieben
- Orthogonale Leitungen, automatische T-Stücke sowie Undo/Redo
- Mehrere Kühlstellen mit frei definierbaren Leistungen
- Saug- und Flüssigkeitsleitungen mit automatischer oder manueller Rohrwahl; lokal berechnete Kältemittel R513A, R448A, R744, R134a, R404A, R407C, R449A und R452A
- Betriebspunkte, Höhendifferenzen, Zusatzlängen und Einzelwiderstände je Abschnitt
- Getrennte Berechnungsarten für Kältemittelkreise und Kälteträgerkreise mit Wasser, Ethylen- oder Propylenglykol
- Glykolkonzentration in Masse-%, Vor-/Rücklauftemperatur, kritischer Kreisdruckverlust und automatische Rohrwahl
- Rohrserien Viega Temponox Edelstahl und schwarzes Stahlrohr S195T nach EN 10255 M
- Druckverluste, Geschwindigkeiten, Temperaturverluste und Warnungen
- Kühlstellen und Rohrstrecken in der Ergebnisansicht; Rohrstrecken von den Kühlstellen über T-Stücke bis zum Start sortiert
- Lokale Projektverwaltung, `.rohrrunner`-Import, Berechnungs- und Material-CSV sowie Rohrnetz-PDF
- Projektpaket als ZIP mit vollständiger `.rohrrunner`, verfügbaren CSV-Listen und Rohrnetz-PDF; die Fassung mit Grundriss wird nur bei geladenem PDF ergänzt

## Rohrnetz-PDF

Das Rohrnetz-PDF zeigt den Ausschnitt um das gezeichnete Netz auf einem A3-Blatt (quer oder hoch je nach Netzform) mit Längen, Rohrmaßen, Knotennamen und einem Schriftfeld mit Projekt, Medium, Gesamtleistung, Berechnungsstand, Datum, Programmversion und ungefährem Maßstab. Ohne kalibrierten Maßstab entfällt die Maßstabsangabe. Ist ein Grundriss geladen, entsteht zusätzlich eine Fassung mit dem passenden, abgeblendeten Planausschnitt; gedrehte PDF-Seiten werden dabei ohne Grundriss ausgegeben. Rohrmaße erscheinen nur bei aktueller Berechnung.

## Ergebnis-CSV

Die Berechnungs-CSV ist in Abschnitte gegliedert: Kopfdaten (Projekt, Stand, Programmversion, Hinweis zur Vorbemessung), Auslegungsvorgaben und Ergebnisübersicht als Parameter/Wert/Einheit, eine Tabelle der Kühlstellen, die Rohrstrecken in derselben Reihenfolge wie in der Ergebnisansicht und zuletzt die Hinweise der Berechnung.

Je Rohrstrecke enthält sie Nummer, Von und Nach, Länge, Zusatzlänge, gegebenenfalls Steigleitung, Leistung, Massenstrom, Rohrgröße SL und FL samt automatischer oder manueller Wahl, Geschwindigkeit, Druckverlust in K und bar, Verdampfungs- und Flüssigkeitstemperatur sowie einen Status. Kälteträgerkreise erhalten dieselbe Gliederung mit Vor- und Rücklauf, Volumen- und Massenstrom, Druckverlust in kPa und Reynolds-Zahl.

Einheiten stehen in den Spaltenköpfen, die Zellen enthalten reine Zahlen mit Dezimalkomma; so lassen sich Werte in deutscher Tabellenkalkulation direkt sortieren und summieren. Die Material-CSV enthält Positionsnummern, Rohrsystem mit Werkstoff und Norm sowie Summen je Gruppe. Beide Dateien nutzen Semikolontrennung. Namen, die Tabellenprogramme als Formel ausführen könnten, erhalten ein führendes Apostroph. Nach einer Änderung am Netz oder Betriebspunkt sind Berechnungs- und Material-CSV erst nach erneuter Berechnung wieder exportierbar; ein Projektpaket enthält weiterhin die aktuelle Projektdatei und das Rohrnetz-PDF, aber keine veralteten Ergebnis-CSV.

## Medien und Startwerte

Unterstützt werden **R513A**, **R448A**, **R744 / CO₂**, **R134a**, **R404A**, **R407C**, **R449A** und **R452A**. Die fünf ergänzten Stoffe nutzen lokal mitgelieferte CoolProp-8.0.0-Modelldaten; ihre Viskosität ist nicht unabhängig produktspezifisch validiert. R744 wird nur im unterkritischen Bereich ausgelegt; transkritische Druckgasleitungen sind nicht enthalten.

| Vorgabe | Startwert (außer R744) |
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

Projekte werden im verwendeten Browser in IndexedDB gespeichert, einschließlich Netz, Einstellungen, Maßstab, letztem Ergebnis und gegebenenfalls PDF. **Sichern** erstellt ein ZIP-Paket mit der vollständigen `.rohrrunner`-Projektdatei, verfügbaren Berechnungs- und Material-CSV sowie dem Rohrnetz-PDF. Wenn ein PDF-Grundriss geladen ist, enthält das ZIP zusätzlich das Rohrnetz-PDF mit Grundriss. Die Dateien im ZIP tragen das Erstellungsdatum. Die `.rohrrunner`-Datei enthält den geladenen Grundriss eingebettet und kann nach dem Entpacken direkt wieder geöffnet werden.

Es gibt keinen Anwendungsserver und keine Cloud-Synchronisierung. Der Import ist auf 50 MiB pro Projektdatei, 3000 Knoten, 5000 Rohrstrecken und 25 MiB pro PDF begrenzt; PDF-Seiten mit einer Breite oder Höhe über 10000 PDF-Einheiten werden abgewiesen; die Rasterauflösung beim Zoomen ist begrenzt. Diese Grenzen schützen den Browser vor übergroßen Eingaben und sind keine fachlichen Auslegungsgrenzen. Projektdateien und Grundrisse können vertrauliche Daten enthalten; vor dem Teilen sind Inhalt und Metadaten zu prüfen. Für PDF-Funktionen verwendet der Browser die lokal mitgelieferten Bibliotheken.

## Entwicklung

RohrRunner besteht aus statischen Browserdateien. Wichtige Bereiche:

- `src/app.js` – Oberfläche, Editor und Exporte
- `src/editor-core.js` – Geometrie und Netzbearbeitung
- `src/engine.js` – Berechnung und Dimensionierung
- `src/stoffdaten.js` – Stoffdatenzugriff
- `src/worker.js` / `src/worker-bundle.js` – Berechnungs-Worker
- `src/zip.js` – ZIP-Erstellung für lokale Projektpakete
- `vendor/pdfjs/` und `vendor/pdf-lib/` – lokale PDF-Bibliotheken inklusive Lizenzen
- `vendor/fonts/` – lokal mitgelieferte, auf benötigte Zeichen reduzierte Schriften Noto Sans/Noto Sans Mono (SIL OFL 1.1) und DejaVu Sans für Pfeile und Symbole, jeweils mit Lizenz
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

Der Desktop-Build erzeugt das eigenständige Worker-Bundle vor dem Kopieren der Laufzeitdateien neu. Unter Ubuntu/TUXEDO müssen die Entwicklungsbibliotheken für WebKitGTK 4.1, GTK 3 und libsoup 3 sowie die weiteren Tauri-Buildvoraussetzungen installiert sein (siehe `.github/workflows/release.yml`). Rust und die Tauri-CLI allein reichen nicht aus.

Das Linux-AppImage liegt nach dem Build unter `src-tauri/target/release/bundle/appimage/`. Die Tauri-Anwendung lädt dieselben statischen Dateien wie die Browser- und PWA-Variante; Projekte und Berechnungen bleiben lokal. Für Windows ist das NSIS-Bundle einschließlich Anwendungssymbol und WebView2-Bootstrapper in `src-tauri/tauri.conf.json` vorbereitet.

Der Browser-/Solver-Testlauf benötigt Node.js, aber keine zusätzlichen npm-Laufzeitpakete; die Tauri-CLI wird nur für Desktop-Entwicklung und -Builds benötigt. Ein manueller Browser-Test wurde vom Projektverantwortlichen bestätigt; eine systematische Prüfung aller Browser- und Betriebssystemkombinationen liegt nicht vor. Die Berechnungsergebnisse sind noch nicht unabhängig anhand von Referenzfällen verifiziert. Die Tests und der Browser-Test ersetzen keine fachliche Anlagenprüfung.

Mehr dazu: [Architektur](ARCHITECTURE.md) · [Mitwirken](CONTRIBUTING.md) · [Änderungsprotokoll](CHANGELOG.md) · [Sicherheitsmeldungen](SECURITY.md)

**Lizenzhinweis:** Die Lizenzen der mitgelieferten Drittbibliotheken liegen bei `vendor/coolprop/LICENSE`, `vendor/pdfjs/LICENSE` und `vendor/pdf-lib/LICENSE`. RohrRunner selbst hat derzeit keine separate Lizenzdatei oder erklärte Projektlizenz; diese Drittbibliothekslizenzen gelten nicht für das übrige Projekt.
