# RohrRunner Code Review und Testprotokoll

Prüfdatum: 26. November 2026. Geprüfter Produktstand: **1.2.5**, Commit `2d364414f5d43f4eb7ee6605e5c100abc0e3b0ac`.

Die üblichen Arbeitsabläufe und alle 88 vorhandenen Tests funktionieren im geprüften Umfang. Zusätzliche Negativtests decken jedoch Fehler auf, die unzutreffend gültige Ergebnisse, verlorene Steigleitungslängen und einen beschädigten Importzustand ermöglichen. Dazu kommen eine bekannte PDF.js-Sicherheitslücke und eine unter Windows umgehbare Dateifreigabeliste des lokalen Servers. Diese Befunde sollten vor weiteren Fachfunktionen behoben werden.

Der Review umfasst neun bestätigte Defektgruppen, einen unter verzögertem PDF-Zugriff reproduzierten Speicherrisiko-Fall und eine gemessene Laufzeitgrenze. **Die Produktfehler sind offen.** Dieser Arbeitsstand ergänzt Prüfwerkzeug, Rohprotokolle und Maßnahmen; er ändert weder Berechnungsverhalten noch Produktversion.

## Repository und Prüfbedingungen

Der lokale Branch `main` war sauber. `git fetch --prune origin` und `git merge --ff-only origin/main` aktualisierten ihn von `b26aaae` auf `2d36441`, einschließlich der bereits veröffentlichten Version 1.2.5. Es wurde kein zusätzlicher Versionssprung veranlasst und kein Push ausgeführt.

Die Prüfungen liefen unter Windows mit Node.js **v24.22.3**. npm und cargo waren im verfügbaren Suchpfad nicht vorhanden. Die vorhandene JavaScript-Suite wurde deshalb direkt mit Node ausgeführt. Der echte Browserlauf verwendete den integrierten Chromium-Browser und `http://127.0.0.1:4173/`. Ausschließlich synthetische Netze wurden erzeugt; Kundenprojekte und echte Grundrisse waren nicht beteiligt.

Der Review betrachtet den eigenen Anwendungscode über alle Funktionsbereiche: Editor und Geometrie, Kältemittel- und Kälteträgerrechnung, Stoffdatenadapter und Interpolation, Kataloge, Ergebnis- und Materialausgabe, Import/Export, IndexedDB, Worker, Service Worker, lokalen Server, Startskripte sowie Tauri- und Release-Konfiguration. Minifizierte Drittbibliotheken wurden nach Version, Einbindung und einschlägigen Herstellerhinweisen geprüft, nicht vollständig zeilenweise auditiert.

## Testergebnisse

| Prüfung | Ergebnis | Nachweis |
| --- | --- | --- |
| Vorhandene vollständige Suite | **88 bestanden**, 0 Fehler, 0 übersprungen; 53,431 s | [baseline-tests.tap](baseline-tests.tap) |
| Zusätzlicher Review-Audit | **7 bestanden, 11 verletzte Erwartungen**, auf mehrere Defektgruppen verteilt | [audit.json](audit.json), [Prüfskript](../../../scripts/review-audit.mjs) |
| Belastung mit 10, 100, 500 und 1499 Kühlstellen | 3 Läufe abgeschlossen; größter Lauf nach 30 s abgebrochen | [stress.json](stress.json) |
| Direkte Stoffwerte gegen Interpolation | 7 Stoffvergleiche ohne Größen-/Statusabweichung; R744 separat direkt | [benchmark.json](benchmark.json) |
| Medienmatrix | 8 Kältemittel sowie 9 Kälteträger in je 2 Rohrserien mit endlichen Ergebnissen | `MEDIA-01`, `MEDIA-02` |
| Unabhängig formulierte hydraulische Nachrechnung | Wasserfall stimmt bis unter 10⁻⁸ Pa mit der Darcy-Weisbach-Nachrechnung überein | `HYD-02` |
| Geometrieprobe | 1000 deterministische Knotenverschiebungen bleiben orthogonal; Originalnetz unverändert | `EDIT-02`, Startwert 235 |
| Daten und Auslieferung | 4 Katalogserien konsistent; 35 Offline-Dateien vorhanden; Worker-Bundle entspricht Quellen nach Zeilenendennormalisierung | `DATA-01`, `PWA-01`, `BUILD-01` |
| Syntax | 14 klassische JS-Dateien und 6 JSON-Dateien syntaktisch gültig; neues Prüfskript mit `node --check` geprüft | Lokaler Syntaxlauf |

Die bestehende Suite verteilt sich auf Browserhülle (33), Zeichnen (9), Editor (11), Engine (28), Material (2), Workerstart (1) und ZIP (4). Viele UI-Prüfungen untersuchen Quelltextmuster oder isolierte Funktionen. Sie ersetzen keine vollständigen Browserabläufe. Die neu gefundenen Fehler erklären, weshalb eine grüne Suite allein nicht genügt.

Die hydraulische Gegenrechnung verwendet eine eigene Formulierung für Massenstrom, Geschwindigkeit, Reynolds-Zahl, Reibungszahl und Vor-/Rücklauf-Druckverlust. Ihre Stoffwerte stammen weiterhin aus derselben lokalen CoolProp-Instanz. Das ist eine unabhängige Prüfung der Rechenverknüpfung, keine unabhängige Validierung der Stoffwerte oder einer realen Anlage. Im geprüften Fall ergeben sich 0,198533 kg/s und 6429,281416 Pa Kreisdruckverlust.

### Echte Browserabläufe

| Ablauf | Beobachtung |
| --- | --- |
| Neues Projekt und Tastaturzeichnen | Start, Kühlstelle und Verbindung lassen sich mit Werkzeugen, Pfeiltasten und Eingabe anlegen. |
| Eingabefehler | Kühlstelle ohne Leistung wird mit verständlicher Meldung abgewiesen. |
| Kältemittelrechnung | R513A, 3 kW, 4 m: Grenzen eingehalten; SL 15 × 1 mm, FL 10 × 1 mm; SL-Verlust 1,18 K. |
| Materialübersicht | Je 4 m Rohr passend zu SL und FL; Ventile und Dämmung mit zugehörigen Außendurchmessern. |
| Änderung nach abgeschlossener Rechnung | Leistung und Maßstab ändern setzt den Entwurfsstatus, zeigt „Ergebnis veraltet“ und blendet CSV-Export aus. Das deckt die Änderung **während** einer Rechnung nicht ab, siehe R02. |
| Umschaltung auf Kälteträger | Wasser, 6/12 °C, 4 kW, 8 m: 0,57 m³/h, 40,97 kPa, Vor- und Rücklauf 15 × 1 mm. |
| Projektpaket | „Sichern“ endet mit der App-Meldung „Projektpaket erstellt“. CSV-Export wurde ausgelöst. Die heruntergeladenen Dateien wurden in diesem Browserlauf nicht unabhängig geöffnet. |
| Neustart und Wiederöffnung | Nach Neuladen ist das synthetische Projekt in der Projektverwaltung vorhanden. Netz, Maßstab 0,2, Kälteträgermodus und Ergebnis werden wiederhergestellt. |
| Layout | Bei 1280 × 900 px überlaufen die Druckverlustzellen; bei schmalem Fenster erscheint die vorgesehene Einschränkungsmeldung. |

Eine wartende Download-Ereignisabfrage der Browsersteuerung brach ab. Nach Wiederherstellung der Steuerung ließen sich die Exportaktionen direkt auslösen. Bei einzelnen automatisierten Füllzugriffen trat außerdem `l.nodeName.toLowerCase is not a function` auf; die Eingaben wurden anschließend mit nativen Tasten geprüft. Diese Steuerungsprobleme werden nicht als bestätigte Produktfehler gezählt.

## Bestätigte Defekte

P1 bedeutet hohe Priorität vor weiterer Nutzung der betroffenen Funktion beziehungsweise vor der nächsten Auslieferung. P2 bedeutet eine relevante Korrektur mit begrenzterem Auslöser oder Auswirkung. Keiner dieser Befunde behauptet eine technische Anlagenfreigabe.

### R01 PDF Import verwendet eine bekannte verwundbare Bibliothek

**P1 · Sicherheit · `src/app.js:422`, `vendor/pdfjs/pdf.min.js` · Audit `SEC-01`**

Die tatsächlich geladene Bibliothek meldet **PDF.js 3.11.174**. `loadPdfBytes` ruft `getDocument` ausschließlich mit den PDF-Bytes auf; `isEvalSupported: false` fehlt. Mozilla beschreibt für Versionen bis 4.1.392 eine JavaScript-Ausführung durch präparierte PDFs bei der standardmäßig aktivierten Eval-Funktion. Der dokumentierte Fix liegt in 4.2.67, der Workaround ist `isEvalSupported: false`. Die Tauri-CSP erlaubt hier weiterhin `unsafe-eval`; sie ist daher keine Absicherung dieses Pfads. [Mozilla Advisory CVE-2024-4367](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq).

**Nachweis:** Version aus dem lokal ausgeführten Bibliotheksmodul und Prüfung des tatsächlichen PDF-Aufrufs. Es wurde kein schädliches PDF ausgeführt. Die Betroffenheit folgt aus Version und Konfiguration; eine vollständige Ausnutzung wurde nicht versucht.

**Korrektur und Abnahme:** Den von Mozilla genannten Workaround explizit setzen und durch einen Verhaltenstest der an `getDocument` übergebenen Optionen absichern. Anschließend auf eine zum Umsetzungszeitpunkt unterstützte, sicherheitsgeprüfte PDF.js-Version migrieren und PDF-Worker, `file://`, Offline-Betrieb und Desktop-CSP zusammen testen. 4.2.67 bezeichnet hier nur den Fix dieser konkreten Lücke, keine pauschale Empfehlung für eine aktuelle Zielversion. Bis zur Korrektur nur vertrauenswürdige PDFs öffnen.

### R02 Laufende Berechnung überschreibt Änderungen mit einem alten Ergebnis

**P1 · Ergebnisintegrität · `src/app.js:28`, `src/app.js:304` · Audit `ASYNC-01`**

`calculate` kopiert das Netz und schützt den Rückruf mit `id !== runId`. `invalidate` markiert Änderungen, erhöht aber `runId` nicht. Änderungen an Leistung, Maßstab oder Leitungen bleiben während des Worker-Laufs möglich. Kommt anschließend dessen Antwort, akzeptiert `done` sie und `showResult` setzt `dirty` und `resultStale` wieder auf falsch. Damit kann ein Ergebnis zu alten Eingaben als aktuell erscheinen und exportiert werden.

**Reproduktion:** Rechnung für 3 kW starten, während der ausstehenden Antwort die aktuelle Kühlstelle auf 20 kW ändern und `invalidate` ausführen, danach die alte Antwort zustellen. Der Test mit den tatsächlichen Steuerfunktionen akzeptiert die 3-kW-Antwort; `resultStale=false`.

**Korrektur und Abnahme:** Eine Netzrevision mit jedem fachlich relevanten Edit erhöhen und mit jedem Auftrag mitsenden. Nur Antworten derselben Revision und Projekt-ID übernehmen. Tests müssen Antworten nach Last-, Maßstabs-, Geometrieänderung und Undo sowie in vertauschter Reihenfolge zustellen. Keine alte Antwort darf Badge, Materialliste oder Export freigeben. Eine Abbruchfunktion sollte den Worker tatsächlich beenden oder veraltete Aufträge aus seiner Warteschlange entfernen.

### R03 Ungültige Geometrie kann ein gültiges NaN Ergebnis erzeugen

**P1 · Solvervalidierung · `src/engine.js:16`, `src/engine.js:76` · Audits `INPUT-02`, `INPUT-03`, `INPUT-04`**

`analyze` prüft weder alle Koordinaten auf endliche Zahlen noch die Übereinstimmung der Pfadenden mit den referenzierten Knoten. Auch ein unendlicher positiver Maßstab passiert `calibration > 0`. Fehlende Koordinaten erzeugen `NaN`; Vergleiche mit `NaN` erkennen anschließend weder einen schrägen Pfad noch einen überschrittenen Druckgrenzwert.

**Reproduktion:** Im synthetischen Wasserfall den letzten Pfadpunkt durch `{y:0}` ersetzen. Rückgabe: **`valid=true`, `lengthM=NaN`, `pressureDropPa=NaN`, keine Issues**. Weitere Proben akzeptieren `Infinity` als Maßstab und eine 1-m-Punktfolge zwischen 100 m voneinander entfernten Knoten. Der letzte Fall bleibt numerisch endlich, berechnet aber eine falsche Länge.

**Korrektur und Abnahme:** Vor jeder Berechnung gemeinsame Schema- und Geometrieprüfung verwenden: endliche Koordinaten, positiver endlicher Maßstab, positive endliche Lasten, erlaubte Typen, IDs und Verweise, konsistente Pfadenden sowie gültige Zusatzlängen, Widerstände und Höhen. Vor `valid=true` alle relevanten Ergebniszahlen nochmals auf Endlichkeit prüfen. Fehler müssen verständlich abbrechen; diese drei Auditfälle müssen bestehen.

### R04 Projektimport ersetzt den Zustand vor ausreichender Inhaltsprüfung

**P1 · Import und Bedienbarkeit · `src/app.js:368`, `src/app.js:389` · Audit `INPUT-01`**

`validateProjectImport` prüft Version, Arraytypen, Mengen und PDF-Größe, nicht die Inhalte. Beispielsweise passiert `{"version":1,"nodes":[null],"edges":[]}` die Prüfung. Der Importhandler ersetzt danach `project`, bevor `renderAll` beziehungsweise die Migrationen auf `node.type` zugreifen. Der äußere Fehlerdialog stellt das alte Projektobjekt nicht wieder her.

**Auswirkung:** Eine fehlerhafte Datei kann den geöffneten Editor in einen teilweise umgestellten, nicht mehr normal renderbaren Zustand bringen. Die zuvor gespeicherte Projektkopie wird dadurch nicht zwangsläufig gelöscht; ein erfolgreicher, atomarer Import ist aber nicht gewährleistet.

**Korrektur und Abnahme:** Daten, Einstellungen, Bas64/PDF und Migrationen an einem isolierten Kandidaten vollständig prüfen. Erst nach Erfolg den aktiven Zustand austauschen. Abgewiesene Dateien müssen Netz, Projekt-ID, PDF und Undo-Historie unverändert lassen. Fuzzfälle für null-Elemente, doppelte IDs, ungültige Verweise, Pfade, Einstellungen und beschädigte PDF-Bytes ergänzen. Eingabefehler und Speicherfehler getrennt melden.

### R05 Zusammenführen von Rohrstrecken verliert Steigleitungsdaten

**P1 · Editor und Materialmengen · `src/editor-core.js:170` · Audit `EDIT-01`**

Beim Entfernen eines T-Abzweigs verbindet `deleteSelection` die zwei übrigen Strecken. Es summiert Zusatzlängen und Widerstände, übernimmt die übrigen Eigenschaften aber mit `...first`. `pipeRiser`, `pipeRiserLengthM` und `riserSizeId` der zweiten Strecke gehen verloren.

**Reproduktion:** Die zwei verbleibenden Teilstrecken haben 2 m und 6 m Steigleitung. Nach dem Löschen der dritten Kühlstelle enthält die zusammengeführte Strecke nur **2 m statt 8 m**. Liegt die Steigleitung ausschließlich auf der zweiten Strecke, kann sie ganz verschwinden. Das beeinflusst die nächste Dimensionierung und Materialausgabe.

**Korrektur und Abnahme:** Die fachliche Zusammenführungsregel ausdrücklich definieren. Gleiche Steigleitungsgrößen dürfen ihre Längen addieren; unterschiedliche Größen sollten als getrennte Abschnitte erhalten bleiben oder einen sichtbaren Konflikt erzeugen. Beide Reihenfolgen der Kanten, deaktivierte Steigleitungen, Undo und Redo testen. Keine hydraulisch wirksame Eigenschaft darf still entfallen.

### R06 Windows Pfadtrenner umgehen die Dateifreigabeliste

**P2 · Lokaler Server · `scripts/serve.mjs:16` · Audit `SEC-02`**

Die Freigabeliste zerlegt den dekodierten URL-Pfad nur an `/`. Windows behandelt anschließend bei `resolve` auch `\` als Trenner. Dadurch kann ein scheinbar erlaubter Pfad unter `src/` in eine andere Datei innerhalb des Repositorys aufgelöst werden.

**Reproduktion unter Windows:** `/.git/config` liefert 403. `/src/x%5c..%5c..%5c.git%5cconfig` und `/src/x%5c..%5c..%5cAGENTS.md` liefern dagegen **200**. Der wiederholbare Audit verwendet nur `AGENTS.md` und protokolliert keine privaten Dateiinhalte.

**Grenze der Aussage:** Die Bindung an `127.0.0.1` bleibt bestehen. Der Realpath-Test begrenzt den Zugriff weiter auf das Repository; ein beliebiger Zugriff außerhalb davon oder ein über das Internet erreichbarer Server wurde nicht nachgewiesen. Innerhalb des Repositorys kann die Freigabeliste jedoch private Dateien nicht zuverlässig schützen.

**Korrektur und Abnahme:** Rückwärtsschrägstriche nach dem Dekodieren abweisen oder einheitlich normalisieren, danach Freigabeliste und aufgelösten Zielpfad prüfen. Windows- und Linux-Tests mit kodierten Trennern, Punktsegmenten und Symlinks durchführen. Private Ziele müssen 403/404 liefern, reguläre Laufzeitdateien weiterhin 200.

### R07 Flüssigkeitswerte verwenden unterschiedliche Sättigungskurven

**P2 · Fachliche Ergebnisdarstellung · `src/engine.js:214`, `src/engine.js:217` · Audit `HYD-01`**

Die Endpunktgröße `liquidK` verwendet die Blasenpunktdifferenz. Die Rohrzeile `temperatureDropK` und `directEdgeIds` verwenden dagegen für beide Leitungsarten `dewK`. Bei Gemischen mit Temperaturgleit sind die Differenzen nicht identisch.

**Reproduktion:** R448A, ein einzelner Abschnitt mit 10 m und 3 kW am Standardbetriebspunkt des Audits. FL-Zeile: **0,0644407 K**; identischer Gesamtpfad am Endpunkt: **0,0674190 K**. Die Differenz beträgt etwa 4,4 % des Endpunktwerts. Andere Betriebspunkte sind damit nicht quantifiziert.

**Korrektur und Abnahme:** Temperaturbasis je Leitungsart zentral festlegen und in Zeile, Endpunkt, Einzelstreckenmarkierung und CSV gleich verwenden. Für Saug- und Flüssigkeitsseite jeweils einen Einzelabschnitt und mehrere Abschnitte mit einem Gleitgemisch testen. Die entsprechende Annahme in `PLAN.md` bei Umsetzung präzisieren. Der Vergleich belegt eine interne Inkonsistenz, keine unabhängige thermodynamische Referenzvalidierung.

### R08 Kälteträgerverletzungen werden in Ergebniszeilen nicht zugeordnet

**P2 · Warnungsdarstellung · `src/app.js:296`, `src/app.js:298` · Audit `UI-01`**

Der Kälteträger-Solver liefert `secondary-pressure`. `resultStatusByEdge` berücksichtigt diesen Typ nicht, und `renderSecondaryResult` versieht weder betroffene Rohrzeilen noch Kühlstellen mit `limit` oder `check`. Geschwindigkeitsmeldungen werden im gemeinsamen Mapper außerdem pauschal der Saugleitungs-/Vorlaufseite zugeordnet, obwohl sie beim Kälteträger auch den Rücklauf betreffen können.

**Nachweis:** Eine kritische Druckmeldung für eine konkrete Strecke ergibt eine leere Status-Map; der separate Renderer enthält keine entsprechende Statusanwendung. Globale Meldung und Badge bleiben vorhanden. Der Fehler ist die fehlende eindeutige Zuordnung, nicht das vollständige Verschweigen eines Grenzverstoßes.

**Korrektur und Abnahme:** Issues um Leitungsart und betroffene Endpunkte ergänzen, gemeinsame Statusregeln für beide Berechnungsarten verwenden. Einen manuell festgelegten, zu kleinen Vorlauf, einen zu kleinen Rücklauf und einen unzulässigen Kreis prüfen. Genau die betroffenen Zeilen müssen markiert sein und denselben Status im CSV tragen.

### R09 Druckverlustwerte überlaufen im Desktoplayout

**P2 · Oberfläche · `src/theme.css:135`, `src/style.css:321`, `src/app.js:298` · echter Browserlauf**

Bei 1280 × 900 px und dem Wasserfall mit 4 kW und 8 m sind die Zellen für `20,97 kPa` und `20,00 kPa` jeweils **50 px** breit, benötigen aber **59 px** (`scrollWidth`). Die Texte ragen in die Nachbarspalten. Die neuen Einheiten aus dem aktualisierten Stand benötigen mehr Platz als die vorhandene Grid-Aufteilung vorsieht. Die Rohrgrößenauswahl wird ebenfalls stark gekürzt.

**Korrektur und Abnahme:** Gridbreiten an Zahl und Einheit ausrichten, Mindestbreiten beziehungsweise einen gezielten Umbruch vorsehen und konkurrierende CSS-Überschreibungen reduzieren. Visuelle Prüfungen bei 960, 1280 und 1600 px, hellem/dunklem Design und größeren Druckwerten ergänzen. In den Zahlenzellen muss `scrollWidth <= clientWidth` gelten oder ein ausdrücklich vorgesehenes Scroll-/Umbruchverhalten sichtbar sein.

## Weitere Risiken und Belastungsgrenzen

### R10 Speichern kann bei verzögertem PDF Zugriff Projektstände vermischen

**P2 · Bedingter Parallelitätsbefund · `src/app.js:34` · Audit `ASYNC-02`**

`persistProject` liest Name und Einstellungen vor `await projectPdfBytes()`, kopiert das globale `project` aber erst danach. Wird während einer verzögerten PDF-Beschaffung das Projekt gewechselt, kann der Datensatz von B PDF-Bytes aus A erhalten. Der deterministische Funktionstest reproduziert genau diese Reihenfolge.

Die Verzögerung wird im Test gezielt erzeugt. Eine normale interaktive Wiederöffnung mit bereits verfügbaren PDF-Bytes zeigte diesen Fehler nicht. Deshalb wird der Fall als **bedingtes Risiko**, nicht als im Browser nachgewiesener Datenverlust eingeordnet. Eine unveränderliche Projekt-/PDF-Momentaufnahme vor dem ersten `await` und eine serialisierte Speicherwarteschlange würden die Voraussetzung beseitigen. Abnahme: künstlich verzögerte PDF-/IndexedDB-Zugriffe bei schnellem Projektwechsel dürfen Datensätze nie vermischen.

### R11 Große Kälteträgerbäume werden überproportional langsam

**P2 · Skalierung · `src/engine.js:73`, `src/engine.js:79`, `src/engine.js:81` · Stressprüfung**

| Kühlstellen | Knoten | Strecken | Gemessene Dauer im Kindprozess | Ergebnis |
| ---: | ---: | ---: | ---: | --- |
| 10 | 21 | 20 | 1,703 s | Gültig, endliche Werte |
| 100 | 201 | 200 | 1,773 s | Gültig, endliche Werte |
| 500 | 1001 | 1000 | 11,347 s | Gültig, endliche Werte |
| 1499 | 2999 | 2998 | über 30 s einschließlich Prozessstart | Durch Prüfwerkzeug beendet |

Der synthetische Baum besteht aus einer langen Stammfolge mit kurzen Verbraucherabzweigen. Alle Rohre sind manuell auf 54 × 1,5 mm gesetzt, die Verbraucher haben je 0,01 kW. Somit ist selbst keine umfangreiche automatische Größensuche erforderlich. Der größte Fall liegt innerhalb der dokumentierten Importgrenzen. Die ersten Läufe enthalten kalte Stoffwertabfragen; die Werte sind keine isolierten Mikrobenchmarks. Der erste unbeschränkte Versuch wurde beendet und anschließend mit begrenzten Kindprozessen wiederholt.

30 Sekunden sind das **gewählte Prüfzeitbudget**, keine zugesagte Produktgrenze. Das Ergebnis beweist weder einen Absturz noch eine Endlosschleife. Wiederholte `find`- und `filter`-Suchen über alle Ergebniszeilen innerhalb aller Endpunktpfade erklären jedoch das starke Wachstum; bei langen Bäumen entstehen bis zu kubische Teiloperationen. Empfohlen sind Maps nach Kanten-ID, einmal berechnete Pfadverluste und eine sichtbare Abbruchmöglichkeit. Vor Freigabe großer Netze Laufzeitziele auf definierter Hardware festlegen und mit mehreren Netzformen prüfen.

## Vergleich des direkten und interpolierten Rechenpfads

Der bestehende Benchmark wurde für je eine Kühlstelle, einen Durchlauf und alle acht Kältemittel ausgeführt. Von den sieben Stoffen mit Tabellenpfad zeigte keiner andere Rohrgrößen oder einen anderen Warnstatus. Die größte relative Abweichung der verglichenen Ergebnisfelder betrug **0,0929 %** bei R513A; die größte absolute Druckabweichung **22,21 Pa**. R744 verwendet keinen Tabellenpfad.

| Stoff | Direktlauf | Interpolierter Lauf ohne Tabellenaufbau | Tabellenaufbau |
| --- | ---: | ---: | ---: |
| R513A | 2785 ms | 11,9 ms | 1752 ms |
| R448A | 19668 ms | 9,5 ms | 910 ms |
| R744 | 217 ms | entfällt | entfällt |
| R134a | 1205 ms | 18,0 ms | 50 ms |
| R404A | 8670 ms | 7,1 ms | 354 ms |
| R407C | 7887 ms | 6,2 ms | 320 ms |
| R449A | 14756 ms | 4,8 ms | 576 ms |
| R452A | 9400 ms | 5,5 ms | 380 ms |

Die Zeiten sind Einzelmessungen mit warm werdenden Caches; teilweise liefen weitere Prüfprozesse gleichzeitig. Sie eignen sich zur Beschreibung dieses Laufs, nicht für belastbare Hardwarevergleiche oder eine garantierte Beschleunigung. Die Konsistenz dieses Betriebspunkts bestätigt auch nicht den gesamten zulässigen Temperatur-, Druck- und Lastbereich. Die bestehende Suite enthält ergänzende synthetische Netze und Interpolationsproben.

## Priorisierte Verbesserungen

| Reihenfolge | Arbeitspaket | Prüffähiges Ergebnis |
| --- | --- | --- |
| 1 | PDF-Einbindung und Windows-Server absichern | `SEC-01` und `SEC-02` bestehen; sichere PDF-Version/Optionen sind dokumentiert; private Dateien bleiben gesperrt. |
| 2 | Gemeinsame Eingabeprüfung und atomarer Import | `INPUT-01` bis `INPUT-04` bestehen; abgewiesene Importe verändern den aktiven Zustand nicht. |
| 3 | Netzrevisionen, Worker-Abbruch und Speichermomentaufnahmen | `ASYNC-01` und `ASYNC-02` bestehen; nach jeder Änderung sind Ergebnisse eindeutig einem Eingabestand zugeordnet. |
| 4 | Fachlich vollständige Editoroperationen | `EDIT-01` besteht; Längen, Höhen, Widerstände und manuelle Größen bleiben bei Split/Merge/Undo erhalten oder erzeugen sichtbare Konflikte. |
| 5 | Einheitliche Ergebnissemantik | `HYD-01` und `UI-01` bestehen; Tabellen, Plan, CSV und Warnungen stimmen überein; Modelländerungen in `PLAN.md` dokumentiert. |
| 6 | Lesbare Tabellen und skalierender Solver | R09 visuell behoben; vereinbarte Laufzeitziele und Abbruch für große Bäume nachgewiesen. |
| 7 | Automatische Qualitätssicherung | Eine CI-Prüfung führt Tests auf Windows und Linux vor dem Paketbau aus; Browserfälle ergänzen die Quelltexttests. |

Der vorhandene Release-Workflow baut Pakete, führt aber keine JavaScript-Tests aus. Ein vorgeschalteter Prüfjob sollte die Suite, Bundle-Konsistenz, Katalogkonsistenz und nach Behebung die Review-Regressionsfälle enthalten. Der zusätzliche Audit liefert heute absichtlich Exitcode 1 und darf nicht kommentarlos als erfolgreiche Prüfung behandelt werden. Nach Korrekturen die gezielten Fälle in die regulären Tests übernehmen.

Für mitgelieferte Bibliotheken fehlt ein gemeinsames, maschinenlesbares Inventar mit Version, Herkunft, Hash und Sicherheitsstand. npm allein erfasst die Dateien unter `vendor/` nicht. Ein solches Inventar macht Aktualisierungen und einen gezielten Abgleich mit Herstelleradvisories nachvollziehbar. Die Dokumentation sollte außerdem den inzwischen implementierten Blob-Worker unter `file://` und die Node-Voraussetzung der Startskripte einheitlich beschreiben; der bisherige `BUGS.md`-Text zum Direktstart widersprach `ensureWorker` und `ARCHITECTURE.md`.

## Abgeleitete Erweiterungen

1. **Nachvollziehbarer Berechnungsstand:** Projektrevision, Solver-/Katalog-/Stoffdatenstand und Eingabehash im Ergebnis sowie in CSV/PDF speichern. Eine Änderung zeigt genau, welcher Teil neu berechnet werden muss. Das erweitert die Lösung von R02 um einen belastbaren Prüfpfad.
2. **Szenarien und Varianten vergleichen:** Betriebspunkte, Gleichzeitigkeit und manuelle Rohrvarianten als benannte Szenarien vergleichen, mit kritischem Pfad, Druckverlust, Geschwindigkeit und Materialdifferenz. Zunächst das vorhandene stationäre Modell verwenden und Szenarien klar von dynamischer Simulation unterscheiden.
3. **Importvorschau mit Fehlerliste:** Vor dem Öffnen Anzahl der Objekte, Datenversion, PDF-Status und konkrete ungültige Felder anzeigen. Reparaturvorschläge müssen eine Vorschau liefern; hydraulisch relevante Werte dürfen nicht still korrigiert werden.
4. **Kritischen Pfad sichtbar verfolgen:** Aus einer Warnung direkt zu betroffenen Kühlstellen und Vor-/Rücklauf- beziehungsweise SL-/FL-Abschnitten springen. Die im Solver vorhandenen Zuordnungen werden so prüfbar und R08 wird funktional weitergeführt.
5. **Unabhängige Referenzfallbibliothek:** Synthetische Fälle mit nachvollziehbaren Handrechnungen und getrennt belegten Stoffwerten aufbauen, einschließlich Gemischen, Höhen, Grenzpunkten und manuellen Rohrgrößen. Erwartete Werte und Toleranzen dürfen nicht automatisch aus demselben Solver übernommen werden.
6. **Mehrseitige PDF-Projekte:** Seitenwahl, seitenbezogene Kalibrierung und klarer Export der verwendeten Seite ergänzen. Dies folgt auf die Absicherung des PDF-Imports und benötigt eigene Geometrie-/Speicherprüfungen.

Pumpenkennlinien, hydraulischer Abgleich, Ringnetze und dynamische Teillast sind größere fachliche Erweiterungen. Sie benötigen zunächst ein definiertes Modell und Referenzfälle; sie lassen sich aus dem aktuellen Review nicht als kurzfristig freigegebene Funktionen ableiten.

## Reproduktion und verbleibende Prüflücken

Vom Repository-Verzeichnis aus:

```text
node --test --test-reporter=tap tests/*.test.mjs
node scripts/review-audit.mjs
node scripts/review-audit.mjs --stress
node scripts/benchmark-refrigerants.mjs --spots 1 --method both --json
node scripts/serve.mjs
```

`review-audit.mjs` benötigt keine zusätzlichen Pakete. Der normale Lauf enthält isolierte Tests echter Anwendungsfunktionen mit kontrollierten DOM-/Worker-/Speicherersatzobjekten sowie echte Solverläufe. Diese Ersatzobjekte erzwingen die beschriebenen Reihenfolgen; sie sind keine vollständige Browserintegration. Der HTTP-Test startet einen eigenen temporären Server und beendet ihn wieder. Die Stressoption begrenzt jeden Kindprozess auf 30 Sekunden. Die Testdaten entstehen im Speicher.

Folgende Prüfungen sind **nicht abgeschlossen**: native Tauri-Kompilierung und Installer, Linux-Laufzeit, Firefox/Safari und reale Mobilgeräte, echtes PWA-Offline-/Versionswechselverhalten, ein realer `file://`-Blob-Worker, vollständige PDF-Import-/Exportdarstellung mit mehreren oder gedrehten Seiten, unabhängiges Öffnen des im Browser heruntergeladenen ZIP/CSV sowie langfristige IndexedDB-Quota- und Mehrfenster-Tests. Rust/npm fehlen in der Prüfumgebung; für die Browser-/Downloadgrenzen siehe oben. Die vorhandenen Unit-/Vertragstests zu diesen Bereichen wurden trotzdem ausgeführt.

Die Herstellerquellen aller Stoff- und Rohrtabellen wurden nicht neu fachlich abgenommen. Der aktuelle Katalog ist intern konsistent und die geprüften Medienfälle sind numerisch plausibel; Normerfüllung, Werkstofffreigabe, globale Optimalität und die Richtigkeit beliebiger Anlagen folgen daraus nicht.
