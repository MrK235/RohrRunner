# Bekannte Fehler und Einschränkungen

Diese Datei hält reproduzierbare Defekte und für Nutzende sichtbare Einschränkungen fest. Sie ist kein Nachweis einer fehlerfreien oder vollständig geprüften Software. Beim Erstellen dieser Dokumentation wurde kein vollständiger manueller Browser- oder Anlagen-QA-Lauf durchgeführt.

## Offene, reproduzierbare Defekte

Der Repository-Stand enthält derzeit keine bestätigten Fehlerberichte, die hier als offen dokumentiert sind. Neue bestätigte Fälle werden mit Status, betroffener Version und Umgehung unten ergänzt.

## Bekannte Einschränkungen

| Bereich | Verhalten | Auswirkung / Umgehung |
| --- | --- | --- |
| PDF-Abhängigkeiten | PDF.js und pdf-lib werden von Cloudflare bzw. jsDelivr geladen. | Für PDF-Import und PDF-Ausgabe ist eine Internetverbindung nötig. Die Netzberechnung und lokalen Stoffdaten liegen im Repository. |
| Direktstart mit `file://` | Browser können dort keinen Web Worker laden; die App verwendet den Hauptthread. | Bei umfangreichen Netzen kann die Oberfläche während der Berechnung weniger flüssig sein. `npm run serve` aktiviert den Worker-Betrieb über localhost. |
| Mehrseitige Pläne | Es wird Seite 1 der gewählten PDF angezeigt und verwendet. | Weitere PDF-Seiten müssen separat bereitgestellt werden; Seitenwechsel ist nicht implementiert. |
| Browser-Speicher | IndexedDB speichert Projekte einschließlich PDF lokal im verwendeten Browserprofil. | Browserdaten können durch Nutzende oder Browserverwaltung gelöscht werden; für Austausch und externe Sicherung `.rohrrunner` exportieren. |
| R744 | Nur unterkritische Fälle; transkritische Verflüssigung wird abgewiesen. | Druckgas-/Gaskühlerseite ist nicht implementiert. |
| Rohrdimensionierung | Die automatische Wahl vergrößert Rohrgrößen mit einer begrenzten Heuristik. | Sie garantiert kein globales Kostenoptimum. Manuelle Größen und Grenzwertmeldungen fachlich prüfen. |
| Hydraulisches Modell | Stationäre, einphasige Rechnung mit vereinfachten/konfigurierten Randbedingungen. | Keine Teillast-Ölrückführung, zeitabhängige Last, Ventilauslegung oder Herstellerfreigabe. Details: `rohrnetz-berechnung-anleitung.md`. |

## Fehler melden

Für einen reproduzierbaren Fehler bitte ein GitHub-Issue mit folgenden Angaben erstellen:

1. Version aus der Oberfläche (`0.1.1`) und Browser/Betriebssystem.
2. Schritte, die zum Fehler führen, sowie erwartetes und tatsächliches Ergebnis.
3. Fehlermeldung aus der Browserkonsole, falls vorhanden.
4. Möglichst ein kleines, synthetisches Rohrnetz. Keine Kundenpläne, Gebäudegrundrisse oder echten Projektdateien öffentlich anhängen.

Für Fehler in der Berechnung zusätzlich Kältemittel, Einstellungen, Netzform und betroffene Ergebniszeile angeben. Ein Issue sollte einen reproduzierbaren Fehler von einer bewussten Modellgrenze unterscheiden.
