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
//    const elemMapBuilding = document.querySelector('.map .building');

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

        if (school.ground) {
            const grounds = Array.isArray(school.ground[0][0]) ? school.ground : [school.ground];

            grounds.forEach(ground => {
                const points = ground.map(pt => pt.join(',')).join(' ');
                svg += `<polygon points="${points}" fill="rgba(0, 240, 255, 0.18)" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="3,2" />`;
            });
        }

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

/*        const scale = 220 / 200;
        elemMapBuilding.style.left = (school.building.x * scale) + 'px';
        elemMapBuilding.style.top = (school.building.y * scale) + 'px';
        elemMapBuilding.style.width = (school.building.width * scale) + 'px';
        elemMapBuilding.style.height = (school.building.height * scale) + 'px';*/
    }

    async function fetchGZIP(url) {
        const response = await fetch(url);
        const gzip = new DecompressionStream('gzip'); // 'brotli' not mainly supported
        const stream = response.body.pipeThrough(gzip);

        return new Response(stream);
    }

    fetchGZIP(dataRoot + 'dist/school-cards.json.zip.gz')
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