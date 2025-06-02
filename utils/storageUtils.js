const PA_DOWNLOADED_KEYS = "downloaded_pa_keys";

// in-memory cache of processed states
// tracks which PA IDs have been encountered in this session,
// and whether they’re “downloaded” or not.
const processedPA = new Map();   // pa_id => { downloaded: boolean }
const ignoredPA = new Set();     // pa_ids to permanently skip
const downloadTrigger = new Map(); // pa_id => { triggered: boolean }

/**
    * fetch the “downloaded_pa_keys” object from chrome.storage.local.
    * if not set, returns an empty object.
*/
export async function getDownloadedPAKeys() {
    const result = await chrome.storage.local.get(PA_DOWNLOADED_KEYS);
    return result[PA_DOWNLOADED_KEYS] || {};
}

/**
    * mark a pa_id as downloaded in both in-memory state and local storage.
*/
export async function markPAAsDownloaded(pa_id) {
    // in-memory
    if (processedPA.has(pa_id)) {
        processedPA.get(pa_id).downloaded = true;
    } else {
        processedPA.set(pa_id, { downloaded: true });
    }

    // local
    const keys = await getDownloadedPAKeys();
    keys[pa_id] = true;
    await chrome.storage.local.set({ [PA_DOWNLOADED_KEYS]: keys });
}

/**
    * check if a pd_id is already downloaded (in-memory or in stored keys).
*/
export async function hasPADownloaded(pa_id) {
    // if in-memory state says “downloaded”
    if (processedPA.has(pa_id) && processedPA.get(pa_id).downloaded) {
        return true;
    }

    // or if local storage says so
    const keys = await getDownloadedPAKeys();
    return Boolean(keys[pa_id]);
}

/**
    * mark this PA ID to prevent duplicate download attempts.
    * we'll check downloadTrigger.get(pa_id).triggered before downloading.
*/
export function initDownloadTrigger(pa_id) {
    if (!downloadTrigger.has(pa_id)) {
        downloadTrigger.set(pa_id, { triggered: false });
    }
}

export function getDownloadTrigger(pa_id) {
    return downloadTrigger.get(pa_id) || { triggered: false };
}

export function setDownloadTriggered(pa_id) {
    if (!downloadTrigger.has(pa_id)) {
        downloadTrigger.set(pa_id, { triggered: true });
    } else {
        downloadTrigger.get(pa_id).triggered = true;
    }
}

/**
    * in case we want to permanently skip future handling of certain PAs:
*/
export function ignorePA(pa_id) {
    ignoredPA.add(pa_id);
}

export function isPAIgnored(pa_id) {
    return ignoredPA.has(pa_id);
}

/**
    * If a PA is first encountered, add to processedPA with downloaded=false
*/
export function initProcessedPA(pa_id) {
    if (!processedPA.has(pa_id)) {
        processedPA.set(pa_id, { downloaded: false });
    }
}

/**
 * For testing purposes (remove pa_id)
 */

export function unignorePA(pa_id) {
    ignoredPA.delete(pa_id);
}