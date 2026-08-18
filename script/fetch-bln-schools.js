const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.bildung.berlin.de/Schulverzeichnis/';
const USER_AGENT = 'SchoolSpeedLimitBot/1.1 (thomas@tursics.de)';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function stripSpan(text, id) {
    let textArray = text.split(id);
    textArray.shift();

    textArray = textArray.map((str) => {
        let arr = str.split('>');
        arr.shift();
        return arr.join('>').split('</span')[0];
    });

    return textArray[0];
}

function stripHREF(text, id) {
    let textArray = text.split(id);
    textArray.shift();

    if (textArray.length !== 1) {
        return '';
    }

    let linkList = textArray[0].split(' href="');
    linkList.shift();
    linkList = linkList.map((str) => {
        return str.split('"')[0];
    });

    return linkList[0] || '';
}

function stripData(text, name) {
    let dataArray = text.split(`data-${name}="`);
    dataArray.shift();
    dataArray = dataArray.map((str) => {
        return str.split('"')[0];
    });

    let data = dataArray[0] || '';
    data = data.replaceAll('&quot;', '"');

    return JSON.parse(data);
}

async function downloadMapLocation(url) {
    url = url.replaceAll('&amp;', '&');
    url = url.replace('/?', '/fullscreen?');

    const response = await fetch(url, {
        method: 'GET',
        headers: {
//            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    const mapOptions = stripData(data, 'map-options');
console.log(mapOptions);

    return [
        parseFloat(mapOptions.center.coordinatesWgs84[0]),
        parseFloat(mapOptions.center.coordinatesWgs84[1])
    ];
}

function fakeDownloadMapLocation() {
    return [
        13.409779,
        52.520645
    ];
}

async function downloadSchoolData(url) {
    const response = await fetch(`${BASE_URL}${url}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.text();

    let common = data.split('<div id="divAllgemein"');
    common.shift();
    common = common.map((str) => {
        let arr = str.split('>');
        arr.shift();
        return arr.join('>').split('</div')[0];
    });
    if (common.length !== 1) {
        throw new Error(`HTML page ${BASE_URL}${url} not well formed`);
    }
    common = common[0];

    let additions = data.split('<span id="ContentPlaceHolderMenuListe_lblZusatz"');
    additions.shift();
    additions = additions.map((str) => {
        let arr = str.split('>');
        arr.shift();
        return arr.join('>').split('</span')[0];
    });

    let title = stripSpan(common, 'ContentPlaceHolderMenuListe_lblSchulname');
    const type = stripSpan(common, 'ContentPlaceHolderMenuListe_lblSchulart');
    const street = stripSpan(common, 'ContentPlaceHolderMenuListe_lblStrasse');
    let city = stripSpan(common, 'ContentPlaceHolderMenuListe_lblOrt');
    const mapURL = stripHREF(common, 'ContentPlaceHolderMenuListe_HLinkStadtplan').trim();
//    const location = await downloadMapLocation(mapURL);
    const location = await fakeDownloadMapLocation();

    let titleSplit = title.split('-');
    const bsn = titleSplit.pop().trim();
    title = titleSplit.join('-').trim();

    let citySplit = city.split('(');
    city = citySplit.shift().trim();
    const district = citySplit.length === 0 ? '' : citySplit[0].split(')')[0].trim();
    citySplit = city.split(' ');
    const zip = citySplit.shift().trim();
    city = citySplit.join(' ').trim();

    return {
        title,
        ref: bsn,
        type,
        street,
        zip,
        city,
        district,
        center: location,
        additions
    };
}

function fakeDownloadSchoolData() {
    return {
        title: '',
        ref: '',
        type: '',
        street: '',
        zip: '',
        city: 'Berlin',
        district: '',
        center: fakeDownloadMapLocation(),
        additions: ''
    };
}

async function downloadBerlinData() {
    console.log('Download school data from Berlin...');

    try {
        const response = await fetch(`${BASE_URL}SchulListe.aspx`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': USER_AGENT
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.text();

        let tableList = data.split('<table');
        tableList.shift();
        tableList = tableList.map((str) => {
            return str.split('</table')[0];
        });
        if (tableList.length !== 2) {
            throw new Error('HTML page must have 2 tables');
        }

        let linkList = tableList[1].split(' href="');
        linkList.shift();
        linkList = linkList.map((str) => {
            return str.split('"')[0];
        });

        let features = [];
        for (var i = 0; i < linkList.length; ++ i) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Fetch school ${i + 1} of ${linkList.length}`);

            const link = linkList[i];
            const properties = await downloadSchoolData(link);
            await sleep(100);

            features.push({
                type: 'Feature',
                properties,
                geometry: {
                    type: 'Point',
                    coordinates: properties.center
                }
            });
        }
        console.log('');

        const geojson = {
            type: 'FeatureCollection',
            name: 'Berlin_Schools',
            features: features
        };

        const dir = './data';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, 'bln-schools.geojson');
        fs.writeFileSync(filePath, JSON.stringify(geojson, null, 2));

        console.log(`Done: ${linkList.length} school objects saved in '${filePath}'.`);
    } catch (error) {
        console.error('Fetch failed:', error.message);
        console.error(error);
    }
}

downloadBerlinData();