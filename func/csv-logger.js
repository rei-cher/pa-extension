/** @type {FileSystemFileHandle} */
let fileHandle = null;

/**
    * Call this once (from background.js) after the user picks a file.
*/
export function setFileHandle(handle) {
    fileHandle = handle;
    console.log('[CSV Logger] handle set:', handle);
}


// ensure header exists
async function ensureHeader() {
    if (!fileHandle) throw new Error('No file handle set!');
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text.startsWith('PA ID,')) {
        // prepend header if missing
        const writable = await fileHandle.createWritable({ keepExistingData: false });
        await writable.write(
            'PA ID,First Name,Last Name,DOB,Drug,Date Submitted,Status,Submitted By\n' +
            text
        );
        await writable.close();
    }
}

/**
    * Appends a row to the CSV log file when a PDF is downloaded.
    * @param {Object} data - Patient data to log
    * @param {string} data.pa_id
    * @param {string} data.firstName
    * @param {string} data.lastName
    * @param {string} data.dob
    * @param {string} data.drug
    * @param {string} data.submyted_by
*/

export async function logPA({ pa_id, firstName, lastName, dob, drug, submyted_by}) {
    
    if (!fileHandle) {
        console.error('Cannot logPA() — no file handle set');
        return;
    }

    await ensureHeader();

    // open for appending
    const writable = await fileHandle.createWritable({ keepExistingData: true });
    const file = await fileHandle.getFile();
    await writable.seek(file.size);

    const row = `${pa_id},${firstName},${lastName},${dob},${drug},${new Date().toISOString()},'Pending',${submyted_by}\n`;
    
    await writable.write(row);
    await writable.close();
}