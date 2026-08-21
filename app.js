document.addEventListener('DOMContentLoaded', () => {
    let schools = {};

    const dataRoot = 'https://tursics.github.io/schule-speed-limit/';

    const elemSchoolList = document.getElementById('school-list');
    const elemSchoolTitle = document.getElementById('school-title');
    const elemSchoolDistrict = document.getElementById('school-district');
    const elemScoreNumber = document.querySelector('.chart-gauge .number');
    const elemScoreLabel = document.querySelector('.chart-gauge .label');
    const elemScoreGauge = document.querySelector('.chart-gauge');

    const elemMapTile = document.querySelector('.map .tile');
//    const elemMapBuilding = document.querySelector('.map .building');

    const elemMetricProtection = document.getElementById('metric-protection');
    const elemMetricEvening = document.getElementById('metric-evening');
    const elemMetricMainRoad = document.getElementById('metric-mainroad');
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

    function setSchool(id) {
        const school = schools[id];
        if (!school) return;

console.log(school);
        elemSchoolTitle.textContent = school.title;
        elemSchoolDistrict.textContent = `Grundschule in ${school.district}`;
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

        let svg = '';
        school.streets.forEach(street => {
            const color = street.speed <= 30 ? '#00ff88' : '#ff3366';
            const points = street.coords.map(pt => pt.join(',')).join(' ');
            svg += `<polyline points="${points}" stroke="${color}" stroke-width="6" fill="none" stroke-linecap="round" />`;
        });
        elemMapTile.innerHTML = svg;

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
            setSchool(firstSchool);
        }
    })
    .catch(err => console.error('Error loading school data:', err));
});