# RohrRunner

Lokale Browseranwendung zur Erfassung und Vorbemessung verzweigter Kältemittelrohrnetze. PDF-Grundrisse, Projektstände und Stoffdaten bleiben lokal. PDF.js und pdf-lib werden für PDF-Import und -Export von CDNs geladen; dafür ist eine Internetverbindung nötig. Rechenkern, CoolProp-WASM, Rohrkatalog und Stoffdaten liegen lokal.

**Version 0.1.0**

## Start

- **Ohne Installation:** `index.html` doppelklicken oder `RohrRunner.bat` starten. Node.js und ein lokaler Server sind für die normale Nutzung nicht erforderlich. Bei direktem Öffnen rechnet die App im Browser-Hauptthread statt im Web Worker.
- PDF-Grundrisse und PDF-Export verwenden PDF.js/pdf-lib von CDNs und brauchen Internetzugang. Netzberechnung und CoolProp-Stoffdaten sind lokal.
- Mit **Anlagenstart** einen Startpunkt setzen. Das Werkzeug **Lasten** bleibt aktiv, sodass beliebig viele Kühlstellen direkt nacheinander ohne Dialog platziert werden können. Name und frei definierbare Kälteleistung werden unmittelbar in der Seitenleiste bearbeitet; Komma und Punkt werden akzeptiert.
- **Leitung** bleibt ebenfalls aktiv. Die Live-Vorschau reicht immer rechtwinklig bis zum Mauszeiger; jeder freie Klick fixiert einen Abschnitt und wechselt die Achse. Trifft die neue Leitung auf ein vorhandenes Rohr oder startet dort, wird automatisch ein T-Stück angelegt.
- Im Werkzeug **Auswahl** lassen sich Knoten und Rohrsegmente markieren und per Drag & Drop verschieben. Angeschlossene Leitungen folgen dynamisch und bleiben rechtwinklig. Entf löscht die Auswahl; Undo/Redo bleiben verfügbar.
- Auf **Maßstab** klicken, zwei Punkte im Plan markieren und anschließend die bekannte reale Länge eingeben. Nach der Übernahme verschwinden Messpunkte und Messlinie; der grüne Button **✓ Maßstab** zeigt die erfolgte Kalibrierung. Der PDF-Editor verwendet aktuell Seite 1.
- Beim Zoomen skalieren Rohrpositionen exakt mit dem Plan, während Strichstärken, Knoten und Beschriftungen in einer konstant bedienbaren Bildschirmgröße bleiben.
- Betriebspunkt und Lasten eingeben, danach **Netz berechnen**. Projekte lassen sich als `.rohrrunner` sichern und weiterhin aus älteren `.rohrtanplan`-Dateien öffnen; Ergebnisse als CSV exportieren.

## Rechenumfang

R513A, R448A und unterkritisches R744; Saug- und Flüssigkeitsleitungen; lokale CoolProp-8.0.0-Stoffdaten; Rohrabmessungen und Druckangaben aus dem mitgelieferten Wieland-Katalog. Die Druckrechnung integriert Reibung, Höhendifferenz und Einbautenzuschlag abschnittsweise. Die Saugleitung wird vom bekannten Anlagendruck entgegen der Fließrichtung rückwärts gelöst. Lastfälle halten jeweils eine Kühlstelle auf Volllast und belasten die übrigen mit dem Gleichzeitigkeitssatz. Der Solver vergrößert wiederholt Rohre auf den Pfaden mit Grenzverletzungen und zeigt Druckverlust, Geschwindigkeit und Endpunktreserven.

Die Anwendung behandelt stationäre Einphasenfälle. Nicht eingetragene Höhen werden als 0 m angenommen; die Flüssigkeitstemperatur bleibt entlang des Strangs konstant. Transkritisches CO₂, Druckgasleitungen, Teillast-Ölrückführung, Ventilauslegung, kombinierte Kältekreise, Temperaturverläufe entlang der Flüssigkeitsleitung und unabhängige Anlagenreferenz-Abnahme sind nicht implementiert. Die automatische Dimensionierung ist eine begrenzte Upgrade-Heuristik; sie prüft die Grenzwerte, garantiert aber kein global kostenoptimales Rohrnetz. Eine bestandene technische Abnahme und eine generelle Eignung für Bauausführung werden nicht behauptet. Die CoolProp-Mischungsmodelle und Herstellerkalibrierungen sind in `src/stoffdaten.js` beschrieben; Katalogquelle und Druckhinweise stehen in `data/pipe-catalog.json`.

## Verifikation

`node --test tests/*.test.mjs` prüft Reibung, Netztopologie, Grenzfälle und synthetische Stoffdatenfälle für alle drei Kältemittel. Zusätzlich werden Dezimalwerte, strikt rechtwinklige Zeichenwege, Schnittpunkterkennung für T-Stücke sowie die UI-Verträge der Dialog- und Kalibrierungssteuerung geprüft. Für einen lokalen Browserlauf steht `node scripts/serve.mjs` bereit. Diese Tests verifizieren die Softwarelogik und Referenzzustände, ersetzen aber keine Abnahme an realen Anlagen und Rohrherstellerdaten.
