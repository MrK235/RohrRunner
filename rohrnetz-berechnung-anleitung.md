# Berechnungsmodell von RohrRunner 0.1.0

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

Ein Projekt enthält Knoten und gerichtete Leitungsabschnitte. Der Netzeditor speichert die Geometrie als Punkte in der PDF-Zeichenebene. Die Berechnung akzeptiert ausschließlich einen zusammenhängenden, kreisfreien Baum mit:

- genau einem Anlagenstart vom Typ `start`;
- mindestens einer Kühlstelle vom Typ `endpoint` mit positiver Kälteleistung;
- eindeutigen IDs und gültigen Leitungsendpunkten;
- rechtwinkligen Leitungsabschnitten;
- genau einem Anschluss je Kühlstelle, mindestens zwei je Abzweig und mindestens einem am Anlagenstart;
- positivem Maßstab in Metern je PDF-Pixel.

Kreise, doppelte Verbindungen, getrennte Netzteile, ungültige Höhen-/Lastwerte und nicht rechtwinklige Wege werden vor der hydraulischen Berechnung abgewiesen. Es gibt keine geschlossene Ringnetzberechnung.

Die hydraulische Länge eines Abschnitts ist die Summe der orthogonalen Planstrecken multipliziert mit dem Maßstab, zuzüglich `max(0, extraLengthM)` des Abschnitts. Bei einer angeschlossenen Kühlstelle kommt deren zusätzliche Rohrleitung `extraLengthM` am letzten Abschnitt hinzu. Die in der Kühlstellenliste angezeigte Gesamtlänge summiert diese Längen auf dem Pfad vom Anlagenstart zur Kühlstelle. Ohne Maßstab oder vollständigen Pfad wird keine Gesamtlänge angezeigt.

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

Die Massenströme gemeinsamer Stammabschnitte werden aus den untergeordneten Zweigen aufsummiert. Nach der Druckrechnung aktualisiert der Solver den Endpunkt-Massenstrom anhand der Enthalpiedifferenz am berechneten Endzustand und wiederholt die Zustandsrechnung. Die Fixpunktschleife hat höchstens 12 Iterationen; wenn sie nicht konvergiert, wird ein Fehler ausgegeben.

## 5. Rohrkatalog und manuelle Größen

R513A und R448A verwenden die Serie `cuprofrio-metric`; R744 verwendet `k65-inch-120bar`. Der Innendurchmesser wird aus Außendurchmesser und Wandstärke berechnet:

```text
D_i = D_a − 2 · Wandstärke
```

In der Oberfläche ist der Auslegungsdruck als Überdruck in bar angegeben. Der Solver filtert Kataloggrößen mit der Bedingung:

```text
catalogBar ≥ designPressureBar + 1.01325 bar
```

Eine manuell festgelegte Größe muss in der gewählten Rohrserie enthalten und für den Auslegungsdruck zulässig sein. Die katalogisierten Druckwerte und ihre Temperatur-/Sicherheitsbedingungen sind keine Freigabe für die konkrete Anlage.

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

- Flüssigkeitsdruck wird entlang des Netzes vom Anlagenstart zu den Kühlstellen vorwärts berechnet.
- Saugdruck wird ausgehend vom bekannten Anlagenstartdruck entlang des Baums rückwärts zu den Endpunkten gelöst. Der Druck am Leitungsanfang wird iterativ so angepasst, dass Anfangsdruck minus Reibungs- und Höhenverluste den nachgelagerten Knotenwert ergibt.
- Für jede Kühlstelle wird ein eigener Volllast-Lastfall ausgewertet.
- Endpunkt-Druckverlust SL und FL sowie verbleibende Unterkühlung werden aus den berechneten Sättigungszuständen abgeleitet. Die Druckverlustgrenzen in K bezeichnen Sättigungstemperaturdifferenzen, keine Druckdifferenzen in bar.

## 8. Automatische Dimensionierung

Die automatische Wahl beginnt mit der kleinsten druckzulässigen Größe. Für Saugleitungen wird zunächst eine Größe gesucht, die die maximale Geschwindigkeit im anfänglichen Flussansatz einhält. Danach werden Endpunkt-Lastfälle mit den aktuellen Größen gerechnet. Bei Grenzverletzungen wird die betroffene automatische Größe abhängig von der Überschreitung angehoben; nahe der Grenze werden kleinere Schritte gewählt. Das gesamte Netz wird nach jedem Upgrade erneut gerechnet. Die obere Iterationsgrenze deckt alle möglichen Katalogstufen aller automatischen Leitungen ab, statt eine feste kleine Zahl von Upgrades vorzugeben.

Wenn Grenzverletzungen auftreten, wertet eine Upgrade-Heuristik die betroffenen Pfade aus. Sie vergrößert eine automatische Rohrgröße anhand des Druckverlustanteils und des erwarteten Querschnittsgewinns. Der Schritt hängt von der Überschreitung ab und wird nahe dem Grenzwert kleiner. Manuelle Größen werden nicht geändert. Der Durchlauf ist durch alle möglichen Katalogübergänge des Netzes begrenzt; anschließend wird das Netz erneut ausgewertet und mögliche Grenzverletzungen werden angezeigt.

Geprüft werden:

- maximaler Druckverlust SL und FL in Kelvin (Sättigungstemperaturdifferenz);
- maximale Sauggasgeschwindigkeit;
- Mindestgeschwindigkeit nur am letzten Saugleitungsabschnitt zu einer ausdrücklich als „Steigleitung“ markierten Kühlstelle. Nicht markierte Kühlstellen und ihre Leitungsabschnitte lösen diese Prüfung nicht aus. Die zusätzliche Rohrleitung der Kühlstelle wird zur hydraulischen Länge dieses letzten Abschnitts addiert und in dessen Druck- und Stoffzustandsberechnung berücksichtigt. Das Kontrollfeld legt keine Höhendifferenz fest und erzeugt keinen zusätzlichen geodätischen Druckanteil. Eine tatsächliche Höhendifferenz ist weiterhin am Leitungsabschnitt einzutragen. Der Standardwert beträgt für alle Kältemittel 7 m/s; darunter lautet der Status „prüfen“, unter 5 m/s „kritisch“;
- verbleibende Flüssigkeitsunterkühlung bzw. Erreichen der Phasengrenze.

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
