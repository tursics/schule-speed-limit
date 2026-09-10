document.addEventListener('DOMContentLoaded', () => {
    let schools = {};

    const dataRoot = 'https://tursics.github.io/schule-speed-limit/';

    const elemSchoolList = document.getElementById('school-list');
    const elemDistrictList = document.getElementById('district-list');
    const elemSchoolTitle = document.getElementById('school-title');
    const elemSchoolDistrict = document.getElementById('school-district');
    const elemSchoolCard = document.querySelector('.panel.schoolcard');
    const elemSchoolImage = document.querySelector('.panel.schoolcard .photo img');
    const elemScoreNumber = document.querySelector('.panel.schoolcard .score .number');
    const elemScoreLabel = document.querySelector('.panel.schoolcard .score .label');
    const elemScoreGauge = document.querySelector('.panel.schoolcard .score .gauge');
    const elemScorePointer = document.querySelector('.panel.schoolcard .score .gauge .pointer');
    const elemBarChart = document.querySelector('.chart .bars');
    const elemButtonRotateLeft = document.getElementById('button-rotate-left');
    const elemButtonRotateRight = document.getElementById('button-rotate-right');

    const elemMap = document.querySelector('.map');
    const elemMapTile = document.querySelector('.map .tile');
    const elemMapImage = document.querySelector('.map .tile svg');

    const elemMetricStreets = document.getElementById('metric-streets');
    const elemMetricStreetsDanger = document.getElementById('metric-streets-danger');
    const elemMetricStreetsSafe = document.getElementById('metric-streets-safe');

    const svgDefs = '<defs>' +
    '</defs>';

    function updateSchoolList() {
        const prefix = elemDistrictList.value;

        elemSchoolList.innerHTML = '';

        Object.values(schools).forEach(school => {
            let show = false;
            if (prefix.length !== 2) {
                show = true;
            } else {
                show = school.id.startsWith(prefix);
            }

            if (show) {
                const option = document.createElement('option');
                option.value = school.id;
                option.textContent = `${school.title} (${school.district})`;
                elemSchoolList.appendChild(option);
            }
        });

        updateBarChart();
        setSchool(elemSchoolList.value);
    }

    function updateBarChart() {
        const sum = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const count = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const title = ['', 'Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf', 'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln', 'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf'];

        Object.values(schools).forEach(school => {
            const district = parseInt(school.id.substring(0, 2), 10);

            sum[district] += school.score;
            ++count[district];
        });

        const prefix = parseInt(elemDistrictList.value, 10);

        elemBarChart.innerHTML = '';
        for (let i = 1; i <=12 ;++i) {
            const div = document.createElement('div');
            div.className = prefix === i ? 'col active' : 'col';
            div.style.height = `${Math.round(sum[i] / count[i])}%`;
            div.title = title[i];
            elemBarChart.appendChild(div);

        }
    }

    function onRotateMap(event) {
        const currentRotation = parseInt(elemMapTile.dataset.rotate || '0', 10);
        let diff = parseInt(event.currentTarget.dataset.val || '0', 10);
        diff = parseInt(Math.floor(Math.random() * diff * .5) + diff * .75, 10);

        elemMapTile.attributes['data-rotate'].value = currentRotation + diff;

        reBuildBuildings();
      }

    function prepareControlRoom() {
        updateSchoolList();
        updateBarChart();

        elemSchoolList.addEventListener('change', (event) => {
            setSchool(event.target.value);
        });
        elemDistrictList.addEventListener('change', (event) => {
            updateSchoolList();
        });

        elemButtonRotateLeft.addEventListener('click', onRotateMap);
        elemButtonRotateRight.addEventListener('click', onRotateMap);
    }

    function reBuildBuildings() {
        const elemBuildings = elemMap.querySelector('.buildings');
        let svg = '';

        const schoolIndex = parseInt(elemSchoolCard.dataset.id, 10);
        const school = schools[schoolIndex];

        school.buildings.forEach(building => {
            svg += get3DBuilding(building.coords);
        });

        elemBuildings.innerHTML = svg;
    }

    function get3DBuilding(polygonPoints) {
        const rotation = parseInt(elemMapTile.dataset.rotate || '0', 10);
        const height = 18;
        const sin = Math.sin(rotation * Math.PI / 180);
        const cos = Math.cos(rotation * Math.PI / 180);
        const offsetX = height * sin;
        const offsetY = height * cos;

        const roofPoints = polygonPoints.map(([x, y]) => [
            x - offsetX,
            y - offsetY
        ]);

        let svg = '<g class="building">';

        const campusStr = polygonPoints.map(pt => pt.join(',')).join(' ');
        svg += `<polygon class="ground-shadow" points="${campusStr}" />`;

        const wallLines = [];
        for (let i = 0; i < polygonPoints.length; ++i) {
            const next = (i + 1) % polygonPoints.length;

            const p1 = polygonPoints[i];
            const p2 = polygonPoints[next];
            const r1 = roofPoints[i];
            const r2 = roofPoints[next];

            wallLines.push([p1, p2, r2, r1]);
        }

        wallLines.sort((a, b) => {
            const yMaxA = Math.max(a[0][1], a[1][1]);
            const yMaxB = Math.max(b[0][1], b[1][1]);
            if (yMaxA !== yMaxB) {
                return yMaxA - yMaxB;
            }

            const yMinA = Math.min(a[0][1], a[1][1]);
            const yMinB = Math.min(b[0][1], b[1][1]);
            if (yMinA !== yMinB) {
                return yMinA - yMinB;
            }

            const xMinA = Math.min(a[0][0], a[1][0]);
            const xMinB = Math.min(b[0][0], b[1][0]);
            if (xMinA !== xMinB) {
                return xMinA - xMinB;
            }

            return 0;
        });

        svg += '<g class="walls">';
        for (let i = 0; i < wallLines.length; ++i) {
            const line = wallLines[i];
            const [p1, p2, r2, r1] = line;

            const wallPoints = `${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${r2[0]},${r2[1]} ${r1[0]},${r1[1]}`;
            const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);
            const brightness = Math.round(40 + Math.abs(Math.sin(angle)) * 35);

            svg += `<polygon class="wall" points="${wallPoints}" fill="hsl(52, 14%, ${brightness}%)" />`;
        }
        svg += '</g>';

        const roofStr = roofPoints.map(pt => pt.join(',')).join(' ');
        svg += `<polygon class="roof-top" points="${roofStr}" />`;

        svg += '</g>';

        return svg;
    }

    function setSchool(ref) {
        const found = schools
            .map((school, index) => {
                return {
                    ...school,
                    arrayIndex: index
                };
            })
            .filter((school) => school.id === ref);
        if (found.length === 0) {
            return;
        }

        if (found.length > 1) {
console.log(found);
            console.error('More than 1 object found for ' + ref);
        }
        const school = found[0];

        elemSchoolCard.attributes['data-id'].value = school.arrayIndex;

        elemSchoolTitle.textContent = school.title;
        elemSchoolDistrict.textContent = school.district;
        elemScoreNumber.textContent = school.score;
        elemSchoolImage.src = school.image || '';
        elemSchoolCard.classList.remove('with-image');

        if (school.image !== '') {
            elemSchoolCard.classList.add('with-image');
        }

        const score = Math.max(1, school.score);
        const wedge = .75;
        const gradient = score * wedge;
        const stop0 = Math.round(wedge * 0 * 100) + '%';
        const stop25 = Math.round(wedge * .25 * 100) + '%';
        const stop50 = Math.round(wedge * .50 * 100) + '%';
        const stop75 = Math.round(wedge * .75 * 100) + '%';
        const stop100 = Math.round(wedge * 1 * 100) + '%';
        const degreeStartGradient = Math.round(180 + 360 * (1 - wedge) / 2);
        const degreeStartPointer = degreeStartGradient - 360;
        const degreePointer = degreeStartPointer + Math.round(gradient * 3.6) - 2;

        if (score < 25) {
            elemScoreLabel.textContent = 'Hohes Risiko';
            elemScoreLabel.style.color = 'var(--score-25)';
            elemScoreGauge.style.background = `conic-gradient(from ${degreeStartGradient}deg, var(--score-0) ${stop0}, var(--score-25) ${gradient}%, var(--score-ring) ${gradient}% ${stop100}, transparent ${stop100} 100%)`;
        } else if (score < 50) {
            elemScoreLabel.textContent = 'Höheres Risiko';
            elemScoreLabel.style.color = 'var(--score-50)';
            elemScoreGauge.style.background = `conic-gradient(from ${degreeStartGradient}deg, var(--score-0) ${stop0}, var(--score-25) ${stop25}, var(--score-50) ${gradient}%, var(--score-ring) ${gradient}% ${stop100}, transparent ${stop100} 100%)`;
        } else if (score < 75) {
            elemScoreLabel.textContent = 'Mittleres Risiko';
            elemScoreLabel.style.color = 'var(--score-75)';
            elemScoreGauge.style.background = `conic-gradient(from ${degreeStartGradient}deg, var(--score-0) ${stop0}, var(--score-25) ${stop25}, var(--score-50) ${stop50}, var(--score-75) ${gradient}%, var(--score-ring) ${gradient}% ${stop100}, transparent ${stop100} 100%)`;
        } else {
            elemScoreLabel.textContent = 'Geringes Risiko';
            elemScoreLabel.style.color = 'var(--score-100)';
            elemScoreGauge.style.background = `conic-gradient(from ${degreeStartGradient}deg, var(--score-0) ${stop0}, var(--score-25) ${stop25}, var(--score-50) ${stop50}, var(--score-75) ${stop75}, var(--score-100) ${gradient}%, var(--score-ring) ${gradient}% ${stop100}, transparent ${stop100} 100%)`;
        }
        elemScorePointer.style.transform = 'rotate(' + degreePointer + 'deg)';

        let statistic = {};
        let svg = '';
        let lowSpeed = 0;
        let totalSpeed = 0;

        school.grounds.forEach(campus => {
            const points = campus.coords.map(pt => pt.join(',')).join(' ');
            svg += `<polygon class="campus-polygon" points="${points}" />`;
        });

        svg += `<g class="streets">`;
        let bgStreets = '';
        let fgStreets = '';
        school.streets.sort((a, b) => a.speed - b.speed);
        school.streets.forEach(street => {
            const className = street.speed === 0 ? 'default' : (street.speed <= 30 ? 'safe' : 'danger');
            const points = street.coords.map(pt => pt.join(',')).join(' ');
            bgStreets += `<polyline class="street bg-${className}" points="${points}" />`;
            fgStreets += `<polyline class="street ${className}" points="${points}" />`;

            if (street.speed > 0) {
                let info = statistic[street.name] || {
                    name: street.name || 'Straße ohne Name',
                    parts: []
                };
                info.parts.push({
                    distance: street.length,
                    limit: street.speed
                });
                statistic[street.name] = info;

                if (street.speed <= 30) {
                    lowSpeed += street.length;
                }
                totalSpeed += street.length;
            }
        });
        svg += bgStreets + fgStreets;
        svg += `</g>`;

        svg += `<g class="buildings">`;
        school.buildings.forEach(building => {
            svg += get3DBuilding(building.coords);
        });
        svg += `</g>`;

        elemMapImage.innerHTML = svgDefs + svg;

        let streetInfos = '';
        let streetInfosDanger = '';
        let streetInfosSafe = '';
        streetInfos += '<div class="value">' + school.type + '<br>' + school.address + '<br>' + school.zip + ' ' + school.city + '</div>';
        streetInfosSafe += `<div class="label">Schutzquote (400m x 400m)</div>`;
        streetInfosSafe += `<div class="value">${Math.round(lowSpeed / totalSpeed * 100)}% verkehrsberuhigt</div>`;
        streetInfosDanger += `<div class="value">Hauptstraßen</div>`;

        school.additions.forEach(addition => {
            streetInfos += `<div class="hint">${addition}</div>`;
        });

        let speedlimits = [];
        Object.values(statistic).forEach(item => {
            let speed = {};

            item.parts.forEach((itemParts) => {
                let sum = speed[itemParts.limit] || 0;
                sum += itemParts.distance;
                speed[itemParts.limit] = sum;
            });

            Object.values(speed).forEach((distance, i) => {
                speedlimits.push({
                    name: item.name,
                    distance,
                    speed: Object.keys(speed)[i]
                });
            });
        });

        speedlimits.sort((a, b) => {
            if (a.speed !== b.speed) {
                return b.speed - a.speed;
            }
            return a.name < b.name ? -1 : 1;
        });

        let current = 0;
        speedlimits.forEach(item => {
            let addition = '';
            if (current !== item.speed) {
                current = item.speed;
                addition += `<div class="sign">${item.speed}</div>`;
            }

            if (item.speed <= 30) {
                streetInfosSafe += `${addition}<div class="hint">${item.name}: ${item.distance} m</div>`;
            } else {
                streetInfosDanger += `${addition}<div class="hint">${item.name}: ${item.distance} m</div>`;
            }
        });

        if (elemMetricStreets) {
            elemMetricStreets.innerHTML = streetInfos;
        }
        if (elemMetricStreetsDanger) {
            elemMetricStreetsDanger.innerHTML = streetInfosDanger;
        }
        if (elemMetricStreetsSafe) {
            elemMetricStreetsSafe.innerHTML = streetInfosSafe;
        }
    }

    async function fetchGZIP(url) {
        const response = await fetch(url);
        const gzip = new DecompressionStream('gzip'); // 'brotli' not mainly supported
        const stream = response.body.pipeThrough(gzip);

        return new Response(stream);
    }

    fetchGZIP(dataRoot + 'dist/data.json.gz')
    .then(res => res.json())
    .then(data => {
        schools = data;

        prepareControlRoom();
    })
    .catch(error => console.error('Error loading school data:', error));
});