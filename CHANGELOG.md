# Änderungsprotokoll

## 0.1.7 — Maßstab-Livevorschau

- Kalibrierungslinie folgt dem Mauszeiger nach dem ersten gesetzten Punkt.

## 0.1.6 — Einheitlicher Hintergrund

- Hintergrund der Seitenleisten-Reiter an die benachbarte PDF-Steuerleiste angeglichen.

## 0.1.5 — Kopfzeilenstatus

- Überschrift über den Seitenleisten-Reitern entfernt.
- Berechnungsstatus in die obere Kopfzeile verschoben.

## 0.1.4 — Seitenleisten-Reiter

- Seitenleiste in die Reiter Kühlstellen, Berechnung und Ergebnis gegliedert.
- Leitungsdaten einschließlich Zusatzlänge und Steigeleitung im Kühlstellen-Reiter gebündelt.
- Nach erfolgreicher Berechnung wird die Ergebnisliste automatisch angezeigt.

## 0.1.3 — Arbeitsregeln für Codex

- AGENTS.md dokumentiert Patch-Versionierung, synchronisierte Versionsstellen, Änderungsprotokoll und Commit-Regeln sowie fachliche Projektkonventionen.

## 0.1.2 — Auswahlwerkzeug

- Auswahl und Verschieben ist das Standardwerkzeug beim Start; das Symbol zeigt eine Hand.
- Nach dem Klick auf Netz berechnen wird das Auswahlwerkzeug aktiviert.

Bemerkenswerte Änderungen des Projekts nach Version. Jede abgeschlossene Änderung, Fehlerkorrektur, Verbesserung und Erweiterung erhält den kleinstmöglichen Versionssprung: eine Patch-Erhöhung. Minor- und Major-Sprünge erfolgen nur auf ausdrückliche Aufforderung. Dokumentationsänderungen folgen derselben Regel.

## 0.1.1 — Versionsregel und Dokumentation

- Versionspolitik dokumentiert: Änderungen werden mit Patchsprung, Commit und Push ausgeliefert; Minor-/Major-Sprünge nur auf Aufforderung.
- README, Berechnungsmodell, Architektur-, Fehler-, Sicherheits- und Mitwirkungsdokumentation auf den implementierten Stand abgestimmt.
- Versionsmetadaten und Anzeige auf 0.1.1 aktualisiert; keine Änderung am Berechnungsverhalten.

## 0.1.0 — Ausgangsstand

- Lokale Browseroberfläche zur grafischen Erfassung verzweigter Rohrnetze auf PDF-Grundrissen.
- Maßstabskalibrierung, orthogonales Zeichnen, automatische Abzweige, Verschieben sowie Undo/Redo.
- Vorbemessung von Saug- und Flüssigkeitsleitungen für R513A, R448A und unterkritisches R744.
- CoolProp 8.0.0 WebAssembly und lokaler Katalog für metrische Kupferrohre sowie zöllige K65-Rohre.
- Projektimport/-export, CSV-Ergebnisse und Plan-PDF-Export.
- Node.js-Tests für Stoff-/Netzberechnung, Geometrie, UI-Verträge und Exportpfade.
