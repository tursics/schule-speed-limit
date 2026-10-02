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

    const elemStatType = document.querySelector('.panel.statcard .header h3');
    const elemStatAddress = document.querySelector('.panel.statcard .header .address');
    const elemStatHints = document.querySelector('.panel.statcard .attention');
    const elemStatSigns = document.querySelector('.panel.statcard .trafficsigns');
    const elemSafeMetric = document.querySelector('.panel.statcard .safe-metric');

    const svgDefs = '<defs>' +
    '</defs>';

    function updateSchoolList(initialSchool) {
        const prefix = elemDistrictList.value;
        let found = false;

        elemSchoolList.innerHTML = '';

        Object.values(schools).forEach(school => {
            let show = false;
            if (prefix.length !== 2) {
                show = true;
            } else {
                show = school.id.startsWith(prefix);
            }

            if (show) {
                found |= school.id === initialSchool;

                const option = document.createElement('option');
                option.value = school.id;
                option.textContent = `${school.title} (${school.district})`;
                elemSchoolList.appendChild(option);
            }
        });

        updateBarChart();
        setSchool(found ? initialSchool : elemSchoolList.value);
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
        const initialSchool = getURLSchool();
        const initialDistrict = getURLDistrict();
        if (initialDistrict) {
              elemDistrictList.value = initialDistrict;
        }

        updateSchoolList(initialSchool);
        updateBarChart();

        elemSchoolList.addEventListener('change', (event) => {
            setSchool(event.target.value);
        });
        elemDistrictList.addEventListener('change', (event) => {
            setURLDistrict(elemDistrictList.value);
            updateSchoolList(elemSchoolList.value);
        });

        elemButtonRotateLeft.addEventListener('click', onRotateMap);
        elemButtonRotateRight.addEventListener('click', onRotateMap);
    }

    function reBuildBuildings() {
        const elemBuildings = elemMap.querySelector('.buildings');
        let svg = '';

        const schoolIndex = parseInt(elemSchoolCard.dataset.id, 10);
        const school = schools[schoolIndex];

        prepare3DBuildings(school.buildings);
        for (let serial = 0, serialCount = school.buildings.length; serial < serialCount; ++serial) {
            svg += get3DBuilding(school.buildings[serial], serial, serialCount);
        }

        elemBuildings.innerHTML = svg;
    }

    function getBuildingCentroid(building) {
        const count = building.coords.length;
        let sumX = 0;
        let sumY = 0;

        for (let i = 0; i < count; ++i) {
            sumX += building.coords[i][0];
            sumY += building.coords[i][1];
        }

        return {
            x: sumX / count,
            y: sumY / count
        };
    }

    function getWallMidpoint(wall) {
        return {
            x: (wall[0][0] + wall[1][0]) / 2,
            y: (wall[0][1] + wall[1][1]) / 2
        };
    }

    function prepare3DBuildings(buildings) {
        const rotation = parseInt(elemMapTile.dataset.rotate || '0', 10);
        const sin = Math.sin(rotation * Math.PI / 180);
        const cos = Math.cos(rotation * Math.PI / 180);

        buildings.sort((a, b) => {
            const centroidA = getBuildingCentroid(a);
            const centroidB = getBuildingCentroid(b);

            const depthA = centroidA.x * sin + centroidA.y * cos;
            const depthB = centroidB.x * sin + centroidB.y * cos;

            return depthA - depthB;
        });

    }

    function get3DBuildingWalls(polygonPoints, roofPoints, sin, cos) {
        const walls = [];

        for (let i = 0; i < polygonPoints.length; ++i) {
            const next = (i + 1) % polygonPoints.length;

            const p1 = polygonPoints[i];
            const p2 = polygonPoints[next];
            const r1 = roofPoints[i];
            const r2 = roofPoints[next];

            walls.push([p1, p2, r2, r1]);
        }

/*        walls.sort((a, b) => {
            const midA = getWallMidpoint(a);
            const midB = getWallMidpoint(b);

            const depthA = midA.x * sin + midA.y * cos;
            const depthB = midB.x * sin + midB.y * cos;

            return depthA - depthB;
        });*/
        walls.sort((a, b) => {
            const depthMaxA = Math.max(a[0][0] * sin + a[0][1] * cos, a[1][0] * sin + a[1][1] * cos);
            const depthMaxB = Math.max(b[0][0] * sin + b[0][1] * cos, b[1][0] * sin + b[1][1] * cos);
            if (depthMaxA !== depthMaxB) {
                return depthMaxA - depthMaxB;
            }

            const depthMinA = Math.min(a[0][0] * sin + a[0][1] * cos, a[1][0] * sin + a[1][1] * cos);
            const depthMinB = Math.min(b[0][0] * sin + b[0][1] * cos, b[1][0] * sin + b[1][1] * cos);
            if (depthMinA !== depthMinB) {
                return depthMinA - depthMinB;
            }

            return 0;
        });

        return walls;
    }

    function get3DBuilding(building, serial, count) {
        const polygonPoints = building.coords;
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

        const walls = get3DBuildingWalls(polygonPoints, roofPoints, sin, cos);
        svg += '<g class="walls">';
        for (let i = 0; i < walls.length; ++i) {
            const line = walls[i];
            const [p1, p2, r2, r1] = line;
            const wallPoints = `${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${r2[0]},${r2[1]} ${r1[0]},${r1[1]}`;
            const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);
            const brightness = Math.round(
                20 +
                ((serial + 1) / count) * 20 +
                Math.abs(Math.sin(angle)) * 35
            );

            svg += `<polygon class="wall" points="${wallPoints}" fill="hsl(52, 14%, ${brightness}%)" />`;
        }
        svg += '</g>';

        const roofStr = roofPoints.map(pt => pt.join(',')).join(' ');
        svg += `<polygon class="roof-top" points="${roofStr}" />`;

        svg += '</g>';

        return svg;
    }

    function getHints(school) {
        let hints = '';
        school.additions.forEach(addition => {
            addition = addition.replace('Barrierefreie Toilette vorhanden', '');
            addition = addition.replace('Behindertenparkplatz vorhanden', '');
            addition = addition.replace('Fahrstuhl vorhanden', '');
            addition = addition.replace('Zugang über Rampe möglich', '');

            while (addition.startsWith(', ')) {
                addition = addition.substring(2);
            }

            if (addition !== '') {
                hints += `<div class="hint">${addition}</div>`;
            }
        });

        return hints;
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
            setURLSchool(null);
            return;
        }

        elemSchoolList.value = ref;
        setURLSchool(ref);

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
        prepare3DBuildings(school.buildings);
        for (let serial = 0, serialCount = school.buildings.length; serial < serialCount; ++serial) {
            svg += get3DBuilding(school.buildings[serial], serial, serialCount);
        }
        svg += `</g>`;

        elemMapImage.innerHTML = svgDefs + svg;

        elemStatType.innerHTML = school.type.replace('( ', '(').replace(' )', ')');
        elemStatAddress.innerHTML = `${school.address}<br>${school.zip} ${school.city}`;
        elemSafeMetric.innerHTML = `<span class="highlight">${Math.round(lowSpeed / totalSpeed * 100)}%</span> verkehrsberuhigt`;

        let hints = getHints(school);
        elemStatHints.innerHTML = hints;
        elemStatHints.style.display = hints === '' ? 'none' : 'block';

        let signs = '';
        let speedlimits = [];

        Object.values(statistic).forEach(item => {
            let speed = {};

            item.parts.forEach((itemParts) => {
                let sum = speed[itemParts.limit] || 0;
                sum += itemParts.distance;
                speed[itemParts.limit] = sum;
            });

            Object.values(speed).forEach((distance, i) => {
                let speed_ = Object.keys(speed)[i];
                if (speed_ < 10) {
                    speed_ = 1;
                }

                speedlimits.push({
                    name: item.name,
                    distance,
                    speed: speed_
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
        signs += '<div><div>';
        speedlimits.forEach(item => {
            let addition = '';
            if (current !== item.speed) {
                current = item.speed;
                addition += `<div class="sign">${item.speed}</div>`;
                signs += '</div></div>';
                signs += `<div class="list ${item.speed <= 30 ? 'good' : 'danger'}">`;
                if (item.speed === 1) {
                    signs += `<div class="sign small"><span>&lt;10</span></div>`;
                } else {
                    signs += `<div class="sign">${item.speed}</div>`;
                }
                signs += '<div class="streets">';
            }

            if (item.speed <= 30) {
            } else {
            }

            signs += `<div class="row"><span class="name">${item.name}</span><span class="distance">${item.distance} m</span></div>`;
        });
        signs += '</div></div>';

        elemStatSigns.innerHTML = signs;
    }

    function initTouchEvents() {
        let startX = 0;
        let startRotate = 0;
        let isDragging = false;

        elemMap.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].clientX;
            startRotate = parseInt(elemMapTile.dataset.rotate || '0', 10);
        }, { passive: true });

        elemMap.addEventListener('touchmove', (e) => {
            if (!isDragging) {
                return;
            }
            const currentX = e.touches[0].clientX;
            const deltaX = currentX - startX;

            elemMapTile.attributes['data-rotate'].value = startRotate + (deltaX * 0.4);
            reBuildBuildings();
        }, { passive: true });

        elemMap.addEventListener('touchend', () => {
            isDragging = false;
        });
    }

    async function fetchGZIP(url) {
        const response = await fetch(url);
        const gzip = new DecompressionStream('gzip'); // 'brotli' not mainly supported
        const stream = response.body.pipeThrough(gzip);

        return new Response(stream);
    }

    updateResponsiveLayout();

    initTouchEvents();

    fetchGZIP(dataRoot + 'dist/data.json.gz')
    .then(res => res.json())
    .then(data => {
        schools = data;

        prepareControlRoom();
    })
    .catch(error => console.error('Error loading school data:', error));
});

function getURLSchool() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('school');
}

function getURLDistrict() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('district');
}

function setURLSchool(school) {
    const url = new URL(window.location);

    if (school) {
        url.searchParams.set('school', school);
    } else {
        url.searchParams.delete('school');
    }

    window.history.replaceState({}, '', url);
}

function setURLDistrict(district) {
    const url = new URL(window.location);

    if (district && (district !== 'all')) {
        url.searchParams.set('district', district);
    } else {
        url.searchParams.delete('district');
    }

    window.history.replaceState({}, '', url);
}

function updateResponsiveLayout() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const bodyPadding = 16 * 1;
    const gridGap = 16 * 1;
    const controlWidth = 16 * 19;

    const width = windowWidth - controlWidth - gridGap * 2 - bodyPadding;
    const height = windowHeight - 2 * bodyPadding;

    const schoolCardHeight = 41.25;
    const schoolCardWidth = 25;
    const statCardWidth = 20;
    const fontSizeHeight = Math.round(height / schoolCardHeight * 100) / 100;
    const fontSizeWidth = Math.round(width / (schoolCardWidth + statCardWidth) * 100) / 100;
    const panelFontSize = Math.min(fontSizeHeight, fontSizeWidth);

    const gridMarginX = Math.round((width - (schoolCardWidth + statCardWidth) * panelFontSize) / 2);

    document.documentElement.style.setProperty('--grid-margin', `${gridMarginX}px`);
    document.documentElement.style.setProperty('--panel-font-size', `${panelFontSize}px`);
    document.documentElement.style.setProperty('--vh', `${windowHeight * 0.01}px`);

    const elemMapImage = document.querySelector('.map .tile svg');
    elemMapImage.removeAttribute('width');
    elemMapImage.removeAttribute('height');
    if (!elemMapImage.getAttribute('viewBox')) {
        elemMapImage.setAttribute('viewBox', '0 0 200 200');
    }
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateResponsiveLayout, 60);
});

window.addEventListener('orientationchange', () => {
    setTimeout(updateResponsiveLayout, 100);
});