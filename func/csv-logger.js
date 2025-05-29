// Keeps a running CSV log of every PA downloaded, stored in chrome.storage,
// and triggers an overwrite download of pa_log.csv each time.

const STORAGE_KEY = 'pa_csv_log';

// Header line for a new CSV
const CSV_HEADER = [
    'pa_id',
    'First Name',
    'Last Name',
    'DOB',
    'Drug',
    'Submitted by',
    'Submitted at',
    'Status',
    'Insurance',
    'Pt Ema ID',
    'Additional Info',
    'NPI'
].join(',') + '\n';

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
        submitted_by,
        insurance,
        patientId,
        npi
    } = paInfo;

    // Format current date as MM/DD/YYYY for the CSV timestamp
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStamp = `${mm}/${dd}/${yyyy}`;

    function escapeCSVField(value) {
        const str = String(value ?? ''); // ensure it's a string
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }
    
    // Build CSV row
    const newRow = [
        `=HYPERLINK("https://dashboard.covermymeds.com/v2/requests/${pa_id}", "${pa_id}")`,
        patient_fname,
        patient_lname,
        patient_dob,
        drug,
        submitted_by,
        dateStamp,
        'Pending',
        insurance,
        `=HYPERLINK("https://khasak.ema.md/ema/web/practice/staff#/practice/staff/patient/${patientId}/chart/overview", "${patientId}")`,
        '', // blank space for additional info
        npi
    ].map(escapeCSVField).join(',') + '\n';

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
    // try {
    //     await appendRowToSheet(sheetRow);
    //     console.log('[Sheets] row appended');
    // } catch (e) {
    //     console.error('[Sheets] append failed:', e);
    // }
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