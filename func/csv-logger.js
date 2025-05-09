// Keeps a running CSV log of every PA downloaded, stored in chrome.storage,
// and triggers an overwrite download of pa_log.csv each time.

const STORAGE_KEY = 'pa_csv_log';

const SPREADSHEET_ID = '1NvSE5xwn5TM1iy_PXK-_ckk3F7-LZ3ksdHvNlOaY1es';
const SHEET_NAME = 'PA Status';

// Header line for a new CSV
const CSV_HEADER = [
    'pa_id',
    'First Name',
    'Last Name',
    'DOB',
    'Drug',
    'Submitted by',
    'Submitted at',
    'Status'
].join(',') + '\n';


// OAuth2 token for Sheets API
function getSheetsToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, token => {
        if (chrome.runtime.lastError || !token) {
            return reject(chrome.runtime.lastError);
        }
        resolve(token);
        });
    });
}

async function appendRowToSheet(rowValues) {
    const token = await getSheetsToken();

    // just the header cell
    const range = `'${SHEET_NAME}'!A1`;

    // encode everything, then make sure ' and ! are escaped
    const encodedRange = encodeURIComponent(range);

    const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:append` +
        `?valueInputOption=RAW` +
        `&insertDataOption=INSERT_ROWS` +
        `&range=${encodedRange}`;

    const body = { values: [ rowValues ] };
  
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify(body)
    });
  
    // grab the raw text so we can inspect HTML or JSON
    const text = await resp.text();
    const contentType = resp.headers.get('content-type') || '';

    if (!resp.ok) {
        console.error('[Sheets] bad response:', resp.status, resp.statusText, '\n', text);
        throw new Error(`Sheets API returned HTTP ${resp.status}`);
    }

    if (contentType.includes('application/json')) {
        return JSON.parse(text);
    } 
    else {
        console.error('[Sheets] unexpected content-type:', contentType, '\n', text);
        throw new Error('Sheets API returned non‑JSON response (see console for HTML)');
    }
}

/**
     * Append one new row of PA info to the CSV log and trigger a download.
     * @param {Object} paInfo – the object returned by getPAInfo()
*/
export async function logPaDownload(paInfo) {
    const {
        pa_id,
        patient_fname,
        patient_lname,
        patient_dob,
        drug,
        submitted_by
    } = paInfo;

    // Format current date as MM/DD/YYYY for the CSV timestamp
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStamp = `${mm}/${dd}/${yyyy}`;

    // Build CSV row
    const newRow = [
        pa_id,
        patient_fname,
        patient_lname,
        patient_dob,
        drug,
        submitted_by,
        dateStamp,
        'Pending'
    ].join(',') + '\n';

    // Retrieve existing CSV or start with header
    const { pa_csv_log = CSV_HEADER } = await chrome.storage.local.get(STORAGE_KEY);

    // Append new row
    const updatedCsv = pa_csv_log + newRow;

    // Save back to storage
    await chrome.storage.local.set({ [STORAGE_KEY]: updatedCsv });

    // Trigger download of the updated CSV
    await exportCsvLog(updatedCsv);

    // Prepare row for Sheets
    const sheetRow = [
        pa_id,
        patient_fname,
        patient_lname,
        patient_dob,
        drug,
        submitted_by,
        dateStamp,
        'Pending'
    ];
    try {
        await appendRowToSheet(sheetRow);
        console.log('[Sheets] row appended');
    } catch (e) {
        console.error('[Sheets] append failed:', e);
    }
}

/**
    * Download a given CSV string (or read from storage) as pa_log.csv
    * Uses a data URI to support Service Worker contexts.
    * @param {string} [csvString] – optional CSV content to download
*/
export async function exportCsvLog(csvString) {
    const { pa_csv_log = CSV_HEADER } = await chrome.storage.local.get(STORAGE_KEY);
    const content = csvString || pa_csv_log;

    // Encode as URI component to create a data URL
    const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);

    chrome.downloads.download({
        url: dataUrl,
        filename: 'pa_log.csv',
        conflictAction: 'overwrite',
        saveAs: false
    }, downloadId => {
        console.log('[CSV Logger] download triggered:', downloadId);
    });
}