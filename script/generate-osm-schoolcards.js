const fs = require('fs');
const path = require('path');

const PATH_BUILDINGS = './data/osm-buildings.geojson';
const PATH_SCHOOLS = './data/bln-schools-mod.geojson';
const PATH_STREETS = './data/osm-speedlimits.geojson';
const CANVAS_SIZE = 200;    // target SVG viewBox (200 x 200 pixels)
const VIEW_SIZE = 200;      // radius is 100 meter

// Berlin is approximately on latitude 52.52 degree north
const METERS_PER_DEGREE_LON = 111320 * Math.cos(52.52 * Math.PI / 180);
const METERS_PER_DEGREE_LAT = 111320;

function convertGeoToSVG(lon, lat, centerLon, centerLat) {
    const diffX = (lon - centerLon) * METERS_PER_DEGREE_LON;
    const diffY = (lat - centerLat) * METERS_PER_DEGREE_LAT;

    const x = Math.round(((diffX + VIEW_SIZE) / (VIEW_SIZE * 2)) * CANVAS_SIZE);
    const y = Math.round(((VIEW_SIZE - diffY) / (VIEW_SIZE * 2)) * CANVAS_SIZE);

    return [x, y];
}

function isInsideCanvas([x, y]) {
    return
        (x >= 0) &&
        (x <= CANVAS_SIZE) &&
        (y >= 0) &&
        (y <= CANVAS_SIZE);
}

function streetIntersectsCanvas(coords) {
    for (let i = 0; i < coords.length; ++i) {
        if (isInsideCanvas(coords[i])) {
            return true;
        }

        if (i > 0) {
            const p1 = coords[i - 1];
            const p2 = coords[i];
            const minX = Math.min(p1[0], p2[0]);
            const maxX = Math.max(p1[0], p2[0]);
            const minY = Math.min(p1[1], p2[1]);
            const maxY = Math.max(p1[1], p2[1]);

            if (!(maxX < 0 || minX > CANVAS_SIZE || maxY < 0 || minY > CANVAS_SIZE)) {
                return true;
            }
        }
    }

    return false;
}

function getBuildingCenter(building) {
    if (building.properties && Array.isArray(building.properties.center) && building.properties.center.length === 2) {
        return building.properties.center;
    }

    if (building.geometry.type === 'Point') {
        return building.geometry.coordinates;
    }

    if ((building.geometry.type === 'Polygon') && building.geometry.coordinates[0]) {
        const points = building.geometry.coordinates[0];
        const lon = points.reduce((sum, point) => sum + point[0], 0) / points.length;
        const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
        return [lon, lat];
    }

    return [13.409779, 52.520645];
}

function processOSMData() {
    console.log('Convert school data...');

    if (!fs.existsSync(PATH_SCHOOLS) || !fs.existsSync(PATH_STREETS) || !fs.existsSync(PATH_BUILDINGS)) {
        console.error('Files missing: Please run all fetch scripts first!');
        return;
    }

    const schools = JSON.parse(fs.readFileSync(PATH_SCHOOLS, 'utf8')).features;
    const streets = JSON.parse(fs.readFileSync(PATH_STREETS, 'utf8')).features;
    const buildings = JSON.parse(fs.readFileSync(PATH_BUILDINGS, 'utf8')).features;

    const cards = [];

    schools.forEach((school, index) => {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`Process school ${index + 1} of ${schools.length}`);

        const id = school.properties.ref || `school_${index + 1}`;
        const title = school.properties.title || 'Unknown School';
        const type = school.properties.type || '';
        const addressStreet = school.properties.street || '';
        const addressZIP = school.properties.zip || '';
        const addressCity = school.properties.city || '';
        const district = school.properties.district || '';
        const [centerLon, centerLat] = getBuildingCenter(school);

        const localStreets = [];
        let countEqual30 = 0;
        let countLess30 = 0;
        let countTotal = 0;

        streets.forEach(street => {
            if (street.geometry && street.geometry.type === 'LineString') {
                const svgCoords = street.geometry.coordinates.map(point => convertGeoToSVG(point[0], point[1], centerLon, centerLat));

                if (streetIntersectsCanvas(svgCoords)) {
                    const rawSpeed = street.properties.maxspeed || 50;
                    const speed = parseInt(rawSpeed, 10) || 50;

                    if (speed < 30) {
                        ++countLess30;
                    }
                    if (speed === 30) {
                        ++countEqual30;
                    }
                    ++countTotal;

                    localStreets.push({
                        name: street.properties.title || '',
                        speed: speed,
                        coords: svgCoords
                    });
                }
            }
        });

        let buildingBox = { x: 75, y: 75, width: 50, height: 50 };

        const schoolBuilding = buildings.find(building => {
            if (building.geometry.type !== 'Polygon') {
                return false;
            }

            const points = building.geometry.coordinates[0].map(point => convertGeoToSVG(point[0], point[1], centerLon, centerLat));
            const x = points.reduce((sum, point) => sum + point[0], 0) / points.length;
            const y = points.reduce((sum, point) => sum + point[1], 0) / points.length;
            return Math.abs(x - 100) < 40 && Math.abs(y - 100) < 40;
        });

        if (schoolBuilding) {
            const points = schoolBuilding.geometry.coordinates[0].map(point => convertGeoToSVG(point[0], point[1], centerLon, centerLat));
            const xs = points.map(point => point[0]);
            const ys = points.map(point => point[1]);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            buildingBox = {
                x: Math.max(10, minX),
                y: Math.max(10, minY),
                width: Math.min(180, Math.max(20, maxX - minX)),
                height: Math.min(180, Math.max(20, maxY - minY))
            };
        }

        const protectionRate = countTotal > 0 ? Math.round(((countEqual30 + countLess30) / countTotal) * 100) : 50;
        const score = Math.min(99, Math.max(10, Math.round(protectionRate * 0.8 + 20)));

        cards.push({
            id,
            title,
            type,
            address: addressStreet,
            zip: addressZIP,
            city: addressCity,
            district,
            center: [centerLon, centerLat],
            score,
            building: buildingBox,
            streets: localStreets,
            metrics: {
//protectionRate: `${protectionRate}% Tempo 30 (${count30}/${countTotal} Straßen)`,
//eveningSafety: protectionRate < 50 ? 'Lückenhaft (Kritisch)' : 'Ausreichend',
//mainRoadStatus: countTotal - count30 > 0 ? 'Hauptstraße im Nahbereich' : 'Vollständig Tempo 30',
//reason: school.properties.grund || 'Unbekannt'
            }
        });
    });
    console.log('');

    const dir = './dist';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    const filePath = path.join(dir, 'school-cards.json');
    fs.writeFileSync(filePath, JSON.stringify(cards/*, null, 2*/));

    console.log(`Done: ${Object.keys(cards).length} school cards saved in '${filePath}'.`);
}

processOSMData();