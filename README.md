# RohrRunner

**RohrRunner 0.1.7** ist eine lokale Browseranwendung zur grafischen Erfassung und technischen Vorbemessung verzweigter Kältemittelrohrnetze. Ein PDF-Grundriss dient als Zeichenfläche. Rohrnetz, Betriebspunkt und Lasten werden im Browser bearbeitet und mit dem lokalen Rechenkern ausgewertet.

> RohrRunner ist ein Planungs- und Vorbemessungswerkzeug. Die Berechnung ersetzt weder die verantwortliche Fachplanung noch Herstellerfreigaben, Normprüfung oder die Abnahme einer Anlage.

## Funktionen

- PDF-Grundriss öffnen, per Drag-and-drop laden und mit zwei bekannten Punkten kalibrieren.
- Einen Anlagenstart und beliebig viele Kühlstellen setzen; Rohrleitungen rechtwinklig zeichnen.
- Knoten und Leitungsabschnitte verschieben, verzweigte Schnittpunkte automatisch verbinden sowie Änderungen rückgängig machen und wiederholen.
- Betriebspunkt, Gleichzeitigkeit, Lasten, Rohrhöhen und zusätzliche Einzelwiderstände erfassen.
- Saug- und Flüssigkeitsleitungen automatisch dimensionieren oder je Abschnitt eine Kataloggröße festlegen.
- Druckverluste, Geschwindigkeiten, Rohrgrößen, Endpunktreserven und Grenzwertmeldungen anzeigen.
- Berechnungsergebnisse als CSV, den Plan als PDF und ein vollständiges Projekt als `.rohrrunner` exportieren.
- Die Seitenleiste über die Reiter **Kühlstellen**, **Berechnung** und **Ergebnis** bedienen; nach einem erfolgreichen Lauf öffnet sich die Ergebnisliste automatisch.
- Projekte lokal im Browser zwischenspeichern.

## Schnellstart

Es gibt keinen Build-Schritt und keine npm-Laufzeitabhängigkeiten.

1. `index.html` im aktuellen Browser öffnen oder `RohrRunner.bat` starten.
2. Optional für den zuverlässigen Worker-Betrieb einen lokalen Server verwenden:

   ```powershell
   npm run serve
   ```

   Danach `http://127.0.0.1:4173` öffnen. Den Port kann `ROHRRUNNER_PORT` festlegen.

3. PDF-Grundriss öffnen, den Maßstab kalibrieren, Anlagenstart und Kühlstellen einzeichnen, Leitungen verbinden und Lasten sowie Betriebsdaten erfassen. Für R744 muss die Verflüssigungstemperatur unter etwa 30,98 °C liegen.
4. **Netz berechnen** wählen. Danach können Ergebnis-CSV, Plan-PDF oder die Projektdatei heruntergeladen werden.

PDF-Import und PDF-Export benötigen eine Internetverbindung, weil PDF.js und pdf-lib beim Seitenaufruf von Cloudflare bzw. jsDelivr geladen werden. Die Rechen- und Stoffdaten liegen im Repository. Wird `index.html` direkt mit `file://` gestartet, läuft die Berechnung ohne Web Worker im Browser-Hauptthread.

## Bedienung

### Plan und Rohrnetz

- **PDF-Grundriss:** PDF-Datei auswählen oder auf die Planansicht ziehen. Aktuell wird Seite 1 verwendet.
- **Maßstab:** Werkzeug aktivieren, zwei Punkte mit bekannter Entfernung anklicken und eine positive reale Länge eingeben. Der Maßstab wird als Meter pro PDF-Pixel gespeichert. Alternativ kann `m / px` direkt eingetragen werden.
- **Start:** Einen Anlagenstart setzen. Ein Netz benötigt genau einen Start.
- **Lasten:** Kühlstellen fortlaufend setzen und jeweils Name sowie Kälteleistung in kW eintragen. Dezimal-Komma und Dezimal-Punkt werden akzeptiert.
- **Leitung:** Vom Start bzw. einem bestehenden Netzknoten aus orthogonale Abschnitte zeichnen. Bei einem Schnitt mit einer vorhandenen Leitung wird ein Abzweig erzeugt.
- **Auswahl:** Knoten oder Leitungsabschnitt auswählen und ziehen. Die Ansicht kann durch Ziehen auf dem Hintergrund, mittlere Maustaste oder Leertaste verschoben werden; Mausrad und Zoom-Schaltflächen ändern den Zoom.
- **Leitungsdaten:** Im Reiter **Kühlstellen** einen Abschnitt auswählen, um manuelle Rohrgrößen, Höhendifferenzen je Leitungstyp (einschließlich Steigeleitung), Zusatzlänge und Summe der Einzelwiderstände `Σζ` festzulegen.
- **Undo / Redo / Löschen:** Änderungen am Netz bearbeiten. **Neu** startet nach Bestätigung ein leeres Projekt.

### Betriebspunkt und Auslegung

Einstellbar sind Kältemittel, Gleichzeitigkeit, Verdampfungs- und Verflüssigungstemperatur, Sauggasüberhitzung, Unterkühlung, Grenzwerte für Druckverlust und Geschwindigkeit, Auslegungsdruck, Rauheit, Reibungszuschlag und Viskositätszuschlag. Die Oberfläche startet mit folgenden Werten:

| Parameter | Startwert |
| --- | ---: |
| Kältemittel | R513A |
| Gleichzeitigkeit | 1,00 |
| Verdampfung / Verflüssigung | −10 °C / 45 °C |
| Überhitzung / Unterkühlung | 5 K / 3 K |
| Max. Saug- / Flüssigkeitsverlust | 2 K / 2 K |
| Mindest- / Maximalgeschwindigkeit | 6 m/s / 10 m/s |
| Auslegungsdruck | 35 bar Überdruck |
| Rohrrauheit | 1,5 µm |
| Reibungs- / Viskositätszuschlag | 1,5 / 15 % |

Beim Wechsel auf R744 setzt die Oberfläche den Auslegungsdruck auf mindestens 100 bar. R744 wird nur unterkritisch gerechnet; Verflüssigungstemperaturen am oder über dem kritischen Punkt werden abgewiesen.

### Ergebnis

Die Ergebnistabelle enthält je Leitungsabschnitt Saug- und Flüssigkeitsdaten: gewählte Größe, Länge, Massenstrom, Geschwindigkeit, Druckverlust und Temperaturverlust. Für jede Kühlstelle werden außerdem Saugverlust, Flüssigkeitsverlust, verbleibende Unterkühlung und Enddrücke berechnet. Ein Status weist auf verletzte Grenzen bzw. nicht erfüllte Voraussetzungen hin. Ergebnisse können als semikolongetrennte CSV mit UTF-8-BOM exportiert werden.

## Kältemittel und Rohrkatalog

Unterstützt werden:

- **R513A** und **R448A** mit dem metrischen cupromed/cuprofrio-Katalog.
- **R744 (CO₂)** im unterkritischen Betrieb mit der zölligen Wieland-K65-120-bar-Serie.

Die Rohrgrößen, Wandstärken, Katalogdruckangaben und Datenquellen liegen in `data/pipe-catalog.json`; `data/pipe-catalog.js` stellt denselben Katalog für direkt geöffnete HTML-Dateien bereit. Stoffdaten werden über CoolProp 8.0.0 WebAssembly aus `vendor/coolprop/` geladen. Für bestimmte R448A- und R513A-Bereiche nutzt der Solver vorberechnete Interpolationen und fällt außerhalb dieser Bereiche auf die CoolProp-Berechnung zurück. Quellen und Stoffwertannahmen stehen in `data/fluid-references.json` und `src/stoffdaten.js`.

## Projekte, Speicherung und Datenschutz

- Automatisches Zwischenspeichern legt Netz, Einstellungen, Maßstab und das letzte Berechnungsergebnis in `localStorage` des verwendeten Browsers ab. Der geladene Grundriss wird dabei **nicht** mitgespeichert.
- Eine `.rohrrunner`-Projektdatei enthält Projekt, Netz und Einstellungen sowie, falls ein Grundriss geladen war, auch die PDF als Base64-Daten. Damit lässt sich eine Sitzung vollständig sichern und auf einem anderen Rechner öffnen.
- Plan, Lasten und Projekte werden im aktuellen Programmablauf lokal verarbeitet; es gibt keinen Anwendungsserver und keine Cloud-Synchronisierung. Für PDF-Bedienung lädt der Browser jedoch PDF.js und pdf-lib von den oben genannten CDNs.
- Grundrisse und `.rohrrunner`-Dateien sind in `.gitignore` ausgeschlossen. Sie können Gebäude- und Projektdaten enthalten und gehören nur nach bewusster Prüfung in ein öffentliches Repository.

## Entwicklung und Tests

Voraussetzung für den lokalen Testlauf ist Node.js. Zusätzliche npm-Pakete werden nicht benötigt.

```powershell
npm test
```

Der Befehl führt `node --test tests/*.test.mjs` aus. Die Tests decken unter anderem Netzvalidierung, Reibungsfaktor, drei Kältemittel, Editor-Geometrie, Maßstabs-/UI-Verträge und den Exportwiederherstellungsfall mit synthetischen PDF-Bytes ab. Sie sind keine technische Anlagenabnahme.

Weitere Entwicklerhinweise: [CONTRIBUTING.md](CONTRIBUTING.md). Komponenten und Datenfluss: [ARCHITECTURE.md](ARCHITECTURE.md). Berechnungsmodell und Annahmen: [rohrnetz-berechnung-anleitung.md](rohrnetz-berechnung-anleitung.md).

## Projektdateien

| Pfad | Zweck |
| --- | --- |
| `index.html`, `src/style.css` | Browseroberfläche |
| `src/app.js` | UI-Steuerung, PDF-Ansicht, Projektimport/-export und Ergebnisdarstellung |
| `src/editor-core.js` | Geometrie- und Netzeditorfunktionen |
| `src/engine.js` | Netzprüfung, Hydraulik, Dimensionierung und Ergebnisberechnung |
| `src/stoffdaten.js`, `src/fast-data.js` | Stoffdatenzugriff, CoolProp und Interpolationspfade |
| `src/worker.js` | Berechnungs-Worker für HTTP(S)-Betrieb |
| `data/` | Rohrkatalog und Stoffdatenreferenzen |
| `vendor/coolprop/` | Lokale CoolProp-Laufzeit einschließlich Lizenzdatei |
| `tests/` | Node.js-Tests für Editor und Rechenkern |
| `scripts/serve.mjs` | Optionaler lokaler HTTP-Server |
| `CHANGELOG.md`, `BUGS.md`, `SECURITY.md` | Versionsnotizen, Fehler-/Einschränkungsübersicht und Sicherheitsmeldungen |

## Technischer Umfang und Grenzen

RohrRunner rechnet stationäre, einphasige Saug- und Flüssigkeitsleitungen in einem zusammenhängenden, kreisfreien Netzbaum. Nicht implementiert sind transkritisches CO₂, Druckgasleitungen, Verdichter-/Ventilauslegung, kombinierte Kreise, zeitabhängige Lasten, Teillast-Ölrückführung oder ein global kostenoptimierender Nennweitenvergleich. Nicht eingetragene Höhenunterschiede gelten als 0 m; die Flüssigkeitstemperatur bleibt entlang der Flüssigkeitsleitung konstant. Die automatische Nennweitenwahl ist eine begrenzte Upgrade-Heuristik.

Die vollständigen Modellannahmen stehen im [Berechnungsleitfaden](rohrnetz-berechnung-anleitung.md); bekannte Einschränkungen und Hinweise zu Fehlerberichten stehen in [BUGS.md](BUGS.md).

## Version und Lizenz

Der Softwarestand ist **0.1.7**. Jede abgeschlossene Änderung, Fehlerkorrektur, Verbesserung und Erweiterung erhält den kleinstmöglichen Versionssprung: eine Erhöhung der Patchnummer. Minor- und Major-Sprünge erfolgen nur auf ausdrückliche Aufforderung. Jede Änderung wird dokumentiert, committed und nach der Prüfung gepusht. Die Versionsnummern in `package.json` und in der Oberfläche werden gemeinsam aktualisiert. Siehe [CONTRIBUTING.md](CONTRIBUTING.md) und [CHANGELOG.md](CHANGELOG.md). Im Repository liegt eine MIT-Lizenz für die mitgelieferte CoolProp-Laufzeit unter `vendor/coolprop/LICENSE`; eine separate Projektlizenz für RohrRunner ist derzeit nicht enthalten.
