// Loads the tax data JSON files for a given year (and caches them).

const DATA_ROOT = new URL('./data/', import.meta.url);
const cache = new Map();

async function fetchJson(path) {
    const response = await fetch(new URL(path, DATA_ROOT));
    if (!response.ok) throw new Error(`Couldn't load ${path} (HTTP ${response.status})`);
    return response.json();
}

/** @returns {Promise<{ defaultYear: number, years: number[] }>} */
export function loadManifest() {
    return fetchJson('index.json');
}

/** @returns {Promise<{ year: number, federal: object, states: object }>} */
export function loadTaxYear(year) {
    if (!cache.has(year)) {
        const request = Promise.all([
            fetchJson(`${year}/federal.json`),
            fetchJson(`${year}/states.json`)
        ]).then(([federal, statesFile]) => ({ year, federal, states: statesFile.states }));
        // Don't cache failures, so a retry can succeed once the network is back.
        request.catch(() => cache.delete(year));
        cache.set(year, request);
    }
    return cache.get(year);
}
