# Bekannte Fehler und Einschränkungen

Diese Datei hält reproduzierbare Defekte und für Nutzende sichtbare Einschränkungen fest. Sie ist kein Nachweis einer fehlerfreien oder vollständig geprüften Software. Für Version 1.0.0 wurde ein manueller Browser-Test vom Projektverantwortlichen bestätigt; Browser- und Betriebssystemkombinationen wurden nicht systematisch abgedeckt. Eine unabhängige Verifikation der Berechnungsergebnisse anhand von Referenzfällen steht noch aus.

## Offene, reproduzierbare Defekte

Der [Code Review vom 26. November 2026](docs/reviews/2026-11-26/REVIEW.md) untersucht Version **1.2.5** (`2d36441`). Der [Folgebericht](docs/reviews/2026-11-26/FOLLOWUP.md) hält die Korrekturen und verbleibenden Prüflücken fest. Die Version blieb unverändert.

| ID | Priorität | Befund | Vorläufige Umgehung |
| --- | --- | --- | --- |
| R04 | P1 | Struktur und PDF werden vor dem Import geprüft; ein Fehler nach Beginn des Projektwechsels kann den Editor weiterhin teilweise umstellen. | Vorher sichern; bei Fehlern neu laden und gespeichertes Projekt öffnen. |
| R08 | P2 | Kälteträgerwarnungen tragen nun Kantenbezüge und Tabellenmarkierungen; die Zuordnung im Plan und CSV ist noch nicht durchgehend geprüft. | Globale Meldungen und Einzelwerte prüfen. |
| R09 | P2 | Die Ergebnisbreiten wurden angepasst, aber die Darstellung bei mehreren Fensterbreiten wurde noch nicht visuell nachgeprüft. | Werte bei engen Fenstern über den CSV-Export prüfen. |

R01–R03, R05–R07 und R11 sind mit den dokumentierten Regressionsfällen behoben beziehungsweise mitigiert. R10 ist für den reproduzierten Mischdatensatz durch eine Momentaufnahme korrigiert; eine serialisierte Speicherwarteschlange und Browserprüfung unter verzögertem IndexedDB-Zugriff fehlen noch. Ein Browser-Datenverlust wurde nicht nachgewiesen.

## Bekannte Einschränkungen

| Bereich | Verhalten | Auswirkung / Umgehung |
| --- | --- | --- |
| PWA-Cache | Die PWA wird beim ersten Aufruf über HTTPS oder localhost installiert und cached anschließend die lokalen Laufzeitdateien. | Vor der ersten erfolgreichen Cache-Installation ist der Offline-Betrieb noch nicht verfügbar. |
| Direktstart mit `file://` | Die App versucht einen Blob-Worker aus dem eingebetteten Bundle; bei blockiertem Worker fällt sie auf den Hauptthread zurück. | Im Rückfall kann die Oberfläche bei umfangreichen Netzen blockieren. Der reale Direktstart wurde im Review nicht browserübergreifend geprüft. |
| Mehrseitige Pläne | Es wird Seite 1 der gewählten PDF angezeigt und verwendet. | Weitere PDF-Seiten müssen separat bereitgestellt werden; Seitenwechsel ist nicht implementiert. |
| Browser-Speicher | IndexedDB speichert Projekte einschließlich PDF lokal im verwendeten Browserprofil. | Browserdaten können durch Nutzende oder Browserverwaltung gelöscht werden; für Austausch und externe Sicherung `.rohrrunner` exportieren. |
| Tastaturbedienung | Knoten und Strecken können über die fokussierbare Zeichenfläche und die SVG-Elemente aktiviert werden. | Freies Verschieben vorhandener Netzobjekte erfolgt weiterhin per Pointer; diese Bearbeitung ist nicht vollständig per Tastatur möglich. |
| R744 | Nur unterkritische Fälle; transkritische Verflüssigung wird abgewiesen. | Druckgas-/Gaskühlerseite ist nicht implementiert. |
| Rohrdimensionierung | Die automatische Wahl vergrößert Rohrgrößen mit einer begrenzten Heuristik. | Sie garantiert kein globales Kostenoptimum. Manuelle Größen und Grenzwertmeldungen fachlich prüfen. |
| Hydraulisches Modell | Stationäre, einphasige Rechnung mit vereinfachten/konfigurierten Randbedingungen. | Keine Teillast-Ölrückführung, zeitabhängige Last, Ventilauslegung oder Herstellerfreigabe. Details: `PLAN.md`. |

## Fehler melden

Für einen reproduzierbaren Fehler bitte ein GitHub-Issue mit folgenden Angaben erstellen:

1. Version aus der Oberfläche sowie Browser und Betriebssystem.
2. Schritte, die zum Fehler führen, sowie erwartetes und tatsächliches Ergebnis.
3. Fehlermeldung aus der Browserkonsole, falls vorhanden.
4. Möglichst ein kleines, synthetisches Rohrnetz. Keine Kundenpläne, Gebäudegrundrisse oder echten Projektdateien öffentlich anhängen.

Für Fehler in der Berechnung zusätzlich Kältemittel, Einstellungen, Netzform und betroffene Ergebniszeile angeben. Ein Issue sollte einen reproduzierbaren Fehler von einer bewussten Modellgrenze unterscheiden.
