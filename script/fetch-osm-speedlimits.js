const fs = require('fs');
const path = require('path');

const query = `
[out:json][timeout:120];
area["name"="Berlin"]["admin_level"="4"]->.berlin;
(
  way["highway"~"primary|secondary|tertiary|residential|living_street|unclassified|service"](area.berlin);
);
out geom;
`;

function parseMaxspeed(tags) {
    // primary = Bundesstraße + Kreisstraße + Hauptstraße
    // primary_link ???
    // secondary = Landesstraßen + Kreisstraße + Durchgangsstraße
    // secondary_link ???
    // tertiary = Kreisstraße + Nebenstraße + Durchgangsstraße
    // tertiary_link ???
    // residential = Hauptstraße + Anliegerstraße
    // living_street = Verkehrsberuhigter Bereich / Wohnstraße
    // unclassified = Kreisstraße + Nebenstraße + Sonstige untergeordnete Straße + Hauptstraße + Durchgangsstraße + Anliegerstraße + Sonstige untergeordnete Straße
    // service = Erschließungsweg zu einzelnen Häusern + Zufahrtsweg
    // services ???
    const raw = tags.maxspeed;
    const zone1 = tags['maxspeed:type'];
    const zone2 = tags['source:maxspeed'];
    const zone3 = tags['zone:maxspeed'];
    const trafficSign = tags.traffic_sign;

    let zone = '';
    if (zone1 === 'DE:zone30') {
        zone = 30;
    } else if (zone1 === 'DE:zone20') {
        zone = 20;
    } else if (zone1 === 'DE:zone10') {
        zone = 10;
    }

    if (zone2 === 'DE:zone30') {
        zone = 30;
    } else if (zone2 === 'de:zone30') {
        zone = 30;
    } else if (zone2 === 'DE:zone:30') {
        zone = 30;
    } else if (zone2 === 'DE:zone20') {
        zone = 20;
    } else if (zone2 === 'DE:zone:20') {
        zone = 20;
    } else if (zone2 === 'DE:zone10') {
        zone = 10;
    }

    if (zone3 === 'DE:30') {
        zone = 30;
    } else if (zone3 === 'DE:20') {
        zone = 20;
    } else if (zone3 === 'DE:10') {
        zone = 10;
    }

    if (!raw) {
        if (tags.highway === 'living_street') {
            return 7;
        }
        if (tags.highway === 'service') {
            return 0;
        }
        if (tags.highway === 'services') {
            return 0;
        }
        if (tags.highway === 'unclassified') {
            return 0; // ?
        }

        return 50; 
    }

    if (raw === 'walk') {
        return 0;
    }

    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 50 : parsed;
}

async function downloadOverpassData() {
    console.log('Download road network and speed limit data from OpenStreetMap...');

    const bodyParams = new URLSearchParams();
    bodyParams.append('data', query);

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'SchoolSpeedLimitBot/1.0 (thomas@tursics.de)'
            },
            body: bodyParams
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        const features = data.elements
        .filter(element => (element.type === 'way') && element.geometry && (element.geometry.length > 1))
        .map((element, i) => {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Process way point ${i + 1} of ${data.elements.length}`);

            const coords = element.geometry.map(pt => [pt.lon, pt.lat]);
            const speed = parseMaxspeed(element.tags || {});

            return {
                type: 'Feature',
                properties: {
                    id: `${element.type}_${element.id}`,
                    title: element.tags?.name || '',
                    maxspeed: speed,
                    type: element.tags?.highway || 'road'
                },
                geometry: {
                    type: 'LineString',
                    coordinates: coords
                }
            };
        });
        console.log('');

        const geojson = {
            type: 'FeatureCollection',
            name: 'OSM_SpeedLimits',
            features: features
        };

        const dir = './data';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, 'osm-speedlimits.geojson');
        fs.writeFileSync(filePath, JSON.stringify(geojson, null, 2));

        console.log(`Done: ${features.length} way points saved in '${filePath}'.`);
    } catch (error) {
        console.error('Fetch failed:', error.message);
        console.error(error);
    }
}

downloadOverpassData();