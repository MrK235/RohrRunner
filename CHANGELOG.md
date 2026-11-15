# Änderungsprotokoll

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
