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
    const raw = tags.maxspeed;

    if (!raw) {
        if (tags.highway === 'living_street') {
            return 7;
        }

        return 50; 
    }

    if (raw === 'walk' || raw === 'DE:living_street') {
        return 7;
    }
    if (raw === 'DE:zone30') {
        return 30;
    }
    if (raw === 'DE:innerurban') {
        return 50;
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