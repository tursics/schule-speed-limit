const fs = require('fs');
const path = require('path');

const LIMIT_RANGE_ALL = 'ALL';             // 06:00 - 18:00
const LIMIT_RANGE_MORNING = 'MORNING';     // 06:00 - 08:00
const LIMIT_RANGE_AFTERNOON = 'AFTERNOON'; // 13:30 - 18:00
const LIMIT_RANGE_PARTLY = 'PARTLY';       // 08:00 - 16:00
const LIMIT_RANGE_POOR = 'POOR';           // >06:00 - <18:00

const query = `
[out:json][timeout:120];
area["name"="Berlin"]["admin_level"="4"]->.berlin;
(
  way["highway"~"primary|secondary|tertiary|residential|living_street|unclassified|service"](area.berlin);
);
out geom;
`;

function parseConditionalSpeed(conditionalTag) {
    if (conditionalTag) {
        const parts = conditionalTag.split('@');
        const speed = parts[0];

        if (speed !== null) {
            const speedValue = parseInt(speed.trim(), 10);
            let text = parts[1] ? parts[1].trim().replace(/[()]/g, '').trim().toLowerCase() : '';

            if (text.startsWith('mo-fr ') || text.startsWith('mo-su ')) {
                text = text.substr(6);
            } else if (text.startsWith('mo - fr ')) {
                text = text.substr(8);
            } else if (text.startsWith('sa,su,ph')) {
                // ignore Saturday, Sunday and Public Holiday
                return null;
            } else if (('wet' === text) || ('wet,snow' === text)) {
                // ignore the weather
                return null;
            }

            if ((9 <= text.length) && (text.length <= 13)) {
                const times = text.split('-');
                const startHour = parseInt(times[0].split(':')[0], 10);
                const startMinute = parseInt(times[0].split(':')[1], 10);
                const endHour = parseInt(times[1].split(':')[0], 10);
                const endMinute = parseInt(times[1].split(':')[1], 10);
                const start = startHour + startMinute / 60;
                const end = endHour + endMinute / 60;
                const isoTime = ('0' + startHour).slice(-2) + ':' + ('0' + startMinute).slice(-2) + '-' + ('0' + endHour).slice(-2) + ':' + ('0' + endMinute).slice(-2)

                if ((18 <= start) && (start < 24) && (6 <= end)) {
                    // ignore the night
                    return null;
                }

                if ((start <= 6) && (18 <= end)) {
                    return {
                        range: LIMIT_RANGE_ALL,
                        speed: speedValue,
                        text: isoTime
                    };
                }
                if ((start <= 6) && (8 <= end)) {
                    return {
                        range: LIMIT_RANGE_MORNING,
                        speed: speedValue,
                        text: isoTime
                    };
                }
                if ((start <= 13.5) && (18 <= end)) {
                    return {
                        range: LIMIT_RANGE_AFTERNOON,
                        speed: speedValue,
                        text: isoTime
                    };
                }
                if ((start <= 8) && (16 <= end)) {
                    return {
                        range: LIMIT_RANGE_PARTLY,
                        speed: speedValue,
                        text: isoTime
                    };
                }
                if ((6 <= start) && (end <= 18)) {
                    return {
                        range: LIMIT_RANGE_POOR,
                        speed: speedValue,
                        text: isoTime
                    };
                }
            }
        }
    }

    return null;
}

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
    const conditional = parseConditionalSpeed(tags['maxspeed:conditional']);
    let maxspeed = tags.maxspeed || tags['zone:maxspeed'] || tags['maxspeed:type'] || tags['source:maxspeed'];

    if (!maxspeed) {
        // undefined
    } else if (typeof maxspeed === 'number') {
        // maxspeed
    } else {
        maxspeed = String(maxspeed).trim().toLowerCase();

        if (maxspeed === 'de:urban') {
            maxspeed = '50';
        } else if ((maxspeed === 'de:walk') || (maxspeed === 'walk')) {
            maxspeed = '7';
        }

        const match = maxspeed.match(/\d+/);
        maxspeed = match ? parseInt(match[0], 10) : undefined;
    }

    if (!maxspeed) {
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

    return {
        maxspeed,
        conditional
    };
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
                    maxspeed: speed.maxspeed,
                    conditional: speed.conditional,
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