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

    const elemMetricProtection = document.getElementById('metric-protection');
    const elemMetricMainRoad = document.getElementById('metric-mainroad');
    const elemMetricEvening = document.getElementById('metric-evening');
    const elemMetricStreets = document.getElementById('metric-streets');
    const elemMetricReason = document.getElementById('metric-reason');

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

/*        if (elemMetricProtection) {
            elemMetricProtection.textContent = school.metrics.protectionRate;
        }
        if (elemMetricEvening) {
            elemMetricEvening.textContent = school.metrics.eveningSafety;
        }
        if (elemMetricMainRoad) {
            elemMetricMainRoad.textContent = school.metrics.mainRoadStatus;
        }
        if (elemMetricReason) {
            elemMetricReason.textContent = school.metrics.reason;
        }*/

        let statistic = {};
        let svg = '';
        school.streets.forEach(street => {
            const color = street.speed <= 30 ? '#00ff88' : '#ff3366';
            const points = street.coords.map(pt => pt.join(',')).join(' ');
            svg += `<polyline points="${points}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" />`;

            let info = statistic[street.name] || {
                name: street.name,
                parts: []
            };
            info.parts.push({
                distance: 1,
                limit: street.speed
            });
            statistic[street.name] = info;
        });
        elemMapTile.innerHTML = svg;

        let streetInfos = '';
        streetInfos += '<div class="value">' + school.address + '<br>' + school.zip + ' ' + school.city + ', ' + school.district + '</div>';

        Object.values(statistic).forEach(item => {
            let speed = {};

            item.parts.forEach((itemParts) => {
                let sum = speed[itemParts.limit] || 0;
                sum += itemParts.distance;
                speed[itemParts.limit] = sum;
            });

            Object.values(speed).forEach((distance, i) => {
                streetInfos += '<div class="hint">' + item.name + ': ' + distance + 'x ' + Object.keys(speed)[i] + ' km/h</div>';
            });
        });

        if (elemMetricStreets) {
            elemMetricStreets.innerHTML = streetInfos;
        }

/*        const scale = 220 / 200;
        elemMapBuilding.style.left = (school.building.x * scale) + 'px';
        elemMapBuilding.style.top = (school.building.y * scale) + 'px';
        elemMapBuilding.style.width = (school.building.width * scale) + 'px';
        elemMapBuilding.style.height = (school.building.height * scale) + 'px';*/
    }

    fetch(dataRoot + 'dist/school-cards.json')
    .then(res => res.json())
    .then(data => {
        schools = data;
        prepareControlRoom();

        const firstSchool = Object.keys(schools)[0];
        if (firstSchool) {
            setSchool(schools[firstSchool].id);
        }
    })
    .catch(err => console.error('Error loading school data:', err));
});