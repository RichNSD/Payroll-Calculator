// Auto-save to this device. localStorage can throw (private mode, blocked
// storage, quota), so every access is guarded and the app still works without it.

export const STORAGE_KEY = 'payrollCalcState';
export const THEME_KEY = 'payrollCalcTheme';
const LEGACY_COOKIE_KEY = 'payrollCalcCookie';
const STATE_VERSION = 2;

function safeGet(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSet(key, value) {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function safeRemove(key) {
    try {
        window.localStorage.removeItem(key);
    } catch {
        /* storage unavailable: nothing to remove */
    }
}

/**
 * The original version also stuffed the whole state into a base64 cookie
 * (which broke on emoji and could blow past the 4KB cookie limit).
 * Read it once for migration, then delete it.
 */
function readLegacyCookie() {
    const entry = document.cookie.split('; ').find(row => row.startsWith(`${LEGACY_COOKIE_KEY}=`));
    if (!entry) return null;
    document.cookie = `${LEGACY_COOKIE_KEY}=; max-age=0; path=/`;
    try {
        return JSON.parse(atob(entry.slice(LEGACY_COOKIE_KEY.length + 1)));
    } catch {
        return null;
    }
}

export function loadState() {
    const legacy = readLegacyCookie();
    const stored = safeGet(STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }
    return legacy;
}

/** @returns {boolean} whether the save actually persisted */
export function saveState(state) {
    return safeSet(STORAGE_KEY, JSON.stringify({ ...state, version: STATE_VERSION }));
}

export function clearState() {
    safeRemove(STORAGE_KEY);
    safeRemove(THEME_KEY);
    document.cookie = `${LEGACY_COOKIE_KEY}=; max-age=0; path=/`;
}

export function loadTheme() {
    return safeGet(THEME_KEY);
}

export function saveTheme(theme) {
    safeSet(THEME_KEY, theme);
}
