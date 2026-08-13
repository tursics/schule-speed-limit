const fs = require('fs');
const path = require('path');

const query = `
[out:json][timeout:90];
area["name"="Berlin"]["admin_level"="4"]->.berlin;
(
    way["building"="school"](area.berlin);
    relation["building"="school"](area.berlin);
    node["building"="school"](area.berlin);
);
out geom;
`;

async function downloadOverpassData() {
    console.log('Download school data from OpenStreetMap...');

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
        const features = data.elements.map((element, i) => {
            const district = element.tags?.['addr:suburb'] || element.tags['addr:city'] || 'Berlin';
            const street = (element.tags?.['addr:street'] || '') + ' ' + (element.tags?.['addr:housenumber'] || '');
            const title = element.tags?.name || '';
            const city = element.tags?.['addr:city'] || '';
            const ref = element.tags?.['ref'] || '';
            const zip = element.tags?.['addr:postcode'] || '';
            const id = `${element.type}_${element.id}`;

            if (element.type === 'way' && element.geometry) {
                const polyCoords = element.geometry.map(point => [point.lon, point.lat]);

                // close polygone
                if (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || 
                    polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1]) {
                    polyCoords.push(polyCoords[0]);
                }

                const centerLon = polyCoords.reduce((sum, point) => sum + point[0], 0) / polyCoords.length;
                const centerLat = polyCoords.reduce((sum, point) => sum + point[1], 0) / polyCoords.length;

                return {
                    type: 'Feature',
                    properties: { title, ref, id, street, zip, city, district, center: [centerLon, centerLat] },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [polyCoords]
                    }
                };
            }

            if (element.type === 'node' && element.lon && element.lat) {
                return {
                    type: 'Feature',
                    properties: { title, ref, id, street, zip, city, district, center: [element.lon, element.lat] },
                    geometry: {
                        type: 'Point',
                        coordinates: [element.lon, element.lat]
                    }
                };
            }

            return null;
        }).filter(Boolean);

        const geojson = {
            type: 'FeatureCollection',
            name: 'School_Grounds',
            features: features
        };

        const dir = './data';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, 'osm-buildings.geojson');
        fs.writeFileSync(filePath, JSON.stringify(geojson, null, 2));

        console.log(`Done: ${features.length} school objects saved in '${filePath}'.`);
    } catch (error) {
        console.error('Fetch failed:', error.message);
        console.error(error);
    }
}

downloadOverpassData();