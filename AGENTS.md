# Arbeitsregeln für Codex

## Versionsnummer, Änderungsprotokoll und Commit

- Jede abgeschlossene Änderung erhält genau einen kleinstmöglichen Versionssprung pro zusammengehörigem Arbeitspaket: Erhöhe ausschließlich die Patchnummer von `x.y.z` auf `x.y.(z+1)`. Minor- oder Major-Sprünge nur auf ausdrücklichen Wunsch.
- Halte die Version überall synchron: `package.json`, Versionsanzeige in `index.html`, Versionsangaben im `README.md` und ein neuer Eintrag ganz oben in `CHANGELOG.md`.
- Aktualisiere diese Versionsdateien auch bei reinen Dokumentationsänderungen. Für mehrere getrennte Arbeitspakete nicht stillschweigend nur einen Patchsprung verwenden.
- Wenn die angeforderte Änderung fertig und geprüft ist, erstelle einen aussagekräftigen Git-Commit für genau diese Änderung. Stage nur die zugehörigen Dateien; übernimm keine bereits vorhandenen, fremden Änderungen.
- Ein Commit ist kein Push. Push nur, wenn der Nutzer es ausdrücklich verlangt oder ein konkreter Release-/Pull-Request-Ablauf das erfordert.

## Projektkonventionen

- Dieses Projekt ist eine lokale Browseranwendung ohne Build-Schritt. Änderungen an Oberfläche, Editor und Solver gehören in die vorhandenen Dateien und Strukturen; vermeide unnötige Abhängigkeiten.
- Bei Solver- oder Fachänderungen Annahmen, Grenzen und Auswirkungen in `rohrnetz-berechnung-anleitung.md` dokumentieren. Keine technische Freigabe, Normerfüllung oder globale Optimalität behaupten, wenn sie nicht belegt ist.
- Rohrkatalog-Änderungen mit Quelle, Ausgabe, Einheiten und Gültigkeitsbedingungen dokumentieren. `data/pipe-catalog.json` und `data/pipe-catalog.js` müssen konsistent bleiben. Stoffwertänderungen mit `data/fluid-references.json`, `src/stoffdaten.js` und den Berechnungsannahmen abstimmen.
- Für Beispiel- und Testdaten ausschließlich synthetische Netze verwenden. Keine Kundenpläne, echten `.rohrrunner`-Projektdateien oder personenbezogenen Daten in Änderungen aufnehmen.
- Nutze vorhandene Tests in `tests/` passend zum geänderten Verhalten. Führe Tests aus, wenn der Nutzer sie verlangt oder die geltenden Arbeitsanweisungen es vorsehen; berichte klar, was geprüft wurde.