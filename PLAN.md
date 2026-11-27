# Berechnungsmodell von RohrRunner

## Prüf- und Validierungsstand nach dem Review vom 26. November 2026

Vor der hydraulischen Rechnung werden nun endliche Knoten- und Pfadkoordinaten, ein positiver endlicher Maßstab sowie die Übereinstimmung der ersten und letzten Pfadpunkte mit den Anschlussknoten geprüft. Ungültige geometrische Eingaben werden abgewiesen, bevor sie `NaN` in Druckverlust- oder Geschwindigkeitswerte tragen können. Zusatzlängen, Widerstände und Steigleitungslängen müssen endliche nichtnegative Werte sein; Höhendifferenzen dürfen ein Vorzeichen haben, müssen aber endlich sein. Diese Prüfung erweitert die Eingabekontrolle, nicht den fachlichen Geltungsbereich.

Bei Kältemittelgemischen wird die Temperaturdifferenz einer Flüssigkeitsstrecke jetzt wie der Flüssigkeits-Endpunktwert aus der Blasenpunktkurve berechnet. Für Sauggas bleibt die Taupunktkurve maßgeblich. Dadurch können ausgewiesene FL-Streckenwerte gegenüber älteren Ergebnisdateien abweichen; Druckverluste und Rohrwahl werden dadurch nicht neu definiert. Der [Review](docs/reviews/2026-11-26/REVIEW.md) dokumentiert den reproduzierten Unterschied an einem synthetischen R448A-Einzelabschnitt. Bereits gespeicherte Ergebnisse müssen nach einer Projektänderung neu berechnet werden; eine rückwirkende Umrechnung alter Exporte erfolgt nicht.

Für Kälteträgerbäume werden Kindknoten und Rohrzeilen für wiederholte Abfragen indiziert. Das ändert weder Gleichungen noch die begrenzte Upgrade-Heuristik. Der synthetische 1499-Kühlstellen-Fall wurde nach dieser Änderung unter dem gewählten 30-Sekunden-Testbudget abgeschlossen. Die gemessene Laufzeit ist keine allgemeine Zusage für andere Netze oder Hardware.

Ergänzung vom 26. November 2026 (zweiter Durchgang, [FOLLOWUP-2](docs/reviews/2026-11-26/FOLLOWUP-2.md)):

- Kälteträger-Upgrade-Heuristik: Der ungünstigste Kreis je Iteration wird über eine Pfadsumme entlang der Baumreihenfolge bestimmt, statt jeden Kreis einzeln bis zum Start abzulaufen. Gleichungen, Kandidatenwahl und Gleichstandsregel (erste Kühlstelle in Netzreihenfolge) sind unverändert. 80 zufällige synthetische Bäume mit knappen Druckgrenzen ergaben identische Rohrgrößen, Strecken- und Kreisdruckverluste wie der vorherige Stand.
- Kälteträger-Meldungen: Jeder Verbraucherkreis über der Druckverlustgrenze erzeugt eine eigene Meldung mit seinen Strecken; der ungünstigste wird als solcher bezeichnet. Bisher wurde nur der ungünstigste Kreis gemeldet, weitere unzulässige Kreise blieben ohne Zuordnung. Geschwindigkeitsmeldungen tragen die Leitungsart (Vorlauf/Rücklauf), damit Tabelle und CSV nur die tatsächlich betroffene Leitung markieren. Bei sehr vielen unzulässigen Kreisen entsprechend viele Meldungen; die Dimensionierung selbst ändert sich dadurch nicht.
- Referenzabgleich: Wasserstoffwerte (10/20 °C) und Sättigungsdrücke von R-134a (0/40 °C) und CO₂ (−10/0 °C) stimmen mit dem NIST Chemistry WebBook (SRD 69, abgerufen 26.11.2026) auf besser als 0,004 % überein; die Haaland-Näherung weicht im geprüften Raster (Re 4·10³ bis 10⁷, relative Rauheit 0 bis 0,01) höchstens 1,4 % von Colebrook-White ab. CoolProp und NIST beruhen auf denselben Referenz-Zustandsgleichungen; der Abgleich bestätigt die Implementierungs- und Einheitenkette, nicht die Zustandsgleichungen gegen Messwerte, und er ersetzt keine Validierung an einer realen Anlage. Glykolgemische und Herstellerprodukte sind nicht referenziert.
- Laufzeit Kältemittel: Die Upgrade-Schleife löste je Durchgang alle Endpunkt-Lastfälle über das ganze Netz; die Rechenzeit wuchs daher etwa kubisch mit der Zahl der Kühlstellen, und das Ziel für 50 Kühlstellen wurde verfehlt. Abhilfe im dritten Durchgang siehe unten.

Ergänzung vom 26. November 2026 (dritter Durchgang, Laufzeit der Kältemittel-Dimensionierung):

- Gemeinsamer Lastfall: Bei Gleichzeitigkeit 1 erhalten alle Endpunkt-Lastfälle dieselben Lasten; der Netzzustand wird dann einmal gelöst und je Endpunkt ausgewertet. Das ist rechnerisch identisch mit der getrennten Lösung.
- Verzögerte Neuberechnung bei Gleichzeitigkeit unter 1: Nach einem Upgrade werden die Meldungswerte (Überschreitungen) der übrigen Lastfälle aus dem vorigen Stand als obere Schranken behandelt. Ein Lastfall wird nur neu gelöst, wenn er nach diesen Schranken den nächsten Upgrade-Schritt bestimmen würde; die Auswahl- und Gleichstandsregel (stabile Sortierung nach Überschreitung) ist unverändert. Vor dem Abbruch ohne Meldung und für das Ergebnis werden alle Lastfälle mit den endgültigen Größen neu gelöst.
- Annahme und Grenze: Die Schranke setzt voraus, dass eine größere Leitung die Überschreitungen der anderen Lastfälle nicht erhöht. Über die Rückkopplung der Endpunkt-Enthalpie auf die Massenströme kann das in Einzelfällen geringfügig verletzt sein; dann kann die Upgrade-Reihenfolge und damit die Rohrwahl vom vorherigen Verfahren abweichen. Gültigkeit und Meldungen des Endergebnisses beruhen immer auf vollständig neu gelösten Lastfällen. Ein Regressionstest hält Rohrwahl und Saugdruckverluste eines synthetischen Kamms mit Gleichzeitigkeit 1 und 0,7 fest.
- Wirkung: 20 Kühlstellen (Kamm, R513A, automatisch) 33,6 s → 3,4 s bei Gleichzeitigkeit 1 und 30,6 s → 5,8 s bei 0,8; 50 Kühlstellen über 180 s → etwa 17 s. Die Zahl der Upgrade-Durchgänge wächst weiter etwa linear mit der Netzgröße, je Durchgang wird das ganze Netz gelöst; sehr große Kältemittelnetze bleiben deshalb deutlich langsamer als Kälteträgernetze.

Dieses Dokument beschreibt den implementierten Rechenkern in `src/engine.js`, den Stoffdatenzugriff in `src/stoffdaten.js` und den Interpolationspfad in `src/fast-data.js`. Es ist eine technische Dokumentation des Programmstands, keine Anlagenfreigabe oder normative Auslegungsanweisung.

## 1. Geltungsbereich

Berechnet werden stationäre, einphasige Saug- und Flüssigkeitsleitungen für:

| Kältemittel | Rohrreihe |
| --- | --- |
| R513A | metrische Wieland-cupromed/cuprofrio-Serie |
| R448A | metrische Wieland-cupromed/cuprofrio-Serie |
| R744 (CO₂) | zöllige Wieland-K65-120-bar-Serie; nur unterkritischer Betrieb |
| R134a, R404A, R407C, R449A, R452A | metrische Wieland-cupromed/cuprofrio-Serie |

Nicht Teil des Modells sind Druckgasleitungen, transkritisches CO₂, Ventil- oder Verdichterauslegung, gekoppelte Kältekreise, zeitabhängige Lastgänge und Teillast-Ölrückführung.

## 2. Eingabemodell und Netzprüfung

Ein Projekt enthält Knoten und Leitungsabschnitte mit gespeicherter Zeichenrichtung (`from`/`to`). Diese Richtung beschreibt nur die Erfassung und ist keine Fließrichtung. Der Netzeditor speichert die Geometrie als Punkte in der PDF-Zeichenebene. Die Berechnung akzeptiert ausschließlich einen zusammenhängenden, kreisfreien Baum mit:

- genau einem Anlagenstart vom Typ `start`;
- mindestens einer Kühlstelle vom Typ `endpoint` mit positiver Kälteleistung;
- eindeutigen IDs und gültigen Leitungsendpunkten;
- rechtwinkligen Leitungsabschnitten;
- genau einem Anschluss je Kühlstelle, mindestens zwei je Abzweig und mindestens einem am Anlagenstart;
- positivem Maßstab in Metern je PDF-Pixel.

Kreise, doppelte Verbindungen, getrennte Netzteile, ungültige Höhen-/Lastwerte und nicht rechtwinklige Wege werden vor der hydraulischen Berechnung abgewiesen. Es gibt keine geschlossene Ringnetzberechnung.

Die hydraulische Länge eines Abschnitts ist die Summe der orthogonalen Planstrecken multipliziert mit dem Maßstab, zuzüglich `max(0, extraLengthM)` des Abschnitts. Zusatzlängen und Steigleitungen werden ausschließlich an Rohrstrecken konfiguriert. Bestehende Kühlstellenangaben werden beim Öffnen einmalig auf die angeschlossene Rohrstrecke übertragen und dort zu vorhandenen Eingaben addiert. Aktivierte Steigleitungen werden in der 2D-Ansicht nicht gezeichnet: Ihre eingegebenen Längen kommen zusätzlich zur Saugleitung der jeweiligen Rohrstrecke hinzu, nicht zur Flüssigkeitsleitung. Die in der Kühlstellenliste angezeigte Gesamtlänge summiert die gezeichneten und zusätzlichen Längen einschließlich der Steigleitungen auf dem Pfad vom Anlagenstart zur Kühlstelle. Ohne Maßstab oder vollständigen Pfad wird keine Gesamtlänge angezeigt. Wird eine Rohrstrecke durch ein neues T-Stück geteilt, verteilt der Editor ihre nicht gezeichnete Steigleitungslänge wie die übrige Zusatzlänge proportional zur gezeichneten Länge auf beide Teilstrecken. Da der tatsächliche Ort der Steigleitung nicht bekannt ist, müssen die Teilstrecken anschließend fachlich geprüft und bei Bedarf angepasst werden.

## 3. Stoffzustände und Kältemittel

CoolProp 8.0.0 wird lokal als WebAssembly geladen. Die Anwendung fordert Sättigungszustände sowie thermodynamische und hydraulische Stoffwerte an. `src/fast-data.js` kann bei R448A, R513A, R134a, R404A, R407C, R449A und R452A für −35 bis 10 °C Verdampfung, 25 bis 55 °C Verflüssigung, 3 bis 40 K Überhitzung, 1 bis 10 K Unterkühlung und Saugverlustgrenzen bis 5 K vorberechnete Interpolationen bereitstellen. Für R448A darf die Flüssigkeitstemperatur dabei höchstens 50 °C betragen (begrenzter Viskositätsmodellbereich). Außerhalb der zulässigen Eingaben oder der tabellierten Druckbereiche verwendet der Solver CoolProp direkt; auch wenn der Aufbau der Stützpunkte fehlschlägt, fällt er auf CoolProp zurück. Die Stützpunkte werden für den jeweiligen Betriebspunkt mit CoolProp erzeugt; die Interpolation ersetzt keine zusätzliche technische Validierung.

Die zusätzlichen Kältemittel R134a, R404A, R407C, R449A und R452A werden über das bereits lokal gebündelte CoolProp-8.0.0-HEOS-Modell berechnet (R134a als reiner Stoff, die Gemische mit den lokal verfügbaren `.mix`-Definitionen). Es wird kein Netz- oder Downloadzugang benötigt. Druck-/Sättigungs-, Dichte-, Enthalpie- und Viskositätswerte stammen für diese Stoffe ausschließlich aus CoolProp; insbesondere die Viskosität ist für diese Produkte nicht gegen unabhängige Hersteller-/Messwerte abgeglichen. Der Fast-Data-Interpolationspfad wird auch für diese fünf Kältemittel innerhalb der oben genannten Grenzen angeboten; die Stützpunkte stammen weiterhin aus CoolProp. Außerhalb der Grenzen und bei gescheitertem Tabellenaufbau erfolgen direkte CoolProp-Abfragen. Die zusätzlichen Gemische besitzen dadurch keine unabhängige produktspezifische Viskositätsvalidierung. Für Gemische werden Blasen- und Taupunkt getrennt ausgewertet und Zweiphasenzustände im hydraulischen Einphasenpfad abgewiesen. Werkstoff-, Öl- und Druckfreigaben sind nicht Teil der Berechnung.

Für die Saugleitung gilt die Taupunkttemperatur plus eingestellte Überhitzung. Für die Flüssigkeitsleitung wird eine konstante Flüssigkeitstemperatur `T_liquid = T_condensation − subcooling` angesetzt. Bei zeotropen Gemischen werden Blasen- und Taupunkt getrennt behandelt.

R744 wird ab einer Verflüssigungstemperatur am kritischen Punkt `304.1282 K` (etwa `30.98 °C`) abgewiesen. Druckgas-/Gaskühlerzustände werden nicht ausgewertet. Die UI-Startwerte (R513A/R448A: 25 K Überhitzung, 2 K Unterkühlung, 1 K Flüssigkeitsverlustgrenze, 28 bar Überdruck; R744 zusätzlich 5 °C Verflüssigung und 100 bar Überdruck) sind Eingabevorgaben, keine technische Freigabe oder allgemeingültige Auslegungswerte. Gespeicherte Projekte behalten ihre eigenen Einstellungen.

## 4. Lastfälle und Massenströme

Zuerst wird eine Grund-Enthalpiedifferenz bestimmt:

```text
Δh₀ = h(Saugzustand am Anlagenstart) − h(Flüssigkeitszustand am Anlagenstart)
```

Der erste Massenstromansatz je Kühlstelle lautet `Q / Δh₀`. Für die Pfade und Rohrgrößen betrachtet der Solver getrennte Endpunkt-Lastfälle: Eine Ziel-Kühlstelle wird mit 100 % ihrer Leistung angesetzt; alle anderen Kühlstellen laufen mit der eingestellten Gleichzeitigkeit `s`.

Für einen Zweig ergibt sich daraus sinngemäß:

```text
Q_zweig = Q_ziel + s · Summe(Q_andere Kühlstellen im Zweig)
ṁ_zweig ≈ Q_zweig / Δh
```

Die Massenströme gemeinsamer Stammabschnitte werden aus den untergeordneten Zweigen aufsummiert. Nach der Druckrechnung aktualisiert der Solver den Endpunkt-Massenstrom anhand der Enthalpiedifferenz am berechneten Endzustand und wiederholt die Zustandsrechnung. Deshalb kann eine Änderung am Saugrohr über den Massenstrom auch den FL-Wert derselben Kühlstelle geringfügig ändern. Bei gleichzeitiger Last ändern sich über gemeinsame Stammleitungen gegebenenfalls auch Werte anderer Kühlstellen; ein unbelasteter unabhängiger Seitenast (Gleichzeitigkeit 0) bleibt unverändert. Automatische Rohrgrößen werden bei jedem Lauf für das ganze Netz neu bestimmt. Die Fixpunktschleife hat höchstens 12 Iterationen; bei fehlenden Endpunkt-Stoffwerten oder ausbleibender Konvergenz wird ein Fehler ausgegeben.

## 5. Rohrkatalog und manuelle Größen

R513A und R448A verwenden die Serie `cuprofrio-metric`; R744 verwendet `k65-inch-120bar`. Der Innendurchmesser wird aus Außendurchmesser und Wandstärke berechnet:

```text
D_i = D_a − 2 · Wandstärke
```

In der Oberfläche ist der Auslegungsdruck als Überdruck in bar angegeben. Der Solver filtert Kataloggrößen mit der Bedingung:

```text
catalogBar ≥ designPressureBar + 1.01325 bar
```

Eine manuell festgelegte Größe muss in der gewählten Rohrserie enthalten und für den Auslegungsdruck zulässig sein. Im metrischen Katalog (`data/pipe-catalog.json`, Wieland 2026, gedruckte Seite 14, gerade cupromed/cuprofrio-Rohre) ist 88,9 × 2 mm mit 26 bar Katalog-Betriebsdruck bei 100 °C und Sicherheitsfaktor 3 hinterlegt; Außendurchmesser und Wandstärke sind in mm angegeben. Damit ist diese Größe bei den voreingestellten 28 bar Überdruck nicht auswählbar (Grenze: höchstens 24,98675 bar Überdruck gemäß obiger Filterformel). 35 × 1 mm und 54 × 2 mm sind auf Wunsch nicht mehr im angebotenen Katalog; bestehende manuelle Zuordnungen zu diesen Größen werden beim nächsten Rechenlauf abgewiesen. Durch die entfallenden Größen kann ein Netz bei höherem Auslegungsdruck (z. B. ein synthetisches 10-Kühlstellen-Netz bei 35 bar) die vorgegebenen Druckverlustgrenzen trotz automatischer Auswahl überschreiten; der Solver meldet diese Grenzverletzungen. Die katalogisierten Druckwerte und ihre Temperatur-/Sicherheitsbedingungen sind keine Freigabe für die konkrete Anlage.

## 6. Druckverluste

Der Rechenkern verwendet Darcy-Weisbach und einen Swamee-Jain-Näherungswert für turbulente Strömung. Für den laminaren Bereich gilt:

```text
f = 64 / Re                         bei Re < 2300
```

Im turbulenten Bereich:

```text
a = −1.8 · log₁₀((ε / (3.7 · D))^1.11 + 6.9 / Re)
f = 1 / a²
```

Je Teilabschnitt wird der Druckverlust berechnet als:

```text
Δp = (f · (L / N) / D · F + ζ / N) · (ρ · v² / 2) + ρ · g · (Δz / N)
```

Dabei sind `L` die gesamte hydraulische Länge, `N` die Integrationsschritte, `D` der Innendurchmesser, `F` der Reibungszuschlag, `ζ` die Summe lokaler Einzelwiderstände, `ρ` die Dichte, `v` die mittlere Geschwindigkeit, `g = 9.80665 m/s²` und `Δz` die Höhendifferenz. Der eingestellte Viskositätszuschlag wird auf die Stoffwertviskosität angewendet. Höhendifferenzen werden je Leitungsart geführt; positives `Δz` bedeutet Anstieg in Fließrichtung.

Die Saugseite wird in acht, die Flüssigkeitsseite in vier Teilabschnitte integriert. Stoffwerte werden während dieser Integration am jeweils aktuellen Druck ausgewertet. Flüssigkeitsdruck wird vor dem Unterschreiten der berechneten Phasengrenze mit einem kleinen relativen Abstand (10⁻⁵) oberhalb des Sättigungsdrucks begrenzt: PT-Stoffwerte sind exakt auf der Phasengrenze nicht eindeutig. Trifft ein Abschnitt diese Grenze, wird die verbleibende Unterkühlung des betroffenen Endpunktpfads konservativ mit 0 K ausgewiesen und ein Phasenrisiko gemeldet. Die Einphasenrechnung liefert für den dahinterliegenden Bereich keine Zweiphasen-Stoffwerte; größere Rohrgrößen können den Druckverlust gegebenenfalls verringern.

## 7. Druckrichtung und Endpunktzustände

Am Anlagenstart werden Saugdruck aus Verdampfung und Taupunkt sowie Flüssigkeitsdruck aus Verflüssigung und Blasenpunkt gesetzt.

- Der Solver verwurzelt den Baum unabhängig von Zeichenrichtung und Reihenfolge am Anlagenstart. FL fließt vom Start zu den Kühlstellen, SL von den Kühlstellen zum Start; die Höhendifferenz je Leitungstyp ist in dessen jeweiliger Fließrichtung einzugeben.
- Flüssigkeitsdruck wird entlang des Netzes vom Anlagenstart zu den Kühlstellen vorwärts berechnet.
- Saugdruck wird ausgehend vom bekannten Anlagenstartdruck entlang des Baums rückwärts zu den Endpunkten gelöst. Der Druck am Leitungsanfang wird iterativ so angepasst, dass Anfangsdruck minus Reibungs- und Höhenverluste den nachgelagerten Knotenwert ergibt. Bei ausreichend großem Gefälle kann der Nettoverlust negativ und der Druck am Anfang niedriger als am Anlagenstart sein; nur physikalisch zulässige positive Drücke werden weitergerechnet.
- Für jede Kühlstelle wird ein eigener Volllast-Lastfall ausgewertet.
- Endpunkt-Druckverlust SL und FL sowie verbleibende Unterkühlung werden aus den berechneten Sättigungszuständen abgeleitet. Die Druckverlustgrenzen in K bezeichnen Sättigungstemperaturdifferenzen, keine Druckdifferenzen in bar.

## 8. Automatische Dimensionierung

Die automatische Wahl beginnt mit der kleinsten druckzulässigen Größe. Für Saugleitungen wird zunächst eine Größe gesucht, die die maximale Geschwindigkeit im anfänglichen Flussansatz einhält. Danach werden Endpunkt-Lastfälle mit den aktuellen Größen gerechnet. Bei Grenzverletzungen wird die betroffene automatische Größe abhängig von der Überschreitung angehoben; nahe der Grenze werden kleinere Schritte gewählt. Nach jedem Upgrade wird das Netz für den Lastfall neu gerechnet, der den nächsten Schritt bestimmt; die übrigen Lastfälle werden mit ihren vorigen Überschreitungen als obere Schranke geführt und erst neu gerechnet, wenn sie entscheidend werden, spätestens für das Endergebnis. Bei Gleichzeitigkeit 1 teilen alle Endpunkt-Lastfälle einen Netzzustand. Die obere Iterationsgrenze deckt alle möglichen Katalogstufen aller automatischen Leitungen ab, statt eine feste kleine Zahl von Upgrades vorzugeben.

Wird eine Rohrgröße direkt im aktuellen Ergebnis geändert, ist der folgende Lauf eine Nachrechnung: Alle übrigen Rohrgrößen werden für diesen Lauf auf die zuletzt berechneten Größen festgehalten, auch wenn sie in der Oberfläche weiterhin als „Automatisch“ geführt werden. Nur die geänderte Größe darf neu gewählt werden, falls sie ausdrücklich auf „Automatisch“ gestellt wird. Massenströme, Druckverluste, Endpunktwerte und Grenzwertmeldungen werden trotzdem neu gerechnet; neue Grenzwertverletzungen können deshalb sichtbar werden. Ein ausdrücklich gestarteter vollständiger Berechnungslauf dimensioniert automatische Größen wieder neu. Bei veralteten Ergebnissen erfolgt stattdessen ein vollständiger Lauf.

Wenn Grenzverletzungen auftreten, wertet eine Upgrade-Heuristik die betroffenen Pfade aus. Sie vergrößert eine automatische Rohrgröße anhand des Druckverlustanteils und des erwarteten Querschnittsgewinns. Der Schritt hängt von der Überschreitung ab und wird nahe dem Grenzwert kleiner. Manuelle Größen werden nicht geändert. Der Durchlauf ist durch alle möglichen Katalogübergänge des Netzes begrenzt; anschließend wird das Netz erneut ausgewertet und mögliche Grenzverletzungen werden angezeigt.

Geprüft werden:

- maximaler Druckverlust SL und FL in Kelvin (Sättigungstemperaturdifferenz);
- maximale Sauggasgeschwindigkeit;
- Mindestgeschwindigkeit ausschließlich an ausdrücklich aktivierten Steigleitungen mit positiver Länge an Rohrstrecken. Zusätzliche Rohrlängen der Strecken bleiben normale Rohrleitung. Eine markierte gemeinsame Strecke wird für die Kühlstellenlastfälle geprüft, deren Zielpfad sie enthält; auch der angezeigte Mindestwert umfasst nur diese Lastfälle. Die Kontrollfelder legen keine Höhendifferenz fest und erzeugen keinen zusätzlichen geodätischen Druckanteil. Eine tatsächliche Höhendifferenz ist weiterhin am Leitungsabschnitt einzutragen. Der Standardwert beträgt für alle Kältemittel 7 m/s; darunter lautet der Status „prüfen“, unter 5 m/s „kritisch“;
- Die Steigleitungslänge wird an der Rohrstrecke eingegeben; aus älteren Kühlstellen übernommene Längen werden zu vorhandenen Streckenangaben addiert und mit einem gemeinsamen Steigleitungsdurchmesser gerechnet. Im Ergebnis kann für die zusätzliche Länge einer Rohrstrecke eine eigene, höchstens so große Katalogrohrgröße geprüft und übernommen werden. Ohne positive Längenangabe gibt es keine Steigleitung. Der Solver berechnet Saugleitung und zusätzliche Steigleitung nacheinander mit ihren jeweiligen Innendurchmessern; Druckverlust, Stoffzustand und Maximalgeschwindigkeit berücksichtigen beide Abschnitte, die Mindestgeschwindigkeit den Steigleitungsanteil. Die Flüssigkeitsleitung erhält keinen zusätzlichen Längenanteil. Die Materialmengen für Rohr und Dämmung werden nach normaler Saugleitung und Steigleitung getrennt ausgewiesen, auch bei identischer Rohrgröße. In der Ergebnisliste erscheint nur die Gesamtlänge, im Steigleitungsdialog und im Berechnungs-CSV sind die Teilstreckenlängen ersichtlich; die gesamten Druckverluste und Stoffzustände beziehen sich weiterhin auf beide Teile. Die Übergangsstücke werden nicht automatisch bestimmt. Der Dialog zeigt zunächst das letzte Ergebnis und die erforderliche sowie die berechnete Mindestgeschwindigkeit. Änderungen an Steigleitungslänge oder Rohrgröße bleiben beim Prüfen unverbindlich: Der Dialog zeigt während der Berechnung einen Laufstatus und danach das geprüfte Ergebnis; erst ein gesonderter Klick auf „Übernehmen“ schreibt beide Werte und das Ergebnis ins Projekt. Neue Eingaben verwerfen die vorherige Prüfung. Der Abschlussstatus ist nur bei einem insgesamt gültigen Berechnungsergebnis grün, sonst orange; der „SL prüfen“-Button zeigt eine übernommene Steigleitung nur dann grün, wenn im aktuellen Ergebnis ihre Mindestgeschwindigkeit eingehalten wird. Die stationäre Prüfung ist keine Zusicherung der Ölrückführung im Betrieb;
- verbleibende Flüssigkeitsunterkühlung bzw. Erreichen der Phasengrenze.

Geschwindigkeitsüberschreitungen werden je betroffener Saugleitung einmal über alle Lastfälle gemeldet; als Kühlstellen werden nur die Ziel-Kühlstellen der Lastfälle zugeordnet, deren eigener Pfad die betroffene Strecke enthält und dort den Grenzwert überschreitet. Steigleitungswarnungen werden ebenso nur den Ziel-Kühlstellen zugeordnet, deren Pfad die betroffene Strecke enthält. Bei einem Endpunkt-Druckverlust über dem Grenzwert wird die Kühlstelle markiert. Einzelabschnitte werden nur dann als Grenzverletzung hervorgehoben, wenn ihr eigener Temperaturverlust den Grenzwert überschreitet; ein aufsummierter Pfadverlust allein markiert keine unkritischen Einzelabschnitte. Bei Phasenrisiko wird die Strecke markiert, an der der Flüssigkeitsdruck begrenzt wurde. Gemeinsame belastete Stammstrecken können mehrere Kühlstellen tatsächlich betreffen.

Die automatische Wahl startet mit den kleinsten druckzulässigen Größen und vergrößert nur Rohrleitungen auf den erkannten Verletzungspfaden. Das zielt auf kleine Leitungen, ist aber kein Beweis für das global kleinste Gesamtnetz: alternative Größenkombinationen werden nicht vollständig durchsucht. Manuelle Größen bleiben unverändert. Die Standard-Maximalgeschwindigkeit beträgt 30 m/s; die Mindestgeschwindigkeit für markierte Steigleitungen beträgt für alle Kältemittel standardmäßig 7 m/s.

Die Dimensionierungstests enthalten synthetische Baumstrukturen mit 2, 5 und 10 Kühlstellen. Sie prüfen die Einhaltung der Kriterien und protokollieren Laufzeiten; sie ersetzen keine Validierung an Hersteller- oder Felddaten. `GRENZEN EINGEHALTEN` bedeutet, dass die implementierten Prüfungen für die eingegebenen Daten keinen Grenzverstoß gefunden haben; es ist keine Anlagenfreigabe.

### Laufzeitvergleich der Kältemittel (synthetische Netze)

Separat ausführbar mit `node scripts/benchmark-refrigerants.mjs` (kein Teil von `npm test` oder `npm run test:all`). `--spots 1|3|5`, `--fluid R448A` und `--method both|direct|fast` schränken lange Messungen ein; `--json` liefert maschinenlesbare Einzelwerte. Der Benchmark verwendet einen synthetischen, verzweigten Baum mit 2 bis 4 kW je Kühlstelle, Gleichzeitigkeit 0,5, −10/45 °C (R744: −10/5 °C), 25 K Überhitzung und 2 K Unterkühlung. Gemessen werden Tabellenaufbau, Direktlauf mit CoolProp und Interpolationslauf ohne Warmlauf; die CoolProp-Caches bleiben zwischen den Fällen eines Prozesses warm. Der Vergleich prüft Rohrgrößen/Status und Maximalabweichungen der ausgewiesenen Rohr- und Endpunktwerte. Das ist eine Laufzeit- und Konsistenzprobe für **diese** Betriebspunkte, keine fachliche Validierung des Interpolationsverfahrens über den gesamten Eingabebereich.

Messung auf der lokalen Entwicklungsumgebung nach der Gleit-Korrektur des Tabellenpfads (Einzellauf, je Stoff und Netzgröße ein eigener Prozess ohne Warmlauf, gerundet, **Sekunden**; Format jeweils **direkt / interpoliert**, `–` = nicht ausgeführt bzw. bei R744 kein Interpolationspfad):

| Stoff | 1 Kühlstelle | 3 Kühlstellen | 5 Kühlstellen | größte relative Abweichung bei 3 Kühlstellen |
| --- | ---: | ---: | ---: | ---: |
| R513A | 1,134 / 0,004 | 91,365 / 0,114 | – / 0,626 | 0,09 % |
| R448A | 3,700 / 0,004 | 229,542 / 0,080 | – / 0,482 | 0,07 % |
| R744 | 0,037 / – | 0,608 / – | 7,141 / – | – |
| R134a | 0,220 / 0,006 | 16,798 / 0,093 | – / 0,510 | 0,08 % |
| R404A | 1,572 / 0,004 | 117,289 / 0,087 | – / 0,606 | 0,06 % |
| R407C | 1,564 / 0,003 | 107,409 / 0,132 | – / 0,472 | 0,08 % |
| R449A | 2,582 / 0,004 | 168,471 / 0,093 | – / 0,490 | 0,09 % |
| R452A | 1,643 / 0,003 | 140,004 / 0,092 | – / 0,617 | 0,12 % |

Die R744-Werte stammen aus der vorherigen Messung; der Stoff hat keinen Tabellenpfad und ist von der Korrektur nicht betroffen. Vor der Korrektur lagen die interpolierten Läufe bei 5 Kühlstellen für R448A bei rund 51 s, für R407C bei 37 s und für R449A bei 15 s; die größte relative Abweichung bei 3 Kühlstellen betrug damals 1,1–1,7 %. Die alten und neuen Zeiten sind nur eingeschränkt vergleichbar, weil die frühere Messung die CoolProp-Caches zwischen den Stoffen eines Prozesses warm hielt.

Bei einer Kühlstelle betrug die größte relative Abweichung 0,09 %, bei 3 Kühlstellen 0,12 %. In allen verglichenen Fällen (1 und 3 Kühlstellen) blieben Rohrgrößen, Gültigkeit und Warnungen gleich. Die absolute Abweichung war überwiegend beim Flüssigkeits-Druckverlust am größten (bei 3 Kühlstellen bis 31 Pa). Unterschiedliche Größen oder Grenzstatus an anderen Betriebspunkten sind nicht ausgeschlossen. Der Tabellenaufbau benötigte in jedem frischen Prozess etwa 1,4–1,6 s, davon ein großer Teil für die ersten, noch ungecachten CoolProp-Abfragen; er fällt je Betriebspunkt einmal an. Die verbleibende Laufzeit von rund 0,5 s bei 5 Kühlstellen entfällt überwiegend auf die Solver-Iterationen selbst. Ein direkter 5-Kühlstellen-Vergleich wurde wegen der Laufzeiten über zehn Minuten nicht ausgeführt; keine Aussage zu den 5-Kühlstellen-Abweichungen.

**Gleit-Korrektur des Tabellenpfads.** Ursache der früheren Langsamkeit von R448A, R407C und (schwächer) R449A war der Temperaturgleit der Gemische (bei −10 °C Taupunkt etwa 6,2 K, 6,5 K bzw. 5,8 K; R452A 4,2 K; R404A, R513A und R134a unter 0,6 K). Eine Sättigungsabfrage wird nur aus der Tabelle bedient, wenn der Druck sowohl im Tau- als auch im Blasendruckbereich der Stützpunktkurve liegt. Beide Kurven wurden über denselben Temperaturbereich aufgebaut; die Blasendruckkurve liegt aber um den Gleit verschoben höher. Bei großem Gleit fielen dadurch fast alle Saug- und viele Flüssigkeitsdrücke auf direkte CoolProp-Sättigungsrechnungen zurück (R448A, 3 Kühlstellen: rund 12 000 Abfragen, etwa 98 % der Laufzeit). R448A ist pro Flash zusätzlich teurer, weil es aus fünf statt drei Komponenten besteht. Die Korrektur

- bestimmt beim Tabellenaufbau den Gleit bei Verdampfung und Verflüssigung und erweitert die Gaskurve um diesen Betrag nach unten, die Flüssigkeitskurve nach oben, mit entsprechend mehr Stützpunkten;
- lässt das Gas-Stoffwertraster beim tiefsten Taudruck der Gaskurve beginnen, höchstens bei 0,75 × Verdampfungsdruck statt bisher 0,95 ×; der Solver fragt bei kleinen Probegrößen Saugdrücke bis etwa 0,83 × ab;
- interpoliert den Sättigungsdruck p(T) kubisch (Lagrange über vier Stützpunkte) statt linear, wie bereits die Umkehrung T(p). Ohne diesen Schritt lag die Verdampfungstemperatur nach der Rastererweiterung nicht mehr auf einem Stützpunkt; die lineare Interpolation verschob den Startdruck um etwa 0,1 % und führte bei R407C mit 3 Kühlstellen zu anderen Rohrgrößen als die direkte Rechnung. Mit kubischer Interpolation liegt der Startdruckfehler im untersuchten Punkt bei etwa 3·10⁻⁷ (relativ), der Sättigungstemperaturfehler im Saugbereich unter 1 mK.

Grenzen: Die erweiterten Kurven reichen am Rand des Gültigkeitsbereichs bis etwa 13 K unter die Verdampfungstemperatur bzw. bis etwa 9 K über die Verflüssigungstemperatur; deren CoolProp-Stabilität ist dort nicht für alle Kombinationen gesondert geprüft. Scheitert der Tabellenaufbau, wird weiterhin direkt mit CoolProp gerechnet. Die Upgrade-Heuristik reagiert empfindlich auf systematische Verschiebungen des Startdrucks; zufällige Sättigungsfehler bis 1 mK änderten im synthetischen Netz keine Rohrwahl. Ein Regressionstest prüft, dass die Sättigungsabfragen der Gleit-Gemische im Saug- und Flüssigkeitsbereich ohne CoolProp-Rückfall bedient werden.

Die bisherige R513A-/R448A-Optimierung bleibt erhalten: betriebspunktbezogene CoolProp-Stützpunkte, eingeschränkter Gültigkeitsbereich, Rückfall auf CoolProp und das Vermeiden einer zusätzlichen vollständigen Endpunktrechnung nach konvergierter Rohrwahl. Neu wird derselbe tabellierte Pfad für fünf weitere Stoffe genutzt. Das Überhitzungsraster endet nun bei Soll-Überhitzung plus 5 K statt plus 30 K; sonst konnten Stützpunkte der neuen Gemische oberhalb ihres gültigen Sättigungsbereichs liegen. Der Solver fragt hier nur Soll-Überhitzung (plus Interpolationsfehler) ab; außerhalb des Rasters wird CoolProp direkt aufgerufen. Die gemessene Beschleunigung ist keine Zusage für andere Netze/Hardware und keine globale Optimierung der Rohrwahl.

## 9. Relevante Vereinfachungen

- Stationäre Einphasenrechnung; nicht eingetragene Höhendifferenzen sind 0 m.
- Flüssigkeitstemperatur bleibt entlang eines Strangs konstant.
- Gleichzeitigkeit wird als Endpunkt-Lastfall behandelt; es gibt keine Zeitreihe oder dynamische Regelung.
- Die Reibungs- und Viskositätszuschläge sind Eingabeparameter, keine automatisch ermittelten Normwerte.
- Die Katalogdruckwerte gelten nur unter den im Katalog dokumentierten Bedingungen.
- Rohrkatalog, Stoffwertquellen und gerundete Herstellerwerte stehen in `data/pipe-catalog.json` und `data/fluid-references.json`.

Ergebnisse sind vor einer Ausführung unabhängig fachlich, anhand der Anlagenrandbedingungen und der aktuellen Herstellerdaten zu prüfen.

## Materialliste: T-Stücke und Reduzierungen

Für jeden modellierten Abzweig mit mindestens drei angeschlossenen Leitungen und je Leitungsart wird ein gleiches T-Stück mit dem größten anliegenden Rohr-Außendurchmesser angesetzt. Jeder kleinere Anschluss erhält zusätzlich einen Absatznippel bzw. eine Reduzierung vom T-Stück-Außenmaß auf das kleinere Rohrmaß (z. B. 35a–22i). Gleiche Größen werden in der Materialliste und im Material-CSV summiert. Die Zuordnung ist eine Mengenannahme aus der berechneten Rohrdimensionierung: Bauform, Anschlussart, Herstellerverfügbarkeit und die technische Eignung der konkreten Formstücke sind nicht geprüft. Ein Knoten mit mehr als drei Anschlüssen wird weiterhin als ein Abzweig gezählt; die tatsächliche Aufteilung in mehrere Formstücke ist separat festzulegen.

## Sekundärkreis mit Wasser und Glykol

Der Modus `secondary` bildet einen stationären, geschlossenen Kälteträgerkreis ab. Unterstützt werden reines Wasser sowie wässrige Ethylen- und Propylenglykollösungen. Die Konzentration ist Massenprozent; der CoolProp-8.0.0-Incompressible-Datensatz MEG/MPG deckt 0 bis 60 Masse-% ab. Dichte, Wärmekapazität, dynamische Viskosität und Gefrierpunkt werden temperatur- und konzentrationsabhängig aus diesem Stoffmodell bezogen. Zustände auf oder unter dem modellierten Gefrierpunkt werden abgewiesen. Die verwendeten Korrelationen basieren auf den in CoolProp dokumentierten Quellen, unter anderem Melinder; sie sind kein Datensatz für ein bestimmtes Handelsprodukt oder dessen Inhibitoren.

Der Massenstrom eines Leitungszweigs folgt aus `m_dot = Q / (cp_mittel * (T_Rücklauf - T_Vorlauf))`. Für die Volumenstrom- und Druckverlustberechnung werden Eigenschaften auf Vorlauf- und Rücklauftemperatur getrennt abgefragt; beide Solltemperaturen bleiben entlang der jeweiligen Leitung konstant. Wärmeaufnahme oder -abgabe entlang der Rohrstrecke und die Mischtemperatur des Rücklaufs an Abzweigen werden nicht berechnet. Die auf dem Plan eingezeichnete Baumstrecke steht für den gemeinsamen Verlauf von Vor- und Rücklauf. Der Druckverlust des ungünstigsten Verbraucherkreises ist die Summe der Vor- und Rücklaufverluste entlang des Pfads. Die automatische Auswahl ist eine Upgrade-Heuristik unter einer nutzerseitigen Geschwindigkeits- und Kreisdruckverlustgrenze, keine Optimierung von Pumpenkennlinie, Kosten oder hydraulischem Abgleich. Der statische Höhenanteil eines geschlossenen Kreises wird im Pumpendifferenzdruck nicht angesetzt; Druckhaltung, lokale Mindestdrücke und Auftriebseffekte sind nicht berechnet.

Als Rohrserien sind Viega Temponox (Modelle 1703 und 1703XL) und schwarzes Stahlrohr S195T nach EN 10255 mittelschwer hinterlegt. Außen- und Wandmaße stammen aus den verlinkten Hersteller-/Lieferprogrammen; der Innendurchmesser wird in mm als `Außendurchmesser - 2 * Wandstärke` berechnet. Für Temponox ist die Systemangabe PN 16 dokumentiert, daraus wird jedoch keine automatische Druck-/Temperaturfreigabe abgeleitet. Der Stahlkatalog gibt keine zulässigen Betriebsdrücke an. Die Rauheiten von 1,5 µm für Temponox und 45 µm für Stahl sind Modellannahmen zur hydraulischen Vorbemessung, keine vom Rohrlieferanten garantierten Kennwerte.

Das ausgewiesene Rohrinnenvolumen summiert `π · Innendurchmesser² / 4 · Länge` für alle Vor- und Rücklaufstrecken; es ist das geometrische Füllvolumen der modellierten Rohre und berücksichtigt keine Formstücke, Armaturen oder Geräte. Die ausgewiesene Glykolmasse im Rohrnetz wird aus diesem Volumen, dem Mittel der modellierten Vor- und Rücklaufdichte und dem Glykol-Massenanteil berechnet. Die Frostschutztemperatur stammt aus dem verwendeten CoolProp-Mischungsmodell; Inhibitoren oder ein konkretes Handelsprodukt werden nicht abgebildet. Für die Materialübersicht von Temponox werden DN-/Zoll-Nennangaben aus der Zuordnung der vorhandenen Außendurchmesser ergänzt (15–108 mm zu DN 12–125); sie sind Größenhinweise und keine Bestätigung der Verfügbarkeit oder Austauschbarkeit von T-Stücken, Dämmformteilen oder Kugelhähnen. T-Stücke werden nach Rohr-Außendurchmessern ohne DN-Angabe gruppiert. Beim Stahlrohr stammen DN und Zoll der Rohr- und Kugelhahngrößen aus den Katalogeinträgen.

Im Betriebspunkt ist die Frostschutztemperatur bei Glykolgemischen einstellbar und wird über eine monotone Intervallsuche auf die CoolProp-Konzentration von 0 bis 60 Masse-% abgebildet. Bei direkter Konzentrationseingabe wird der zugehörige Stoffmodellwert zurückgerechnet. Die inverse Eingabe wird auf den vom Stoffmodell abgedeckten Konzentrationsbereich begrenzt; bei Wasser ist die Frostschutztemperatur 0 °C und nicht editierbar.

Grenzen des Modus: einphasige Flüssigkeitsrechnung, Kühlbetrieb mit Rücklauftemperatur über Vorlauf, stationäre Lasten und unveränderte Mediumkonzentration. Die Verteilung der tatsächlichen Volumenströme in parallelen Zweigen, Pumpenauswahl, Ventilauslegung, Wärmeaufnahme/Abgabe über die Rohroberfläche, Ausdehnung, Korrosion und Material-/Dichtungsfreigaben werden nicht simuliert. Besonders bei Ethylenglykol, inhibitorhaltigen Produkten und Temponox sind Stoff- und Werkstoffverträglichkeit anhand des konkreten Produkts und der aktuellen Herstellerangaben separat zu prüfen.

### Herstellerspezifische Kälteträger

Zusätzlich zu WATER/MEG/MPG sind NEUTRAGEL® NEO, FRIOGEL® NEO, Antifrogen® N/L und Glysofor N/L als getrennte Medien hinterlegt (`data/secondary-fluids.js`). Die Produktkonzentration ist entsprechend den Produktquellen stets Volumenprozent; sie wird ausdrücklich nicht mit der Masse-%-Eingabe des generischen CoolProp-Modells gleichgesetzt. NEUTRAGEL/FRIOGEL NEO und Glysofor verwenden tabellierte Dichte, Wärmekapazität und kinematische Viskosität, linear interpoliert über Konzentration und Temperatur; Antifrogen verwendet die veröffentlichten Clariant-Rechnerkorrelationen. Dynamische Viskosität wird für den hydraulischen Solver aus kinematischer Viskosität und Dichte gebildet. Gefrierpunkte werden aus Herstellerangaben interpoliert bzw. bei Antifrogen aus der Herstellerkorrelation berechnet. Außerhalb der jeweils hinterlegten Produkt-, Konzentrations- oder Temperaturbereiche wird nicht extrapoliert. Die Tabellen sind gerundete Herstellerangaben und die Interpolation ist keine Herstellerfreigabe. Konzentrationsbasis, Datenquelle und empfohlener Mindestanteil werden in der UI angezeigt. Die geschätzte Produktkonzentratmasse im Rohrnetz verwendet die Volumenkonzentration und die im Datensatz hinterlegte Konzentratdichte; es ist kein Messwert der fertigen Lösung.

## Editor: Anschlusskonsistenz und nachträgliche Abgriffe

- Start, Kühlstellen und Rohrstrecken dürfen in beliebiger Reihenfolge entstehen. Freie Rohrenden sind zunächst Anschlussknoten; Start oder Kühlstelle können sie nachträglich ersetzen. Beim Zeichnen werden rechtwinklige Schnittpunkte sowie bereits vorhandene Knoten auf einer Strecke eingebunden. Ein gewähltes Ziel hinter einem Schnittpunkt bleibt erhalten.
- Kreuzungen werden ausdrücklich als verbunden behandelt. Unverbundene Überkreuzungen sind in diesem 2D-Modell weiterhin nicht vorgesehen. Dadurch entstehende geschlossene Kreise bleiben außerhalb des Baum-Solvers und werden bei der Berechnung abgewiesen. Überlappende/doppelte Rohrstrecken werden beim Zeichnen atomar zurückgewiesen.
- Eine Kühlstelle auf einer durchgehenden Leitung erhält einen eigenen Anschluss an einem T-Knoten mit null gezeichneter Länge. Es wird keine physische Länge erfunden. Reale Anschluss-/Zusatzlängen sind separat einzugeben. Die Kühlstelle bleibt ein Endverbraucher mit genau einem Anschluss; ihre Last wird weiterhin vollständig berücksichtigt.
- Beim Teilen werden Zusatzlänge, Steigleitungslänge, Einzelwiderstand und Höhendifferenz proportional zur gezeichneten Länge verteilt; manuelle Rohrgrößen bleiben erhalten. Diese Verteilung ist eine Modellannahme: lokal konzentrierte Widerstände oder Höhenänderungen müssen bei Bedarf anschließend konkret zugeordnet werden.
- Rohrpfade werden an die exakten Koordinaten der über ihre IDs bezeichneten Knoten gebunden. Vor der Berechnung werden bestehende rechtwinklige Pfade mit höchstens 2 Planpunkten Endpunktabweichung korrigiert und per Hinweis gemeldet (rückgängig machbar). Größere Abweichungen werden mit Anschlussnamen, Abstand und markierter Leitung angezeigt. Einheiten sind Planpunkte, keine Meter. Beim bloßen Laden erfolgt keine automatische Neuvernetzung.
- Regressionen verwenden ausschließlich synthetische Netze: beide Zeichenrichtungen und Reihenfolgen, nahe Knoten, versetzte Leitungsklicks, nachträgliche Kühlstellen, mehrere Abgriffe, Werterhaltung, Kreuzungen, Überlappungen und Solver-Berechnung mit einem Anschluss ohne gezeichnete Länge. Keine technische Freigabe oder Normerfüllung wird daraus abgeleitet.
