# schule-speed-limit
Welche Höchstgeschwindigkeit gilt vor der Schule?

## Rechtsgrundlage

Im [Steckbrief Tempo 30](https://www.adfc.de/artikel/stvo-novelle-tempo-30) vom ADFC wird erwähnt, wo Tempo 30-Zonen eingerichtet werden können, bei "hochfrequentierten Schulwegen, allgemeinbildenden Schulen, Förderschulen".

Berlin hat 2025 einige [Tempo 30 auf vielen Hauptstraßen aufgehoben](https://www.berlin.de/aktuelles/9725326-958090-tempo-30-koennte-auf-vielen-hauptstrasse.html) die vorher wegen Luftreinhaltegründen eingerichtet worden waren.

Zur Auszeichnung wird [Zeichen 274 StVO](https://de.wikipedia.org/wiki/Bildtafel_der_Verkehrszeichen_in_der_Bundesrepublik_Deutschland_seit_2017#Geschwindigkeitsbeschr%C3%A4nkungen_und_%C3%9Cberholverbote) verwendet.

## Daten finden

### Liste aller Schulen in Berlin

* Liste auf der Webseite der Senatsverwaltung für Bildung, Jugend und Familie: [Schul­verzeichnis](https://www.bildung.berlin.de/Schulverzeichnis/)
  * Schuljahr 2026/27
  * Bezirk (Mitte, Friedrichshain-Kreuzberg, ...)
  * Schulart (Grundschule, Berufsschule, ...)
  * Titel
  * Schul-Nummer
  * Adresse
* Liste auf dem Geoportal
* Liste auf OSM
  * Mit Overpass API kann man mit der Kategorie `amenity=school` und `entrance=main` (Haupteingang) oder `entrance=yes` die genauen Eingänge an den Grundstücksgrenzen filtern.
* Liste der Filialen ?
* Umrisse der Schulgelände

### Tempobeschränkungen

Eine Erklärung zu den [Tempobeschränkungen](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/verkehrspolitik/tempobeschraenkungen/) in Berlin sind auf der Seite der Senatsverwaltung für Mobilität. Verkehr, Klimaschutz und Umwelt beschrieben. Es gibt Tempo 30 aus Verkehrssicherheitsgründen, Lärmschutzgründen und Luftreinhaltegründen.

* [Karte Tempolimits im Geoportal Berlin](https://gdi.berlin.de/viewer/main/?MAPS={%22center%22:%5B389920,5819697%5D,%22zoom%22:2}&LAYERS=%5B{%22id%22:%22hintergrund_default_grau%22,%22visibility%22:true,%22transparency%22:0},{%22id%22:%22tempolimits:strassenabschnitte%22,%22visibility%22:true,%22transparency%22:0},{%22id%22:%22tempolimits:hoechstgeschwindigkeit%22,%22visibility%22:true,%22transparency%22:0}%5D)
  * Straßenabschnitt
  * Geschwindigkeit (5, 10, 20, 30, ...)
  * Zeitliche Einschränkung ("07:00 - 18:00", ...)
  * Wochentag ("Montag bis Freitag", ...)
  * Grund ("angeordnete Verkehrseinschränkung", "Schulwegsicherung", ...)
  * Gültigkeit ("Zeitangabe", ...)
* Karte auf OSM

### Straßenklassifizierung

Die Straßenklassifizierung erfolgt gemäß StEP (Stadtentwicklungsplan Verkehr). Hier können Hauptverkehrsstraßen erkannt werden.

* [Karte Detailnetz Berlin im Geoportal Berlin](https://gdi.berlin.de/viewer/main/?LAYERS=[{%22id%22:%22hintergrund_default_grau%22},{%22id%22:%22detailnetz:c_strassenabschnitte%22},{%22id%22:%22detailnetz:b_bauwerke%22},{%22id%22:%22detailnetz:a_verbindungspunkte%22}])
  * Straßenabschnitt
  * Straßenname
  * StEP Klasse (I, II, III, IV, ...)
* OSM ?

## Daten herunterladen

Ich habe ein paar Skripte vorbereitet. Einfach in einer Bash folgende Befehle eingeben:

```
node script/fetch-osm-grounds.js
node script/fetch-osm-buildings.js
```

Die Daten werden im Ordner `data` abgelegt. Um eine schnelle Vorschau der .geojson-Dateien zu bekommen kann man den Online-Dienst [geojson.io](https://geojson.io/) nutzen.
