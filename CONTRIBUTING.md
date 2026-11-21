# Mitwirken

## Lokaler Ablauf

1. Repository auschecken und `index.html` direkt im Browser öffnen oder mit `npm run serve` über localhost starten.
2. Änderungen an Oberfläche, Editor und Solver in den dafür vorgesehenen Dateien halten. Es gibt keinen Build-Schritt und kein separates Lint-Skript.
3. Bei Änderungen an Geometrie, Validierung oder Berechnung passende synthetische Tests in `tests/` ergänzen bzw. anpassen.
4. Tests mit `npm test` ausführen; der Runner wählt anhand der geänderten Dateien nur die relevanten Tests. Die vollständige Suite ist mit `npm run test:all` verfügbar und sollte nur bei Solver-/Katalogänderungen oder gezieltem Bedarf laufen.

## Fach- und Datenänderungen

- Neue Rohrdaten mit Quelle, Edition, Einheiten und Gültigkeitsbedingungen dokumentieren. `data/pipe-catalog.json` und das für den Browser verwendete `data/pipe-catalog.js` müssen zusammenpassen.
- Stoffwertänderungen in `data/fluid-references.json`, `src/stoffdaten.js` und den Berechnungsannahmen nachvollziehbar belegen.
- Solveränderungen in `PLAN.md` beschreiben. Abweichungen von Annahmen oder Konvergenzgrenzen sichtbar machen.
- Keine Funktion als technische Freigabe, Normerfüllung oder global optimale Dimensionierung bezeichnen, wenn sie das nicht nachweist.

## Datenschutz in Beiträgen

Öffentliche Issues und Pull Requests dürfen keine Kundenpläne, Gebäudegrundrisse, echten `.rohrrunner`-Projektdateien oder personenbezogenen Daten enthalten. Solche Dateien werden durch `.gitignore` ausgeschlossen. Für Beispiele synthetische Netze und PDFs ohne vertrauliche Metadaten verwenden.

## Pull Requests

Bitte beschreibe Zweck, sichtbare Auswirkungen, geänderte Berechnungsannahmen und Testabdeckung. Bei normalen Änderungen bleibt die Versionsnummer unverändert. Nur bei einem ausdrücklich beauftragten Release wird ausschließlich die Patchnummer in `x.y.z` erhöht; Minor- und Major-Releases erfolgen nur nach gesonderter Freigabe.

Bei einem Release Versionsnummer in `package.json`, Versionsanzeigen in `index.html` und `README.md` sowie Eintrag in `CHANGELOG.md` gemeinsam aktualisieren. Tests und manuelle Prüfungen mit Umfang und Grenzen dokumentieren. Änderungen nach der Prüfung committen; Push und GitHub-Release nur nach ausdrücklichem Auftrag.
