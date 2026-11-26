# Zweiter Abarbeitungsdurchgang zum Code Review vom 26. November 2026

Dieser Bericht ergänzt [REVIEW.md](REVIEW.md) und [FOLLOWUP.md](FOLLOWUP.md) und behandelt die dort offenen Punkte 2 bis 5 der Liste „Verbleibende Arbeit“ (Punkt 1, die PDF.js-Aktualisierung, ist nicht Teil dieses Durchgangs). Geprüft wurde unter Linux mit Node.js und ausschließlich synthetischen Netzen. Ein Versionssprung wurde nicht angefordert.

## Umgesetzte Änderungen

| Punkt | Änderung | Stand |
| --- | --- | --- |
| Import und Projektwechsel (R04) | `switchProject` lädt und prüft eine eingebettete PDF vollständig, bevor der aktive Zustand angefasst wird. Danach wird der Wechsel synchron übernommen; scheitert Rendern, Migration oder Ergebnisanzeige, werden Projekt, Speicherstatus, Undo/Redo, Auswahl, PDF-Dokument, Ansicht und Einstellungen wiederhergestellt und das neue PDF-Dokument freigegeben. Import und Öffnen aus der Projektliste verwenden denselben Weg. Eingabefehler, Speicherfehler des bisherigen Projekts und späte Wechselfehler werden getrennt gemeldet. | Durch Tests für späten Renderfehler, abgewiesenes PDF und erfolgreichen Wechsel abgesichert. Asynchrone Fehler der PDF-Rasterung nach dem Wechsel (`renderPdfSharp`) lösen keine Rücksetzung aus. |
| Speichern (R10) | `persistProject` erstellt Projekt- und PDF-Momentaufnahme synchron und reiht den IndexedDB-Schreibvorgang in eine Warteschlange ein. Speicherstatus und aktives Projekt werden nur gesetzt, wenn das gespeicherte Projekt noch geöffnet ist. | Test mit künstlich verzögertem IndexedDB-Schreiben: zweiter Schreibvorgang beginnt erst nach dem ersten, kein Vermischen. Die Warteschlange ist global, nicht pro Projekt; das serialisiert auch Schreibvorgänge verschiedener Projekte. |
| Worker-Abbruch (R02) | Wird eine laufende Berechnung verworfen, beendet `abortWorkerJobs` den beschäftigten Worker; der nächste Auftrag startet einen neuen. Im `file://`-Betrieb wird die Blob-URL des Worker-Bundles dafür wiederverwendet. | Test für beschäftigten und leerlaufenden Worker. Der Neustart lädt die Stoffdaten erneut; die Rechnung auf dem Hauptthread (Fallback ohne Worker) bleibt nicht abbrechbar. |
| Kombinierte Kälteträgerwarnungen (R08) | Jeder unzulässige Verbraucherkreis wird gemeldet, Geschwindigkeitsmeldungen tragen die Leitungsart. Statuszuordnung, Tabellenzellen (Δp und v je VL/RL) und CSV verwenden dieselbe Zuordnung. | Audit `UI-02`: kombinierter Fall (zu kleiner Vorlauf, zu kleiner Rücklauf, zwei unzulässige Kreise, ein unbeteiligter Kreis) sowie reiner Geschwindigkeitsfall; Tabelle und CSV markieren identische Leitungen. Im Browser mit demselben Netz nachvollzogen. |
| Layout (R09) | Die Mindestbreite der Ergebnistabelle (490 px) war größer als die verfügbare Breite in der 490-px-Seitenleiste (439–451 px), sodass die Tabelle immer scrollte und die Geschwindigkeitsspalte abgeschnitten war. Spaltenraster neu verteilt; seltene dreistellige kPa-Werte brechen die Einheit in eine zweite Zeile um. | Im Browser bei 960, 1280 und 1600 px, dunkel und hell, für Kälteträger und Kältemittel geprüft: kein horizontales Scrollen, keine überlaufenden Zellen, Rohrgrößen ohne abgeschnittenes „mm“. Der Zusatz „(auto)“ in Auswahlfeldern wird wie bisher gekürzt. |
| Laufzeit Kälteträger | Ungünstigster Kreis je Iteration über Pfadsummen in einem Baumdurchlauf statt einzelner Pfadwanderungen. | 1499 Kühlstellen, Kammform, automatische Größen: vorher 99,4 s, jetzt 6,8 s. 80 zufällige Netze gegen den vorherigen Stand: identische Ergebnisse. |
| Referenzwerte | Audit `REF-01` (NIST Chemistry WebBook) und `REF-02` (Colebrook-White). | Siehe unten. |

## Lastprüfung mit festgelegten Zielen

Die Ziele wurden vor der Messung festgelegt: Kälteträger höchstens 10 s für 1499 Kühlstellen, Kältemittel höchstens 60 s für 50 Kühlstellen, jeweils als Kindprozess einschließlich Start auf der Prüfmaschine. Netzformen: Kamm (lange Stammleitung mit Stichleitungen), Stern (ein Verteiler), binärer Baum und Verteiler mit √n Strängen. Lasten: Kälteträger 0,01 kW (manuell 54 × 1,5 mm) bzw. 0,1 kW (automatisch), Kältemittel 1 kW (R513A, automatisch). [Protokoll](followup2-stress.json)

| Fall | Knoten | Dauer | Ziel |
| --- | ---: | ---: | --- |
| Kälteträger, Kamm, manuell, 10 / 100 / 500 / 1499 | 21 – 2999 | 1,5 – 1,8 s | eingehalten |
| Kälteträger, Stern / Baum / Verteiler, manuell, 1499 | 1501 – 3038 | 1,5 s | eingehalten |
| Kälteträger, Kamm, automatisch, 1499 | 2999 | 6,8 s | eingehalten |
| Kälteträger, Stern / Baum / Verteiler, automatisch, 1499 | 1501 – 3038 | 1,7 / 5,1 / 6,0 s | eingehalten |
| Kältemittel, Kamm, automatisch, 10 / 20 | 21 / 41 | 4,1 / 32,2 s | eingehalten |
| Kältemittel, Baum, automatisch, 20 | 36 | 30,5 s | eingehalten |
| Kältemittel, Kamm, automatisch, 50 | 101 | über 180 s, abgebrochen | **verfehlt** |

Bei Kammform, Baum und Verteiler mit automatischen Größen ergeben die sehr langen synthetischen Leitungen Kreise oberhalb der Druckgrenze von 50 kPa; die Fälle prüfen Laufzeit und endliche Werte, nicht eine plausible Anlage. Die Kältemittelrechnung löst je Upgrade-Durchgang alle Endpunkt-Lastfälle über das ganze Netz; die Laufzeit wächst etwa kubisch. Eine Abhilfe erfordert eine Umstellung der Upgrade-Heuristik (etwa mehrere Vergrößerungen je Durchgang oder inkrementelle Neuberechnung) und muss gegen die bisherigen Ergebnisse abgeglichen werden. Sie ist nicht Teil dieses Durchgangs.

## Referenzwerte

| Größe | Programm | Referenz | Abweichung |
| --- | --- | --- | --- |
| Wasser 10 °C: Dichte, cp, Viskosität | 999,702 kg/m³; 4,19516 kJ/(kg·K); 1,30590 mPa·s | NIST, 0,101325 MPa | < 0,0001 % |
| Wasser 20 °C | 998,207; 4,18405; 1,00160 | NIST | < 0,0004 % |
| R-134a Sättigungsdruck 0 / 40 °C | 292,803 / 1016,593 kPa | 292,814 / 1016,593 kPa | 0,004 % / < 0,0001 % |
| CO₂ Sättigungsdruck −10 / 0 °C | 2648,68 / 3485,14 kPa | 2648,68 / 3485,15 kPa | < 0,001 % |
| Reibungsbeiwert (Haaland) | Re 4·10³ – 10⁷, ε/d 0 – 0,01 | Colebrook-White, iterativ | max. 1,34 % (Re 10⁵, ε/d 10⁻⁴) |
| Laminar | 64/Re | Hagen-Poiseuille | exakt |

Quelle der Stoffwerte: NIST Chemistry WebBook, SRD 69, Thermophysical Properties of Fluid Systems, abgerufen am 26. November 2026. Für R-134a und CO₂ lieferte die Abfrage benachbarte Tabellenzeilen (Abstand 0,1–0,6 K); die Referenz bei der Zieltemperatur ist linear interpoliert. CoolProp und NIST beruhen auf denselben Referenz-Zustandsgleichungen; der Abgleich bestätigt Implementierung, Stoffzuordnung und Einheiten, nicht die Zustandsgleichungen gegen Messwerte. Glykolgemische, Herstellerprodukte, Gemische mit Temperaturgleit und die Netzrechnung gegen eine gemessene Anlage sind nicht referenziert.

## Prüfprotokoll

| Prüfung | Ergebnis |
| --- | --- |
| Review-Audit | 21 bestanden, 0 fehlgeschlagen; [Protokoll](followup2-audit.json) |
| Testsuite | 92 bestanden, 0 fehlgeschlagen; [Protokoll](followup2-tests.tap) |
| Lastprüfung | 14 bestanden, 1 verfehlt (Kältemittel 50 Kühlstellen); [Protokoll](followup2-stress.json) |
| Browser | Import, Berechnung, Öffnen aus der Projektliste mit gespeichertem Ergebnis, Markierungen, Layout bei drei Breiten und zwei Designs |

Die JSON-Protokolle nennen den zum Testzeitpunkt ausgecheckten `HEAD`; die beschriebenen Änderungen lagen während der Messung im Arbeitsbaum.

## Verbleibende Arbeit

1. PDF.js mit Worker und Desktop-CSP aktualisieren (unverändert offen).
2. Laufzeit der Kältemittel-Dimensionierung für Netze ab etwa 30 Kühlstellen verbessern.
3. Referenzvalidierung für Glykolgemische, Herstellerprodukte und Gemische mit Temperaturgleit; Abgleich der Netzrechnung mit dokumentierten Anlagendaten.
