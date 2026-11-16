# Änderungsprotokoll

## 0.2.7 — Projektdatei direkt herunterladen

- „Sichern“ startet den Download der `.rohrrunner`-Projektdatei direkt, ohne vorgeschalteten In-App- oder Dateiauswahldialog.
- Der nicht mehr benötigte Speicherdialog wurde entfernt. Die Download-Einstellungen des Browsers bestimmen weiterhin den Speicherort.

## 0.2.6 — Projektaktionen in der Anwendung bestätigen

- Neues Projekt und dauerhaftes Löschen gespeicherter Projekte werden statt mit Browser-Bestätigungen über einen In-App-Dialog bestätigt.
- Projekte lassen sich direkt in der Projektliste umbenennen, ohne Browser-Eingabedialog.
- Die Schaltfläche „Neu“ öffnet die Bestätigung jetzt auch beim Klick in der Kopfzeile.

## 0.2.5 — Weitere Stoffwert-Umschaltgrenzen geprüft

- Den Interpolationsbereich für R448A und R513A bei Verdampfung, Verflüssigung, Unterkühlung und Saugverlustgrenze erweitert; R448A bleibt auf höchstens 50 °C Flüssigkeitstemperatur begrenzt.
- Synthetische Vergleiche unmittelbar außerhalb der bisherigen Grenzen prüfen Ergebnisabweichung und direkte CoolProp-Aufrufe. Außerhalb der neuen Bereiche bleibt der sichere Rückfall auf CoolProp erhalten.

## 0.2.4 — Berechnung bei hoher Sauggasüberhitzung beschleunigt

- R448A und R513A nutzen die Stoffwert-Stützpunkttabellen jetzt auch bei 25 K Sauggasüberhitzung (bis 40 K), statt für jeden Rohrschritt CoolProp direkt aufzurufen.
- Ein abschließender Endpunkt-Lastfall wird nicht erneut berechnet, wenn seit der letzten Auswertung keine Rohrgröße geändert wurde.
- Ein synthetischer Referenztest prüft die Abweichung der Ergebniswerte und die Anzahl direkter Stoffwertaufrufe.

## 0.2.3 — Projektstart und Auswahl überarbeitet

- Beim Start erscheint eine kompakte Projektauswahl mit Aktionen zum Öffnen gespeicherter Projekte, Anlegen eines leeren Projekts oder Laden eines PDF-Grundrisses.
- PDF-Dateien lassen sich auf die Startansicht ziehen. Über das Markenlogo kann jederzeit zur Projektauswahl zurückgekehrt werden.
- Gespeicherte Projekte werden beim Start nicht mehr automatisch geöffnet; sie bleiben lokal gespeichert und können über „Projekte“ ausgewählt werden.

## 0.2.2 — Steigleitungsprüfung und Bedienoberfläche

- Die Steigleitungsprüfung verwendet standardmäßig 7 m/s; Werte darunter werden geprüft und Werte unter 5 m/s als kritisch markiert. Hinweise und farbliche Markierung betreffen nur die markierte Kühlstelle und ihre zugehörige Rohrstrecke.
- Berechnungsergebnisse werden lokal im Projekt gespeichert und bei unverändertem Netz wiederhergestellt. Neue leere Projekte werden erst nach dem ersten gezeichneten Knoten gespeichert.
- Kühlstellenfelder reagieren auf das Mausrad erst nach einem Klick. Ergebnisanzeige, Projektstatus und Werkzeugsymbole wurden überarbeitet.

## 0.2.1 — Berechnungsansicht und Kühlstellenliste überarbeitet

- Der Berechnungsstart steht oben; selten benötigte Parameter sind eingeklappt. Der Status im Kopfbereich zeigt laufende Berechnungen und ihre Dauer.
- Rohrstrecken und Kühlstellen sind im Ergebnis einzeln einklappbar. Spalten, Schrift und Eingabefelder wurden lesbarer und einheitlicher gestaltet.
- Die Kühlstellenliste zeigt kompakte, auswählbare Karten mit Leistung, zusätzlicher Rohrleitung, Steigleitungskennzeichen und Gesamtlänge. Die Zusatzlänge und das Kennzeichen fließen in die hydraulische Berechnung beziehungsweise die Mindestgeschwindigkeitsprüfung ein.
- Lange Projekt- und PDF-Namen bleiben ohne Überdeckung der Bedienelemente zugänglich. Überflüssige Pfeilsymbole und der zusätzliche Kühlstellenknopf wurden entfernt.

## 0.2.0 — Kühlstellenpfad bis zum Verbund markieren

- Die orange Markierung des Leitungswegs berücksichtigt die Verbindungsrichtung nicht mehr und zeigt für jede ausgewählte Kühlstelle den vollständigen Pfad bis zum Verbund.

## 0.1.46 — Beschriftungen ohne PDF weiß darstellen

- Ohne geladene PDF werden Netzwerkbeschriftungen ebenfalls weiß mit dunkler Kontur gezeigt.

## 0.1.45 — Beschriftungen außerhalb des PDF aufhellen

- Netzwerkbeschriftungen außerhalb der PDF-Fläche werden weiß mit dunkler Kontur dargestellt; Beschriftungen auf dem PDF bleiben unverändert.

## 0.1.44 — Berechnungsreiter nach Auslegungsreset öffnen

- Nach „Auslegung zurücksetzen“ wird der Reiter „Berechnung“ angezeigt.

## 0.1.43 — Auslegung an Grenzwerten ausrichten

- Automatische Rohr-Upgrades sind nicht mehr auf acht Schritte begrenzt; die Schrittweite verringert sich nahe an den Vorgaben.
- Synthetische Solvertests mit 2, 5 und 10 Kühlstellen prüfen Grenzwerte, Ausnutzung und Laufzeit.
- Standard-Maximalgeschwindigkeit auf 30 m/s gesetzt und Mindestgeschwindigkeit standardmäßig deaktiviert.

## 0.1.42 — Ergebnistab nach Auslegungsreset beibehalten

- Nach „Auslegung zurücksetzen“ bleibt der Ergebnisreiter aktiv.

## 0.1.41 — Auswahlstreifen bei Kühlstellen erhalten

- Ausgewählte gelbe oder rote Kühlstellen zeigen zusätzlich zur schmalen Kontur wieder den dicken orangefarbenen linken Streifen.

## 0.1.40 — Zustandsmarkierung der Kühlstellen vereinheitlichen

- Gelbe und rote Kühlstellen erhalten keinen dicken linken Streifen mehr; eine ausgewählte Kühlstelle behält eine schmale umlaufende Kontur.

## 0.1.39 — Rohrabschnitte vollständig anklickbar

- Der gesamte Rohrabschnitt lässt sich zur Auswahl anklicken; Rohrgrößen-Dropdowns behalten ihre eigene Bedienung.
- Die Hover-Rückmeldung umfasst den ganzen Abschnitt, und die Überschrift bleibt neutral gefärbt.

## 0.1.38 — Kühlstellenauswahl einheitlich markieren

- Ausgewählte Kühlstellenzeilen und Knoten werden wie ausgewählte Rohrabschnitte mit einer orangefarbenen linken Kante hervorgehoben.

## 0.1.37 — Plan und Messergebnis verknüpfen

- Die Auswahl einer Rohrstrecke markiert den zugehörigen Messergebnisabschnitt.
- Die Auswahl im Messergebnis markiert die zugehörige Rohrstrecke im Plan.

## 0.1.36 — Auswahlpfade orange markieren

- Beim Auswählen einer Kühlstelle wird ihr Rohrweg bis zum Anlagenstart orange dargestellt.
- Eine ausgewählte Rohrstrecke wird ebenfalls orange hervorgehoben.

## 0.1.35 — ΔT FL ausgerichtet

- Überschrift und Werte der Spalte ΔT FL um zwei Zeichenbreiten nach rechts gerückt.

## 0.1.34 — Rohrgrößen sofort neu berechnen

- Eine geänderte Rohrgröße im Leitungseditor oder in der Ergebnistabelle löst direkt eine Neuberechnung aus.

## 0.1.33 — Abstand vor ΔT SL

- SL- und FL-Auswahl samt Überschriften leicht nach links verschoben, damit mehr Abstand zu ΔT SL bleibt.

## 0.1.32 — Geschwindigkeiten und Statushinweise

- SL- und FL-Geschwindigkeit stets in getrennten Zeilen dargestellt.
- „SL prüfen“ und „FL prüfen“ unter den Rohrgrößen entfernt.

## 0.1.31 — Erste Ergebnisspalten ausgerichtet

- Länge, Kühlstellenname und ihre Überschriften auf eine gemeinsame linke Flucht gesetzt.

## 0.1.30 — Ergebnisspalten ohne Überlauf

- SL-/FL-Dropdowns um etwa vier Zeichenbreiten verkürzt.
- Spalten für Länge, Temperaturverluste und Geschwindigkeit innerhalb der Seitenleiste neu verteilt.

## 0.1.29 — Rohrdimensionen erhalten Platz

- Längenwerte unter der zentrierten Spaltenüberschrift ausgerichtet.
- SL-/FL-Auswahlfelder verbreitert und Spaltenbreiten dafür angepasst.

## 0.1.28 — Punkte entfernt und Spalten ausgerichtet

- Statuspunkte am Anfang von Rohr- und Kühlstellenkarten entfernt.
- Überschriften und Werte einheitlich eingerückt; Ergebnisspalten gleichmäßig verteilt.
- Rohrgrößenfelder vertikal zentriert und auf Zeilenhöhe abgestimmt.

## 0.1.27 — Geschwindigkeitsüberschrift vereinheitlicht

- Spaltenüberschrift zeigt `m/s`; die zusätzliche Einheit unter den Geschwindigkeitswerten entfällt.

## 0.1.26 — Ergebnisfelder dichter ausrichten

- Leerraum unter den Rohrkartenüberschriften reduziert.
- SL- und FL-Felder direkt nebeneinander angeordnet; restliche Spalten gleichmäßig verteilt.

## 0.1.25 — Länge und Abschnittsüberschrift

- „Von → nach“ in die Überschrift jeder Rohrstreckenkarte verschoben.
- Erste Ergebnisspalte zeigt die Länge; Rohrgrößenfelder sind um etwa vier Zeichenbreiten schmaler.

## 0.1.24 — Rohrgrößenfelder lesbar dimensioniert

- Rohrgrößenfelder verkleinert und Schrift vergrößert.
- Tabellenbreite neu verteilt, damit Rohrnamen, Temperaturverluste und Geschwindigkeiten nebeneinander Platz haben.

## 0.1.23 — Kühlstellenstatus abstufen

- Nicht eingehaltene Auslegungsgrenzen an Kühlstellen orange markiert.
- Rot bleibt kritischen Phasengrenzen vorbehalten.

## 0.1.22 — Ergebnisdarstellung vereinheitlicht

- Kühlstellen im Kartenstil der Rohrstrecken angeordnet.
- Rohrgrößenauswahl verbreitert, damit Dimensionen vollständig lesbar sind.

## 0.1.21 — Schlichte Geschwindigkeit und Kühlstellenstatus

- Geschwindigkeiten im Ergebnis ohne farbige SL-/FL-Abzeichen dargestellt.
- Kühlstellenzeilen und betroffene Endpunktwerte bei Grenzverletzungen farblich hervorgehoben.
- Spaltenüberschriften der Kühlstellenliste verkürzt und ausführlich erläutert.

## 0.1.20 — Auto-Dimension als ausgewählter Eintrag

- Die automatisch berechnete Dimension wird im Auswahlfeld selbst als `22x1mm (auto)` angezeigt.
- Der separate Eintrag „Automatisch“ entfällt nach der Berechnung; vor dem ersten Ergebnis bleibt er als Auswahl verfügbar.

## 0.1.19 — Automatisch berechnete Rohrgröße markieren

- Im Größenmenü bleibt „Automatisch“ der erste Eintrag; die berechnete Größe ist unter den Dimensionen mit `(auto)` markiert.
- Die ursprüngliche Auto-Dimension bleibt nach einer manuellen Größenwahl am Abschnitt gespeichert und erkennbar.

## 0.1.18 — Kompakte Rohrdimensionen

- Rohrgrößen-Auswahlliste zeigt Außendurchmesser × Wandstärke kompakt, etwa `10x1mm`.
- Automatisch gewählte Dimension wird im ersten Eintrag als `10x1mm (auto)` ausgewiesen.

## 0.1.17 — Prüfhinweis im Rohrgrößenfeld

- SL-/FL-Prüfhinweis direkt unter der jeweiligen Rohrgröße platziert.
- Feld- und Zeilenhöhe bleiben dafür fest; separate Statuszeilen entfallen.

## 0.1.16 — Statusfarben und automatische Dimension

- Normale Rohrabschnitte neutral dargestellt; orange und rot sind Auffälligkeiten und Grenzverletzungen vorbehalten.
- Automatische Rohrgröße im ersten Auswahlfeld-Eintrag mit der gewählten Dimension gekennzeichnet.

## 0.1.15 — Kühlstellenwerte in Ergebnissen

- Tatsächliche Verdampfungstemperatur und vorgegebene Kühlstellenleistung bis zur Ergebnisliste durchgereicht.
- Endpunkt-Verdampfungstemperatur in der Liste mit zwei Nachkommastellen angezeigt.
- Tests ergänzen Prüfungen für Endpunkt-Temperatur und Leistungsvorgabe.

## 0.1.14 — Druckargument bei Verdampfungstemperatur

- Kältemittelkennung beim Ermitteln der Endpunkt-Verdampfungstemperatur an den Stoffdatenaufruf übergeben.

## 0.1.13 — Gruppierte Ergebnisliste

- SL- und FL-Ergebnisse je Rohrabschnitt tabellarisch zusammengefasst; Rohrgrößen sind direkt änderbar.
- Kühlstellenliste um Verdampfungstemperatur und Leistung erweitert und um Temperaturverluste sowie Unterkühlung gruppiert.
- Rohrabschnitte nach Berechnungsstatus farblich markiert.

## 0.1.12 — Rohrmaße im PDF am längsten Segment

- Längen und Dimensionen werden am längsten Segment der Rohrleitung platziert.
- Zu kurze Segmente erhalten keine Beschriftung, wenn der Leitung kein ausreichend langes Segment zur Verfügung steht.

## 0.1.11 — Worker direkt aus `file://` starten

- Worker-Code einschließlich Rechenkern und CoolProp wird als Blob-Worker gebündelt und direkt aus dem Browser gestartet.
- `RohrRunner.bat` öffnet wieder die HTML-Datei; lokaler Server und Node.js sind für den Worker nicht nötig.
- Bundle-Generator und Build-Befehl für spätere Änderungen am Worker ergänzt.

## 0.1.10 — Worker-Start ohne Node.js

- `RohrRunner.bat` startet nun einen lokalen PowerShell-Server auf `127.0.0.1`, damit Browser den Berechnungs-Worker ausführen können.
- Direkter `file://`-Start bleibt verfügbar und verwendet den Hauptthread-Fallback.

## 0.1.9 — Projektverwaltung und PDF-Autospeicherung

- Projekte über einen neuen Dialog öffnen, umbenennen und löschen.
- Projekte und PDF-Grundrisse gemeinsam in IndexedDB speichern und beim Start wiederherstellen.
- PDF-Dateinamen als vorgeschlagene Projektnamen übernehmen und vorhandene Autosaves migrieren.

## 0.1.8 — PDF-Leiste über Werkzeugleiste

- PDF-Steuerleiste über die linke Werkzeugleiste und die Planansicht erweitert.
- Auswahl-, Start- und Lastenwerkzeuge beginnen nun unter der PDF-Steuerleiste.

## 0.1.7 — Maßstab-Livevorschau

- Kalibrierungslinie folgt dem Mauszeiger nach dem ersten gesetzten Punkt.

## 0.1.6 — Einheitlicher Hintergrund

- Hintergrund der Seitenleisten-Reiter an die benachbarte PDF-Steuerleiste angeglichen.

## 0.1.5 — Kopfzeilenstatus

- Überschrift über den Seitenleisten-Reitern entfernt.
- Berechnungsstatus in die obere Kopfzeile verschoben.

## 0.1.4 — Seitenleisten-Reiter

- Seitenleiste in die Reiter Kühlstellen, Berechnung und Ergebnis gegliedert.
- Leitungsdaten einschließlich Zusatzlänge und Steigeleitung im Kühlstellen-Reiter gebündelt.
- Nach erfolgreicher Berechnung wird die Ergebnisliste automatisch angezeigt.

## 0.1.3 — Arbeitsregeln für Codex

- AGENTS.md dokumentiert Patch-Versionierung, synchronisierte Versionsstellen, Änderungsprotokoll und Commit-Regeln sowie fachliche Projektkonventionen.

## 0.1.2 — Auswahlwerkzeug

- Auswahl und Verschieben ist das Standardwerkzeug beim Start; das Symbol zeigt eine Hand.
- Nach dem Klick auf Netz berechnen wird das Auswahlwerkzeug aktiviert.

Bemerkenswerte Änderungen des Projekts nach Version. Jede abgeschlossene Änderung, Fehlerkorrektur, Verbesserung und Erweiterung erhält den kleinstmöglichen Versionssprung: eine Patch-Erhöhung. Minor- und Major-Sprünge erfolgen nur auf ausdrückliche Aufforderung. Dokumentationsänderungen folgen derselben Regel.

## 0.1.1 — Versionsregel und Dokumentation

- Versionspolitik dokumentiert: Änderungen werden mit Patchsprung, Commit und Push ausgeliefert; Minor-/Major-Sprünge nur auf Aufforderung.
- README, Berechnungsmodell, Architektur-, Fehler-, Sicherheits- und Mitwirkungsdokumentation auf den implementierten Stand abgestimmt.
- Versionsmetadaten und Anzeige auf 0.1.1 aktualisiert; keine Änderung am Berechnungsverhalten.

## 0.1.0 — Ausgangsstand

- Lokale Browseroberfläche zur grafischen Erfassung verzweigter Rohrnetze auf PDF-Grundrissen.
- Maßstabskalibrierung, orthogonales Zeichnen, automatische Abzweige, Verschieben sowie Undo/Redo.
- Vorbemessung von Saug- und Flüssigkeitsleitungen für R513A, R448A und unterkritisches R744.
- CoolProp 8.0.0 WebAssembly und lokaler Katalog für metrische Kupferrohre sowie zöllige K65-Rohre.
- Projektimport/-export, CSV-Ergebnisse und Plan-PDF-Export.
- Node.js-Tests für Stoff-/Netzberechnung, Geometrie, UI-Verträge und Exportpfade.
