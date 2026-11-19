# Änderungsprotokoll

# 1.0.6 — Kälteträger-Ergebnis- und Materialübersicht

- Gleichzeitigkeit und Kälteträgerfeld in der Betriebspunktmaske getauscht; Kälteträger-Rohrrauheit in die erweiterten Einstellungen verschoben.
- Frostschutzpunkt, summierter Auslegungsmassenstrom, Massenstrom je Vor-/Rücklaufstrecke und gesamtes Rohrinnenvolumen ergänzt; Glykolanteil wird bei Glykolgemischen ausgewiesen.
- Kälteträger-Materialliste um Armaflex-Schlauch, T-Stücke und Kugelhähne mit DN-/Zoll-Größenhinweisen ergänzt.
- Annahmen zu Innenvolumen und Nennweiten-Zuordnung in der Berechnungsanleitung dokumentiert.

# 1.0.5 — Wasser-Glykol-Kälteträgerkreise

- Separaten Kälteträgermodus für Wasser, Ethylen- und Propylenglykol-Wasser ergänzt, mit konzentrationsabhängigen CoolProp-Stoffwerten.
- Vor-/Rücklauf, Massen- und Volumenstrom, kritischen Kreisdruckverlust und Rohrgrößen je Rohrabschnitt dargestellt und exportiert.
- Viega Temponox sowie schwarzes Stahlrohr S195T nach EN 10255 M als Rohrserien dokumentiert und auswählbar gemacht.
- Gefrierpunktprüfung und sichtbare Hinweise zu Modellgrenzen, Inhibitoren und Werkstofffreigaben ergänzt.

## 1.0.4 — Erstes Desktop-Release

- Release-Automatisierung für Linux-AppImage und Windows-NSIS-Installer ergänzt.
- Beide Desktop-Artefakte werden bei einem passenden Versions-Tag gemeinsam als GitHub Release veröffentlicht.

## 1.0.3 — Tauri-Desktop-Verpackung

- Linux-AppImage für die lokale RohrRunner-Desktopanwendung ergänzt.
- Windows-NSIS-Build einschließlich Anwendungssymbol und WebView2-Bootstrapper vorbereitet.
- Desktop-Build dokumentiert und mit der bestehenden statischen Browser-/PWA-Anwendung verbunden.

## 1.0.2 — PWA, Startskripte und Dokumentation

- RohrRunner kann als PWA installiert und nach dem ersten Cache-Aufbau offline genutzt werden.
- Windows- und Linux-Startskripte starten den lokalen Server und öffnen die Anwendung im Standardbrowser.
- Berechnungsdokumentation in `PLAN.md` umbenannt und veraltete Screenshots entfernt.
- Lokale PDF-Bibliotheken und die PWA-Nutzung in der Dokumentation klargestellt.

## 1.0.1 — Projektdateien als ZIP sichern

- Die Schaltfläche „Sichern“ erstellt ein ZIP-Paket mit `.rohrrunner`, verfügbaren Berechnungs- und Material-CSV sowie Original-Grundriss und exportiertem Plan-PDF.
- ZIP-Erstellung erfolgt lokal ohne zusätzliche Bibliothek.
- ZIP-Erzeugung und Unicode-Dateinamen mit Tests abgesichert.

## 1.0.0 — Erste stabile Funktionsfassung

- Funktionsumfang und fachliche Grenzen für den stabilen Release dokumentiert; unterstützt werden stationäre einphasige Saug-/Flüssigkeitsleitungen in zusammenhängenden Baum-Netzen sowie die vorhandenen Kältemittelmodi.
- Release-Hinweise unterscheiden bestätigten manuellen Browser-Test, fehlende systematische Browser-/Betriebssystemmatrix und noch ausstehende unabhängige Berechnungsverifikation.
- Versionsanzeigen, Beitragshinweise und veraltete Versionsbeispiele aktualisiert. RohrRunner erhält mit diesem Release keine neue Projektlizenz; die MIT-Lizenz gilt ausschließlich für die mitgelieferte CoolProp-Laufzeit.
- Eine Ergebnislisten-Hilfsfunktion umgeordnet, damit der vorhandene Warnungszuordnungstest wieder ausführbar ist; Berechnungslogik unverändert.

## 0.2.20 — Release-Aufbereitung und CSV-Projektkopf

- CSV-Export um kompakte Projektinformationen und Vorgabewerte in zweispaltiger Darstellung ergänzt; erweiterte interne Angaben werden nicht ausgegeben.
- Ergebnisansicht und CSV verwenden dieselbe Reihenfolge der Rohrstrecken von den Kühlstellen über die T-Stücke bis zum Verbund.
- README für den aktuellen Funktionsumfang, CSV-Export, Schnellstart und fachliche Grenzen neu strukturiert.
- GitHub-Verknüpfung und Meep-meep-Wortmarke in der Oberfläche vereinheitlicht.

## 0.2.19 — Aussagekräftiger Berechnungs-CSV-Export

- Berechnungs-CSV um Rohrstrecke, getrennte SL-/FL-Dimensionen, berechnete Temperaturen, Druckverluste, Geschwindigkeiten und Leistung ergänzt.
- Zahlenwerte werden einheitlich mit zwei Nachkommastellen und Einheiten im jeweiligen Feld ausgegeben.

## 0.2.18 — Materialliste exportieren

- Materialliste in der rechten Seitenleiste ergänzt: Rohrlängen und T-Stücke werden jeweils leitungsübergreifend summiert; Armaflex-Schlauch wird nach Saugleitung und Flüssigkeitsleitung anhand des Rohr-Außendurchmessers gruppiert.
- Anschlussgrößen von T-Stücken und Kugelabsperrventile je Kühlstellenanschluss werden gruppiert angezeigt; Materialgruppen sind einzeln einklappbar.
- Materialliste als CSV exportierbar; Herstellerdaten werden nicht ausgegeben.

## 0.2.17 — GitHub-README mit Einblicken

- README für GitHub neu gestaltet: Schnellstart, Bedienung, Auslegung, Datenhaltung, technische Grenzen und Entwicklerhinweise übersichtlich dokumentiert.
- Zwei Screenshots eines beispielhaften Netzes und der Startansicht ergänzt; Bilddateien im Repository verlinkt.

## 0.2.16 — Bedienung im Editor verbessert

- Rohrleitungen besitzen einen breiteren unsichtbaren Klickbereich, ohne die sichtbare Linienbreite zu ändern.
- Rohrgrößen-Dropdowns in der Ergebnisliste verwenden den dunklen Standardhintergrund.
- Eingabefelder in der Kühlstellenliste wählen beim Bearbeiten die Kühlstelle nicht mehr aus.

## 0.2.15 — Warnungen gezielt zuordnen

- Sauggasgeschwindigkeitsüberschreitungen werden nur einmal je betroffener Rohrstrecke gemeldet; markiert werden die Strecke und die in den entsprechenden Lastfällen durchströmten Kühlstellen statt unbeteiligter Lastfall-Kühlstellen.
- Phasenrisiken markieren die betroffenen Flüssigkeitsabschnitte. Summierte Endpunkt-Druckverluste markieren die Kühlstelle; nur individuell grenzverletzende Abschnitte erhalten eine Streckenmarkierung.
- Alte gespeicherte Ergebnisse ohne eindeutige Warnungszuordnung werden nicht als aktuelle Ergebnisse wiederhergestellt.

## 0.2.14 — Rohrgröße im Ergebnis gezielt nachrechnen

- Änderungen an einer Rohrgröße in der Ergebnisliste lösen eine Nachrechnung mit den zuletzt berechneten Größen aller anderen SL- und FL-Leitungen aus; deren Auto-/Manuell-Modus im Projekt bleibt erhalten.
- Druckverluste, Stoffzustände und Warnungen werden neu berechnet. Der Knopf „Netz berechnen“ führt weiterhin eine vollständige automatische Neuauslegung aus.

## 0.2.13 — Metrischen Rohrkatalog bereinigt

- 35 × 1 mm und 54 × 2 mm aus dem metrischen Rohrkatalog entfernt; Browser- und Worker-Katalog synchronisiert.
- 88,9 × 2 mm war bereits enthalten (Wieland 2026, gedruckte Seite 14, 26 bar bei 100 °C und Sicherheitsfaktor 3). Die Größe bleibt wegen der Druckfilterung beim Standard-Auslegungsdruck von 28 bar nicht auswählbar; Katalogdruck und Druckfilter wurden nicht verändert.

## 0.2.12 — Fließrichtung unabhängig von der Zeichenrichtung geprüft

- Der Solver liefert bei umgedrehten Kanten und vertauschter Zeichenreihenfolge dieselben SL-/FL-Druckverluste, auch mit Höhendifferenzen: FL vom Verbund weg, SL zum Verbund hin.
- Ergebniswarnungen folgen jetzt ebenfalls dem tatsächlichen Baum statt `edge.from`/`edge.to`. Leitungsnamen zeigen keine irreführende einzelne Fließrichtung mehr an.
- Den unbenutzten Richtungsparameter der Rohrintegration entfernt; die Berechnungsrichtung bleibt durch die Druckrandbedingungen bestimmt.

## 0.2.11 — Abhängigkeiten bei Rohränderungen geprüft

- Die Auswirkungen einer manuellen Saugrohränderung auf Massenstrom, Flüssigkeitsverlust und gemeinsame Stammleitungen mit synthetischen Lastfällen geprüft; ein unbelasteter Seitenast bleibt unverändert.
- Die fachliche Kopplung und die erneute automatische Auslegung des Gesamtnetzes in der Berechnungsanleitung erläutert. Das Berechnungsmodell wurde nicht verändert.

## 0.2.10 — Verlust- und Geschwindigkeitsbezeichnungen präzisiert

- Die Berechnungsansicht bezeichnet die Grenzwerte als „Druckverlust SL max.“, „Druckverlust FL max.“ und „Sauggasgeschwindigkeit max.“.
- Validierungs- und Ergebniswarnungen verwenden dieselben Begriffe; die Druckverlustwerte in K bleiben Sättigungstemperaturdifferenzen, nicht Druckdifferenzen in bar.

## 0.2.9 — Phasengrenze bei R744 ohne Stoffwertfehler behandeln

- Bei erschöpfter Flüssigkeitsunterkühlung werden PT-Stoffwerte nicht mehr exakt am Sättigungsdruck angefordert; betroffene Endpunktpfade zeigen stattdessen 0 K verbleibende Unterkühlung und ein Phasenrisiko.
- Ein synthetischer R744-Test prüft den Grenzfall mit 2 K und das Verhalten bei 3 K Unterkühlung. Die Grenze der stationären Einphasenrechnung bleibt bestehen.

## 0.2.8 — Kältemittelspezifische Berechnungsvorgaben

- R448A und R513A starten mit 25 K Überhitzung, 2 K Unterkühlung, 1 K Flüssigkeitsverlustgrenze und 28 bar Auslegungsdruck.
- R744 verwendet ebenfalls 25 K, 2 K und 1 K; seine Verflüssigung startet bei 5 °C, der Auslegungsdruck bleibt bei 100 bar.
- Beim Kältemittelwechsel und Zurücksetzen gelten die jeweiligen Vorgaben; gespeicherte Projekte behalten ihre eigenen Werte.

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
