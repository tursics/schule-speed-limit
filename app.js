document.addEventListener('DOMContentLoaded', () => {
    let schools = {};

    const dataRoot = 'https://tursics.github.io/schule-speed-limit/';

    const elemSchoolList = document.getElementById('school-list');
    const elemSchoolTitle = document.getElementById('school-title');
    const elemSchoolDistrict = document.getElementById('school-district');
    const elemScoreNumber = document.querySelector('.chart-gauge .number');
    const elemScoreLabel = document.querySelector('.chart-gauge .label');
    const elemScoreGauge = document.querySelector('.chart-gauge');

    const elemMapTile = document.querySelector('.map .tile svg');

    const elemMetricStreets = document.getElementById('metric-streets');
    const elemMetricStreetsDanger = document.getElementById('metric-streets-danger');
    const elemMetricStreetsSafe = document.getElementById('metric-streets-safe');

    function prepareControlRoom() {
        elemSchoolList.innerHTML = '';

        Object.values(schools).forEach(school => {
            const option = document.createElement('option');
            option.value = school.id;
            option.textContent = `${school.title} (${school.district})`;
            elemSchoolList.appendChild(option);
        });

        elemSchoolList.addEventListener('change', (event) => {
            setSchool(event.target.value);
        });
    }

    function get3DBuilding(polygonPoints, height = 14) {
        const offsetX = height * .2;
        const offsetY = height * .7;

        const roofPoints = polygonPoints.map(([x, y]) => [
            x - offsetX,
            y - offsetY
        ]);

        let svg = '<g>';

        const groundStr = polygonPoints.map(pt => pt.join(',')).join(' ');
        svg += `<polygon points="${groundStr}" fill="rgba(0, 0, 0, 0.4)" transform="translate(2, 2)" />`;

        for (let i = 0; i < polygonPoints.length; ++i) {
            const next = (i + 1) % polygonPoints.length;

            const p1 = polygonPoints[i];
            const p2 = polygonPoints[next];
            const r1 = roofPoints[i];
            const r2 = roofPoints[next];

            const wallPoints = `${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${r2[0]},${r2[1]} ${r1[0]},${r1[1]}`;
            const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);
            const brightness = 25 + Math.abs(Math.sin(angle)) * 50;

            svg += `<polygon points="${wallPoints}" fill="hsl(215, 50%, ${brightness}%)" stroke="#f0f0ff" stroke-width="0.5" />`;
        }

        const roofStr = roofPoints.map(pt => pt.join(',')).join(' ');
        svg += `<polygon points="${roofStr}" fill="#1e293b" stroke="#f0f0ff" stroke-width="0.5" />`;
        svg += `<polygon points="${roofStr}" fill="rgba(0, 240, 255, 0.12)" />`;

        svg += '</g>';

        return svg;
    }

    function setSchool(ref) {
        const found = schools.filter((school) => school.id === ref);
        if (found.length === 0) {
            return;
        }

        if (found.length > 1) {
            console.error('More than 1 object found for ' + ref);
        }
        const school = found[0];
console.log(school);

        elemSchoolTitle.textContent = school.title;
        elemSchoolDistrict.textContent = school.type;
        elemScoreNumber.textContent = school.score;

        const score = Math.max(1, school.score);
        if (score < 50) {
            elemScoreLabel.textContent = 'Kritisch';
            elemScoreLabel.style.color = 'var(--accent-red';
            elemScoreNumber.style.color = 'var(--accent-red';
            elemScoreGauge.style.background = `conic-gradient(var(--accent-red) 0% ${score}%, rgba(255,255,255,0.1) ${score}% 100%)`;
        } else if (score < 75) {
            elemScoreLabel.textContent = 'Mäßig';
            elemScoreLabel.style.color = 'var(--accent-orange';
            elemScoreNumber.style.color = 'var(--accent-orange';
            elemScoreGauge.style.background = `conic-gradient(var(--accent-orange) 0% ${score}%, rgba(255,255,255,0.1) ${score}% 100%)`;
        } else {
            elemScoreLabel.textContent = 'Sicher';
            elemScoreLabel.style.color = 'var(--accent-green';
            elemScoreNumber.style.color = 'var(--accent-green';
            elemScoreGauge.style.background = `conic-gradient(var(--accent-green) 0% ${score}%, rgba(255,255,255,0.1) ${score}% 100%)`;
        }

        let statistic = {};
        let svg = '';
        let lowSpeed = 0;
        let totalSpeed = 0;

        school.grounds.forEach(ground => {
            const points = ground.coords.map(pt => pt.join(',')).join(' ');
            svg += `<polygon points="${points}" fill="#00f0ff80" stroke="#00f0ff" stroke-width="0.8" />`;
        });

        school.streets.sort((a, b) => a.speed - b.speed);
        school.streets.forEach(street => {
            const color = street.speed === 0 ? '#077' : (street.speed <= 30 ? '#00ff88' : '#ff3366');
            const points = street.coords.map(pt => pt.join(',')).join(' ');
            svg += `<polyline points="${points}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" />`;

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

        school.buildings.forEach(building => {
            svg += get3DBuilding(building.coords);
        });

        elemMapTile.innerHTML = svg;

        let streetInfos = '';
        let streetInfosDanger = '';
        let streetInfosSafe = '';
        streetInfos += '<div class="value">' + school.address + '<br>' + school.zip + ' ' + school.city + ', ' + school.district + '</div>';
        streetInfosSafe += `<div class="label">Schutzquote (400m x 400m)</div>`;
        streetInfosSafe += `<div class="value">${Math.round(lowSpeed / totalSpeed * 100)}% verkehrsberuhigt</div>`;
        streetInfosDanger += `<div class="value">Hauptstraßen</div>`;

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

        const firstSchool = Object.keys(schools)[0];
        if (firstSchool) {
            setSchool(schools[firstSchool].id);
        }
    })
    .catch(error => console.error('Error loading school data:', error));
});