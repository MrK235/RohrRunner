# Bekannte Fehler und Einschränkungen

Diese Datei hält reproduzierbare Defekte und für Nutzende sichtbare Einschränkungen fest. Sie ist kein Nachweis einer fehlerfreien oder vollständig geprüften Software. Für Version 1.0.0 wurde ein manueller Browser-Test vom Projektverantwortlichen bestätigt; Browser- und Betriebssystemkombinationen wurden nicht systematisch abgedeckt. Eine unabhängige Verifikation der Berechnungsergebnisse anhand von Referenzfällen steht noch aus.

## Offene, reproduzierbare Defekte

Der [Code Review vom 26. November 2026](docs/reviews/2026-11-26/REVIEW.md) untersucht Version **1.2.5** (`2d36441`). Die folgenden Defekte sind offen; Reproduktionen, Ursachen, Abnahmekriterien und Rohprotokolle stehen im Bericht. Der Review-Commit behebt diese Produktfehler nicht.

| ID | Priorität | Befund | Vorläufige Umgehung |
| --- | --- | --- | --- |
| R01 | P1 | PDF.js 3.11.174 ohne Mitigation für CVE-2024-4367 | Nur vertrauenswürdige PDFs laden. |
| R02 | P1 | Netzänderungen während einer Berechnung können von deren altem Ergebnis überschrieben werden. | Lauf abwarten, dann ändern und neu berechnen. |
| R03 | P1 | Ungültige Koordinaten können im Kälteträger-Solver ein gültiges Ergebnis mit NaN-Werten ergeben; Pfadenden werden nicht abgeglichen. | Importierte Daten und gezeichnete Längen prüfen; auffällige Ergebnisse nicht verwenden. |
| R04 | P1 | Unzureichend validierte Importe können den Editor teilweise umstellen und beschädigen. | Vorher sichern; bei Fehlern neu laden und gespeichertes Projekt öffnen. |
| R05 | P1 | Beim Löschen eines T-Abzweigs gehen Steigleitungsdaten der zweiten zusammengeführten Strecke verloren. | Steigleitungsangaben nach dem Zusammenführen prüfen und korrigieren. |
| R06 | P2 | Unter Windows umgehen kodierte Rückwärtsschrägstriche die Dateifreigabeliste des lokalen Servers innerhalb des Repositorys. | Keine vertraulichen Dateien im vom Server bedienten Repository ablegen. |
| R07 | P2 | Flüssigkeitszeile und Endpunkt verwenden unterschiedliche Temperaturbasen. | Bei Gleitgemischen Zeilen- und Endpunktwerte nicht als identische Größe behandeln. |
| R08 | P2 | Kälteträgerwarnungen markieren betroffene Ergebniszeilen nicht vollständig. | Globale Meldungen und Einzelwerte prüfen. |
| R09 | P2 | Druckverlustwerte mit kPa überlaufen die Ergebniszellen bei 1280 px Fensterbreite. | Werte über den CSV-Export prüfen. |

Zusätzlich dokumentiert der Bericht das unter verzögertem PDF-Zugriff reproduzierte Speicherrisiko R10 und die Belastungsgrenze R11. Ein Browser-Datenverlust beziehungsweise Absturz ist für diese beiden Fälle nicht nachgewiesen.

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
