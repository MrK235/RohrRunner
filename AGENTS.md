# Arbeitsregeln für Codex

## Versionsnummer, Änderungsprotokoll und Commit

- Versionssprünge und Einträge in `CHANGELOG.md` erst vornehmen, wenn der Nutzer ausdrücklich darum bittet oder einen Commit beauftragt. Änderungen bis dahin sammeln, damit zusammengehörige Arbeit in einem Versionssprung gebündelt werden kann.
- Bei einem angeforderten Versionssprung oder Commit ausschließlich die Patchnummer erhöhen und Version sowie Versionsanzeige in `package.json`, `index.html` und `README.md` synchron halten; einen neuen Eintrag ganz oben in `CHANGELOG.md` ergänzen.
- Nach Abschluss jeder angeforderten Änderung einen aussagekräftigen Git-Commit erstellen. Versionssprung und Changelog-Eintrag einschließen, ausschließlich die zugehörigen Dateien stagen und keine vorhandenen fremden Änderungen übernehmen.
- Push nur auf ausdrücklichen Auftrag des Nutzers. Ein Commit ist kein Push.

## Projektkonventionen

- Dieses Projekt ist eine lokale Browseranwendung ohne Build-Schritt. Änderungen an Oberfläche, Editor und Solver gehören in die vorhandenen Dateien und Strukturen; vermeide unnötige Abhängigkeiten.
- Bei Solver- oder Fachänderungen Annahmen, Grenzen und Auswirkungen in `rohrnetz-berechnung-anleitung.md` dokumentieren. Keine technische Freigabe, Normerfüllung oder globale Optimalität behaupten, wenn sie nicht belegt ist.
- Rohrkatalog-Änderungen mit Quelle, Ausgabe, Einheiten und Gültigkeitsbedingungen dokumentieren. `data/pipe-catalog.json` und `data/pipe-catalog.js` müssen konsistent bleiben. Stoffwertänderungen mit `data/fluid-references.json`, `src/stoffdaten.js` und den Berechnungsannahmen abstimmen.
- Für Beispiel- und Testdaten ausschließlich synthetische Netze verwenden. Keine Kundenpläne, echten `.rohrrunner`-Projektdateien oder personenbezogenen Daten in Änderungen aufnehmen.
- Nutze vorhandene Tests in `tests/` passend zum geänderten Verhalten. Führe Tests aus, wenn der Nutzer sie verlangt oder die geltenden Arbeitsanweisungen es vorsehen; berichte klar, was geprüft wurde.
