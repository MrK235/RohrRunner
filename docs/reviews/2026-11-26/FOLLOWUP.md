# Abarbeitung des Code Reviews vom 26. November 2026

Dieser Bericht ergänzt den [Ausgangsreview](REVIEW.md). Die dortigen Messungen und Reproduktionen bleiben als Ausgangszustand erhalten. Geprüft wurde unter Windows mit Node.js v24.22.3 und ausschließlich synthetischen Netzen. Ein Versionssprung wurde nicht angefordert.

## Umgesetzte Korrekturen

| Befund | Änderung | Stand |
| --- | --- | --- |
| R01 | PDF.js erhält bei beiden Importwegen `isEvalSupported: false` und `enableScripting: false`. | Die bekannte CVE-Konfiguration ist mitigiert. PDF.js 3.11.174 selbst ist noch nicht aktualisiert. |
| R02 | Jede fachliche Änderung entwertet einen laufenden Worker-Auftrag über `runId`, leert dessen Rückruf und sperrt dessen altes Ergebnis aus. | Reproduzierter Fehler behoben. Der Worker rechnet den verworfenen Auftrag gegebenenfalls noch zu Ende. |
| R03 | Der Solver prüft endliche Knoten- und Pfadkoordinaten, Pfadenden, Maßstab, IDs und Längen vor der Rechnung. | Reproduzierte NaN- und Geometriefälle abgewiesen. |
| R04 | Projektimporte prüfen Struktur, Referenzen, Grenzwerte, Base64 und eine eingebettete PDF-Seite vor dem Projektwechsel. | Deutlich eingegrenzt; nach Beginn des Wechsels fehlt noch eine vollständige Rücksetzung bei einem späten Ladefehler. |
| R05 | Die Editoroperation führt eine Verzweigung mit Steigleitung auf einer der verbleibenden Strecken nicht automatisch zusammen. | Der Verlust der Steigleitungslänge im Regressionsfall ist behoben. |
| R06 | Der lokale Server weist Rückwärtsschrägstriche im angefragten Pfad zurück. | Kodierte Windows-Pfadtrenner durchbrechen die Freigabeliste im Test nicht mehr. |
| R07 | Flüssigkeitszeile und Endpunkt verwenden für den Temperaturabstand dieselbe Blasenpunktbasis. | Reproduzierte Differenz beseitigt; Modellannahme in `PLAN.md`. |
| R08 | Kälteträger-Grenzverletzungen enthalten betroffene Kanten und Endpunkte; Tabellenzeilen erhalten eine Grenzwertklasse. | Teilweise: Zuordnung im Plan und CSV sowie mehrere kombinierte Verstöße brauchen End-to-End-Prüfung. |
| R09 | Die Tabelle erhält horizontales Scrollen und ausreichend breite Druckspalten. | CSS-Korrektur implementiert; visuelle Prüfung bei mehreren Fensterbreiten und Designs steht aus. |
| R10 | Das zu speichernde Projekt und der PDF-Name werden vor dem asynchronen PDF-Zugriff kopiert. | Reproduzierter Mischdatensatz verhindert. Eine serialisierte Speicherwarteschlange und verzögerte IndexedDB-Browserprüfung fehlen. |
| R11 | Kälteträger-Ergebniszeilen und Kindkanten werden für die Pfadprüfung indexiert. | Der synthetische Lastfall mit 1499 Kühlstellen schließt nun innerhalb des Prüfbudgets ab. Weitere Netzformen und Hardwareziele fehlen. |

Der Release-Workflow führt nun die vorhandene Suite und den Review-Audit vor dem Paketbau auf Linux und Windows aus. Es wurde kein Release ausgelöst.

## Prüfprotokoll

| Prüfung | Ergebnis |
| --- | --- |
| Review-Audit | 18 bestanden, 0 fehlgeschlagen; vorher 7 bestanden, 11 fehlgeschlagen; [Protokoll](followup-audit.json) |
| Vollständige vorhandene Testsuite | 88 bestanden, 0 fehlgeschlagen; [Protokoll](followup-tests.tap) |
| Lastprüfung | 10: 1,96 s; 100: 1,97 s; 500: 2,07 s; 1499: 3,24 s, jeweils einschließlich Kindprozessstart; [Protokoll](followup-stress.json) |

Die Lastprüfung verwendet einen manuell dimensionierten Kälteträgerbaum mit kurzen synthetischen Verbraucherabzweigen. Beim größten Fall wurden 2999 Knoten, 2998 Strecken und etwa 239 MiB Prozessspeicher gemeldet. Die Zeiten sind Einzelmessungen auf diesem Rechner und keine allgemeine Laufzeitzusage.

Die JSON-Protokolle nennen den zum Testzeitpunkt ausgecheckten `HEAD`; die hier beschriebenen Änderungen lagen während der Messung im Arbeitsbaum und wurden erst nach der Prüfung committet.

## Verbleibende Arbeit

1. PDF.js zusammen mit Worker und Desktop-CSP auf einen aktuell unterstützten Stand bringen und HTTP-, Offline- und `file://`-Betrieb im Browser prüfen.
2. Import und Projektwechsel als abgeschlossene Transaktion mit Rücksetzung nach jedem späten PDF-, Render- oder Speicherfehler ausführen.
3. Tabellen, Plan und CSV für kombinierte Kälteträgerwarnungen in realen Browserabläufen abgleichen; Layout bei 960, 1280 und 1600 px sowie beiden Designs visuell prüfen.
4. Speichervorgänge pro Projekt serialisieren, Worker-Aufträge tatsächlich abbrechen und große Netze mit mehreren Topologien und festgelegten Laufzeitzielen messen.
5. Berechnungen durch unabhängige Referenzwerte validieren. Der Audit prüft Rechenverknüpfungen, aber keine reale Anlage oder technische Freigabe.

Die im Ausgangsreview vorgeschlagenen Erweiterungen bleiben Vorschläge. Für Szenarien, Importvorschau, kritische Pfade und mehrseitige PDFs wurden in diesem Durchgang keine Funktionen implementiert.
