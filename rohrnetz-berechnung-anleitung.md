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

Die hydraulische Länge eines Abschnitts ist die Summe der orthogonalen Planstrecken multipliziert mit dem Maßstab, zuzüglich `max(0, extraLengthM)`. Eine zusätzliche Länge ist daher ein Zuschlag zur gezeichneten Strecke.

## 3. Stoffzustände und Kältemittel

CoolProp 8.0.0 wird lokal als WebAssembly geladen. Die Anwendung fordert Sättigungszustände sowie thermodynamische und hydraulische Stoffwerte an. `src/fast-data.js` kann innerhalb der dort definierten Temperatur-, Druck- und Überhitzungsbereiche vorberechnete Interpolationen für R448A und R513A bereitstellen; wenn Eingaben außerhalb dieser Bereiche liegen, verwendet der Solver den Stoffdatenzugriff ohne diesen Fast-Path.

Für die Saugleitung gilt die Taupunkttemperatur plus eingestellte Überhitzung. Für die Flüssigkeitsleitung wird eine konstante Flüssigkeitstemperatur `T_liquid = T_condensation − subcooling` angesetzt. Bei zeotropen Gemischen werden Blasen- und Taupunkt getrennt behandelt.

R744 wird ab einer Verflüssigungstemperatur am kritischen Punkt `304.1282 K` (etwa `30.98 °C`) abgewiesen. Druckgas-/Gaskühlerzustände werden nicht ausgewertet.

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

Die Saugseite wird in acht, die Flüssigkeitsseite in vier Teilabschnitte integriert. Stoffwerte werden während dieser Integration am jeweils aktuellen Druck ausgewertet. Flüssigkeitsdruck wird vor dem Unterschreiten der berechneten Phasengrenze begrenzt und als Phasenrisiko gemeldet.

## 7. Druckrichtung und Endpunktzustände

Am Anlagenstart werden Saugdruck aus Verdampfung und Taupunkt sowie Flüssigkeitsdruck aus Verflüssigung und Blasenpunkt gesetzt.

- Flüssigkeitsdruck wird entlang des Netzes vom Anlagenstart zu den Kühlstellen vorwärts berechnet.
- Saugdruck wird ausgehend vom bekannten Anlagenstartdruck entlang des Baums rückwärts zu den Endpunkten gelöst. Der Druck am Leitungsanfang wird iterativ so angepasst, dass Anfangsdruck minus Reibungs- und Höhenverluste den nachgelagerten Knotenwert ergibt.
- Für jede Kühlstelle wird ein eigener Volllast-Lastfall ausgewertet.
- Endpunkt-Saugverlust, Flüssigkeitsverlust und verbleibende Unterkühlung werden aus den berechneten Sättigungszuständen abgeleitet.

## 8. Automatische Dimensionierung

Die automatische Wahl beginnt mit der kleinsten druckzulässigen Größe. Für Saugleitungen wird zunächst eine Größe gesucht, die die maximale Geschwindigkeit im anfänglichen Flussansatz einhält. Danach werden Endpunkt-Lastfälle mit den aktuellen Größen gerechnet.

Wenn Grenzverletzungen auftreten, wertet eine begrenzte Upgrade-Heuristik die betroffenen Pfade aus. Sie vergrößert eine automatische Rohrgröße anhand des Druckverlustanteils und des erwarteten Querschnittsgewinns. Manuelle Größen werden dabei nicht automatisch geändert. Der Upgrade-Durchlauf ist auf höchstens acht Durchgänge bzw. zwei je Netzabschnitt begrenzt; anschließend wird das Netz erneut ausgewertet und mögliche Grenzverletzungen werden angezeigt.

Geprüft werden:

- maximaler Saug- und Flüssigkeitsverlust in Kelvin;
- maximale Sauggeschwindigkeit;
- Mindestgeschwindigkeit nur für steigende Saugleitungen (`suctionDeltaZ > 0`);
- verbleibende Flüssigkeitsunterkühlung bzw. Erreichen der Phasengrenze.

Die Heuristik ist kein globaler Kosten- oder Optimierungsbeweis. `GRENZEN EINGEHALTEN` bedeutet, dass die implementierten Prüfungen für die eingegebenen Daten keinen Grenzverstoß gefunden haben; es ist keine Anlagenfreigabe.

## 9. Relevante Vereinfachungen

- Stationäre Einphasenrechnung; nicht eingetragene Höhendifferenzen sind 0 m.
- Flüssigkeitstemperatur bleibt entlang eines Strangs konstant.
- Gleichzeitigkeit wird als Endpunkt-Lastfall behandelt; es gibt keine Zeitreihe oder dynamische Regelung.
- Die Reibungs- und Viskositätszuschläge sind Eingabeparameter, keine automatisch ermittelten Normwerte.
- Die Katalogdruckwerte gelten nur unter den im Katalog dokumentierten Bedingungen.
- Rohrkatalog, Stoffwertquellen und gerundete Herstellerwerte stehen in `data/pipe-catalog.json` und `data/fluid-references.json`.

Ergebnisse sind vor einer Ausführung unabhängig fachlich, anhand der Anlagenrandbedingungen und der aktuellen Herstellerdaten zu prüfen.
