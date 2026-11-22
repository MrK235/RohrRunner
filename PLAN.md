# Berechnungsmodell von RohrRunner

Dieses Dokument beschreibt den implementierten Rechenkern in `src/engine.js`, den Stoffdatenzugriff in `src/stoffdaten.js` und den Interpolationspfad in `src/fast-data.js`. Es ist eine technische Dokumentation des Programmstands, keine Anlagenfreigabe oder normative Auslegungsanweisung.

## 1. Geltungsbereich

Berechnet werden stationäre, einphasige Saug- und Flüssigkeitsleitungen für:

| Kältemittel | Rohrreihe |
| --- | --- |
| R513A | metrische Wieland-cupromed/cuprofrio-Serie |
| R448A | metrische Wieland-cupromed/cuprofrio-Serie |
| R744 (CO₂) | zöllige Wieland-K65-120-bar-Serie; nur unterkritischer Betrieb |

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

CoolProp 8.0.0 wird lokal als WebAssembly geladen. Die Anwendung fordert Sättigungszustände sowie thermodynamische und hydraulische Stoffwerte an. `src/fast-data.js` kann bei R448A und R513A für −35 bis 10 °C Verdampfung, 25 bis 55 °C Verflüssigung, 3 bis 40 K Überhitzung, 1 bis 10 K Unterkühlung und Saugverlustgrenzen bis 5 K vorberechnete Interpolationen bereitstellen. Für R448A darf die Flüssigkeitstemperatur dabei höchstens 50 °C betragen (begrenzter Viskositätsmodellbereich). Außerhalb der zulässigen Eingaben oder der tabellierten Druckbereiche verwendet der Solver CoolProp direkt; auch wenn der Aufbau der Stützpunkte fehlschlägt, fällt er auf CoolProp zurück. Die Stützpunkte werden für den jeweiligen Betriebspunkt mit CoolProp erzeugt; die Interpolation ersetzt keine zusätzliche technische Validierung.

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

Die automatische Wahl beginnt mit der kleinsten druckzulässigen Größe. Für Saugleitungen wird zunächst eine Größe gesucht, die die maximale Geschwindigkeit im anfänglichen Flussansatz einhält. Danach werden Endpunkt-Lastfälle mit den aktuellen Größen gerechnet. Bei Grenzverletzungen wird die betroffene automatische Größe abhängig von der Überschreitung angehoben; nahe der Grenze werden kleinere Schritte gewählt. Das gesamte Netz wird nach jedem Upgrade erneut gerechnet. Die obere Iterationsgrenze deckt alle möglichen Katalogstufen aller automatischen Leitungen ab, statt eine feste kleine Zahl von Upgrades vorzugeben.

Wird eine Rohrgröße direkt im aktuellen Ergebnis geändert, ist der folgende Lauf eine Nachrechnung: Alle übrigen Rohrgrößen werden für diesen Lauf auf die zuletzt berechneten Größen festgehalten, auch wenn sie in der Oberfläche weiterhin als „Automatisch“ geführt werden. Nur die geänderte Größe darf neu gewählt werden, falls sie ausdrücklich auf „Automatisch“ gestellt wird. Massenströme, Druckverluste, Endpunktwerte und Grenzwertmeldungen werden trotzdem neu gerechnet; neue Grenzwertverletzungen können deshalb sichtbar werden. Ein ausdrücklich gestarteter vollständiger Berechnungslauf dimensioniert automatische Größen wieder neu. Bei veralteten Ergebnissen erfolgt stattdessen ein vollständiger Lauf.

Wenn Grenzverletzungen auftreten, wertet eine Upgrade-Heuristik die betroffenen Pfade aus. Sie vergrößert eine automatische Rohrgröße anhand des Druckverlustanteils und des erwarteten Querschnittsgewinns. Der Schritt hängt von der Überschreitung ab und wird nahe dem Grenzwert kleiner. Manuelle Größen werden nicht geändert. Der Durchlauf ist durch alle möglichen Katalogübergänge des Netzes begrenzt; anschließend wird das Netz erneut ausgewertet und mögliche Grenzverletzungen werden angezeigt.

Geprüft werden:

- maximaler Druckverlust SL und FL in Kelvin (Sättigungstemperaturdifferenz);
- maximale Sauggasgeschwindigkeit;
- Mindestgeschwindigkeit ausschließlich an ausdrücklich aktivierten Steigleitungen mit positiver Länge an Rohrstrecken. Zusätzliche Rohrlängen der Strecken bleiben normale Rohrleitung. Eine markierte gemeinsame Strecke wird für die Kühlstellenlastfälle geprüft, deren Zielpfad sie enthält; auch der angezeigte Mindestwert umfasst nur diese Lastfälle. Die Kontrollfelder legen keine Höhendifferenz fest und erzeugen keinen zusätzlichen geodätischen Druckanteil. Eine tatsächliche Höhendifferenz ist weiterhin am Leitungsabschnitt einzutragen. Der Standardwert beträgt für alle Kältemittel 7 m/s; darunter lautet der Status „prüfen“, unter 5 m/s „kritisch“;
- Die Steigleitungslänge wird an der Rohrstrecke eingegeben; aus älteren Kühlstellen übernommene Längen werden zu vorhandenen Streckenangaben addiert und mit einem gemeinsamen Steigleitungsdurchmesser gerechnet. Im Ergebnis kann für die zusätzliche Länge einer Rohrstrecke eine eigene, höchstens so große Katalogrohrgröße geprüft und übernommen werden. Ohne positive Längenangabe gibt es keine Steigleitung. Der Solver berechnet Saugleitung und zusätzliche Steigleitung nacheinander mit ihren jeweiligen Innendurchmessern; Druckverlust, Stoffzustand und Maximalgeschwindigkeit berücksichtigen beide Abschnitte, die Mindestgeschwindigkeit den Steigleitungsanteil. Die Flüssigkeitsleitung erhält keinen zusätzlichen Längenanteil. Die Materialmengen für Rohr und Dämmung werden nach normaler Saugleitung und Steigleitung getrennt ausgewiesen, auch bei identischer Rohrgröße. In der Ergebnisliste erscheint nur die Gesamtlänge, im Steigleitungsdialog und im Berechnungs-CSV sind die Teilstreckenlängen ersichtlich; die gesamten Druckverluste und Stoffzustände beziehen sich weiterhin auf beide Teile. Die Übergangsstücke werden nicht automatisch bestimmt. Der Dialog zeigt zunächst das letzte Ergebnis und die erforderliche sowie die berechnete Mindestgeschwindigkeit. Änderungen an Steigleitungslänge oder Rohrgröße bleiben beim Prüfen unverbindlich: Der Dialog zeigt während der Berechnung einen Laufstatus und danach das geprüfte Ergebnis; erst ein gesonderter Klick auf „Übernehmen“ schreibt beide Werte und das Ergebnis ins Projekt. Neue Eingaben verwerfen die vorherige Prüfung. Die stationäre Prüfung ist keine Zusicherung der Ölrückführung im Betrieb;
- verbleibende Flüssigkeitsunterkühlung bzw. Erreichen der Phasengrenze.

Geschwindigkeitsüberschreitungen werden je betroffener Saugleitung einmal über alle Lastfälle gemeldet; als Kühlstellen werden nur die Ziel-Kühlstellen der Lastfälle zugeordnet, deren eigener Pfad die betroffene Strecke enthält und dort den Grenzwert überschreitet. Steigleitungswarnungen werden ebenso nur den Ziel-Kühlstellen zugeordnet, deren Pfad die betroffene Strecke enthält. Bei einem Endpunkt-Druckverlust über dem Grenzwert wird die Kühlstelle markiert. Einzelabschnitte werden nur dann als Grenzverletzung hervorgehoben, wenn ihr eigener Temperaturverlust den Grenzwert überschreitet; ein aufsummierter Pfadverlust allein markiert keine unkritischen Einzelabschnitte. Bei Phasenrisiko wird die Strecke markiert, an der der Flüssigkeitsdruck begrenzt wurde. Gemeinsame belastete Stammstrecken können mehrere Kühlstellen tatsächlich betreffen.

Die automatische Wahl startet mit den kleinsten druckzulässigen Größen und vergrößert nur Rohrleitungen auf den erkannten Verletzungspfaden. Das zielt auf kleine Leitungen, ist aber kein Beweis für das global kleinste Gesamtnetz: alternative Größenkombinationen werden nicht vollständig durchsucht. Manuelle Größen bleiben unverändert. Die Standard-Maximalgeschwindigkeit beträgt 30 m/s; die Mindestgeschwindigkeit für markierte Steigleitungen beträgt für alle Kältemittel standardmäßig 7 m/s.

Die Dimensionierungstests enthalten synthetische Baumstrukturen mit 2, 5 und 10 Kühlstellen. Sie prüfen die Einhaltung der Kriterien und protokollieren Laufzeiten; sie ersetzen keine Validierung an Hersteller- oder Felddaten. `GRENZEN EINGEHALTEN` bedeutet, dass die implementierten Prüfungen für die eingegebenen Daten keinen Grenzverstoß gefunden haben; es ist keine Anlagenfreigabe.

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
