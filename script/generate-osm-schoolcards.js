const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PATH_BUILDINGS = './data/osm-buildings.geojson';
const PATH_SCHOOLS = './data/bln-schools-mod.geojson';
const PATH_STREETS = './data/osm-speedlimits.geojson';
const PATH_GROUNDS = './data/osm-grounds.geojson';
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
    const ret =
        (x >= 0) &&
        (x <= CANVAS_SIZE) &&
        (y >= 0) &&
        (y <= CANVAS_SIZE);
    return ret;
}

function streetGetLength(street) {
    let meter = 0;

    if (street.geometry && street.geometry.type === 'LineString') {
        const len = street.geometry.coordinates.length;
        for (let i = 1; i < len; ++i) {
            const point1 = street.geometry.coordinates[i - 1];
            const point2 = street.geometry.coordinates[i];

            const diffX = (point1[0] - point2[0]) * METERS_PER_DEGREE_LON;
            const diffY = (point1[1] - point2[1]) * METERS_PER_DEGREE_LAT;
            const hypotenuse = Math.hypot(diffX, diffY);

            meter += hypotenuse;
        }
    }

    return Math.round(meter);
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

function getObjectCenter(item) {
    if (item.properties && Array.isArray(item.properties.center) && item.properties.center.length === 2) {
        return item.properties.center;
    }

    if (item.geometry.type === 'Point') {
        return item.geometry.coordinates;
    }

    if ((item.geometry.type === 'Polygon') && item.geometry.coordinates[0]) {
        const points = item.geometry.coordinates[0];
        const lon = points.reduce((sum, point) => sum + point[0], 0) / points.length;
        const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
        return [lon, lat];
    }

    return [13.409779, 52.520645];
}

function pointToCircle([x, y], radius = 40) {
    const sides = 10;
    const points = [];

    for (let i = 0; i < sides; ++i) {
        const angle = (i * 2 * Math.PI) / sides;
        const pointX = Math.round(x + radius * Math.cos(angle));
        const pointY = Math.round(y + radius * Math.sin(angle));
        points.push([pointX, pointY]);
    }

    return points;
}

function processOSMData() {
    console.log('Convert school data...');

    if (!fs.existsSync(PATH_SCHOOLS) || !fs.existsSync(PATH_STREETS) || !fs.existsSync(PATH_BUILDINGS) || !fs.existsSync(PATH_GROUNDS)) {
        console.error('Files missing: Please run all fetch scripts first!');
        return;
    }

    const schools = JSON.parse(fs.readFileSync(PATH_SCHOOLS, 'utf8')).features;
    const streets = JSON.parse(fs.readFileSync(PATH_STREETS, 'utf8')).features;
    const buildings = JSON.parse(fs.readFileSync(PATH_BUILDINGS, 'utf8')).features;
    const grounds = JSON.parse(fs.readFileSync(PATH_GROUNDS, 'utf8')).features;

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
        const [centerLon, centerLat] = getObjectCenter(school);

        const localStreets = [];
        let meterEqual0 = 0;
        let meterLess30 = 0;
        let meterEqual30 = 0;
        let meterTotal = 0;

        streets.forEach(street => {
            if (street.geometry && street.geometry.type === 'LineString') {
                const svgCoords = street.geometry.coordinates.map(point => convertGeoToSVG(point[0], point[1], centerLon, centerLat));

                if (streetIntersectsCanvas(svgCoords)) {
                    const rawSpeed = street.properties.maxspeed || 0;
                    const speed = parseInt(rawSpeed, 10) || 0;
                    const length = streetGetLength(street);

                    if (speed === 0) {
                        meterEqual0 += length;
                    } else if (speed < 30) {
                        meterLess30 += length;
                    } else if (speed === 30) {
                        meterEqual30 += length;
                    }
                    meterTotal += length;

                    localStreets.push({
                        name: street.properties.title || '',
                        coords: svgCoords,
                        length,
                        speed: speed
                    });
                }
            }
        });

        const visibleBuildings = buildings.filter(building => {
            const [lon, lat] = getObjectCenter(building);
            const center = convertGeoToSVG(lon, lat, centerLon, centerLat);

            return isInsideCanvas(center);
        });

        let localBuildings = [];
        visibleBuildings.forEach(building => {
//            console.log(building.properties);
            if (building.geometry && building.geometry.type === 'Polygon') {
                building.geometry.coordinates.forEach(singleBuilding => {
                    const svgCoords = singleBuilding.map(point => convertGeoToSVG(point[0], point[1], centerLon, centerLat));

                    localBuildings.push({
                        name: building.properties.title || '',
                        ref: building.properties.ref || '',
                        coords: svgCoords
                    });
                });
            } else {
                console.log(building);
                console.error('Building use wrong geometry type');
            }
        });
        if (localBuildings.length === 0) {
            const svgPoint = convertGeoToSVG(centerLon, centerLat, centerLon, centerLat);
            const svgCoords = pointToCircle(svgPoint, 20);

            localBuildings.push({
                name: title,
                ref: id,
                coords: svgCoords
            });
        }

        const visibleGrounds = grounds.filter(ground => {
            const [lon, lat] = getObjectCenter(ground);
            const center = convertGeoToSVG(lon, lat, centerLon, centerLat);

            return isInsideCanvas(center);
        });

        let localGrounds = [];
        visibleGrounds.forEach(ground => {
//            console.log(ground.properties);
            if (ground.geometry && (ground.geometry.type === 'Polygon')) {
                ground.geometry.coordinates.forEach(singleGround => {
                    const svgCoords = singleGround.map(point => convertGeoToSVG(point[0], point[1], centerLon, centerLat));

                    localGrounds.push({
                        name: ground.properties.title || '',
                        ref: ground.properties.ref || '',
                        coords: svgCoords
                    });
                });
            } else if (ground.geometry && (ground.geometry.type === 'Point')) {
                const point = ground.geometry.coordinates;
                const svgPoint = convertGeoToSVG(point[0], point[1], centerLon, centerLat);
                const svgCoords = pointToCircle(svgPoint, 40);

                localGrounds.push({
                    name: ground.properties.title || '',
                    ref: ground.properties.ref || '',
                    coords: svgCoords
                });
            } else {
                console.log(ground);
                console.error('Ground use wrong geometry type');
            }
        });

        meterTotal -= meterEqual0;
        const protectionRate = meterTotal > 0 ? Math.round(((meterEqual30 + meterLess30) / meterTotal) * 100) : 50;
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
            buildings: localBuildings,
            grounds: localGrounds,
            streets: localStreets,
            metrics: {
//protectionRate: `${protectionRate}% Tempo 30 (${count30}/${meterTotal} Straßen)`,
//eveningSafety: protectionRate < 50 ? 'Lückenhaft (Kritisch)' : 'Ausreichend',
//mainRoadStatus: meterTotal - count30 > 0 ? 'Hauptstraße im Nahbereich' : 'Vollständig Tempo 30',
//reason: school.properties.grund || 'Unbekannt'
            }
        });
    });
    console.log('');

    const dir = './data';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    const filePath = path.join(dir, 'school-cards.json');
    fs.writeFileSync(filePath, JSON.stringify(cards/*, null, 2*/));

    console.log(`Done: ${Object.keys(cards).length} school cards saved in '${filePath}'.`);
}

function compressFile() {
    let dir = './data';
    const inputPath = path.join(dir, 'school-cards.json');

    dir = './dist';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    const outputPath = path.join(dir, 'data.json.gz');

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    const gzip = zlib.createGzip();
//    const gzip = zlib.createBrotliCompress();
    input.pipe(gzip).pipe(output);

    input.on('error', (err) => console.error('Input error:', err));
    gzip.on('error', (err) => console.error('Compression error:', err));
    output.on('error', (err) => console.error('Output error:', err));
    output.on('finish', () => {
        console.log(`Done: Finale file distributed in '${outputPath}'.`);

        const inputStats = fs.statSync(inputPath);
        const outputStats = fs.statSync(outputPath);

        console.log(`  File size: ${outputStats.size} bytes (compression ratio ${Math.round(100 - (outputStats.size / inputStats.size * 100))}%).`);
    });
}

processOSMData();
compressFile();