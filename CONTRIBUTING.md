# Mitwirken

## Lokaler Ablauf

1. Repository auschecken und `index.html` direkt im Browser öffnen oder mit `npm run serve` über localhost starten.
2. Änderungen an Oberfläche, Editor und Solver in den dafür vorgesehenen Dateien halten. Es gibt keinen Build-Schritt und kein separates Lint-Skript.
3. Bei Änderungen an Geometrie, Validierung oder Berechnung passende synthetische Tests in `tests/` ergänzen bzw. anpassen.
4. Tests mit `npm test` ausführen und das Ergebnis im Pull Request nennen.

## Fach- und Datenänderungen

- Neue Rohrdaten mit Quelle, Edition, Einheiten und Gültigkeitsbedingungen dokumentieren. `data/pipe-catalog.json` und das für den Browser verwendete `data/pipe-catalog.js` müssen zusammenpassen.
- Stoffwertänderungen in `data/fluid-references.json`, `src/stoffdaten.js` und den Berechnungsannahmen nachvollziehbar belegen.
- Solveränderungen in `rohrnetz-berechnung-anleitung.md` beschreiben. Abweichungen von Annahmen oder Konvergenzgrenzen sichtbar machen.
- Keine Funktion als technische Freigabe, Normerfüllung oder global optimale Dimensionierung bezeichnen, wenn sie das nicht nachweist.

## Datenschutz in Beiträgen

Öffentliche Issues und Pull Requests dürfen keine Kundenpläne, Gebäudegrundrisse, echten `.rohrrunner`-Projektdateien oder personenbezogenen Daten enthalten. Solche Dateien werden durch `.gitignore` ausgeschlossen. Für Beispiele synthetische Netze und PDFs ohne vertrauliche Metadaten verwenden.

## Pull Requests

Bitte beschreibe Zweck, sichtbare Auswirkungen, geänderte Berechnungsannahmen und Testabdeckung. Jede abgeschlossene Änderung, Fehlerkorrektur, Verbesserung und Erweiterung erhält einen Patchsprung: Bei `x.y.z` wird ausschließlich `z` erhöht, zum Beispiel `0.1.1` auf `0.1.2`. Pro zusammengehöriger Änderung gibt es einen Patchsprung. Minor- und Major-Versionen dürfen nur auf ausdrückliche Aufforderung erhöht werden.

Versionsnummer in `package.json`, Versionsanzeige in `index.html` und Eintrag in `CHANGELOG.md` gemeinsam aktualisieren. Änderungen nach der Prüfung committen und auf `main` pushen. Dokumentationsänderungen folgen derselben Patchregel; sie erhalten keinen größeren Versionssprung.
