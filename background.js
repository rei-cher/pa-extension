import { getPAInfo } from "./func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";
import { uploadPdf } from "./func/pt-ema-upload.js";
import { logPaDownload } from "./func/csv-logger.js";


// Utilities
const processedPA = new Map(); // pa_id => { downloaded: boolean }
const processingPA = new Set();

function getTodayDay(){
    const today = new Date()
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    return formattedDate;
}

function skipPA(pa_info) {
    const {
        epa_status, 
        workflow_status,
        status_dialog,
        status_dialog_loading
    } = pa_info;

    // status_dialog_loading.includes("is unable to respond with clinical questions")
    // status_dialog.includes("You may close this dialog and return to your dashboard to perform other")
}

setInterval(() => {
    console.log("===Processed PAs===");
    for (const [pa_id, state] of processedPA.entries()){
        console.log(`PA id: ${pa_id}: downloaded - ${state.downloaded}`);
    }
}, 30000)

async function handlePARequest(details) {
    // Extract PA ID from URL
    let pa_id;
    if (
        details.url.includes('dashboard.covermymeds.com/api/requests/') ||
        details.url.includes('www.covermymeds.com/request/faxconfirmation/')
    ) {
        const parts = details.url.split('/');
        pa_id = parts[5].split('?')[0];
    }

    if (!pa_id || processingPA.has(pa_id)) return;

    const state = processedPA.get(pa_id);
    if (state?.downloaded) {
        console.log(`[PA ${pa_id}] Ignored`);
        return;
    }

    processingPA.add(pa_id);

    try {
        // Add to processedPA if not tracked yet
        if (!processedPA.has(pa_id)) {
            processedPA.set(pa_id, { downloaded: false });
        }

        const pa_info = await getPAInfo(pa_id);
        const {
            patient_fname,
            patient_lname,
            patient_dob,
            drug,
            submitted_by,
            epa_status,
            workflow_status,
            submitted_by_user_category,
            completed,
            status_dialog,
            status_dialog_loading,
            sent
        } = pa_info;

        console.log("Processing PA:", pa_id, patient_fname, patient_lname, drug);

        const isUploadCase =
            epa_status === "PA Request - Sent to Plan" ||
            details.url.includes(`faxconfirmation/${pa_id}`);

        const isTerminalCase =
            epa_status === "PA Response" ||
            (workflow_status === "Sent to Plan" && !sent.includes(getTodayDay())) ||
            workflow_status === "Archived" ||
            (epa_status === "Question Response" && completed !== "false") ||
            (epa_status === "PA Request - Sent to Plan" && status_dialog_loading.length);

        if (!processedPA.get(pa_id).downloaded && isUploadCase && !isTerminalCase) {
            const downloadId = await downloadPA(pa_id, patient_fname, patient_lname, drug);
            const filepath = await waitForDownloadFilename(downloadId);
            console.log(`[PA ${pa_id}] Downloaded file path:`, filepath);

            
            const matches = await findEmaPatient(patient_dob, patient_fname, patient_lname);
            // if (isUploadCase) {
            console.log("Ema Patient:", matches);
            
            if (matches?.length) {
                const { id: patientId } = matches[0];
                console.log(`[PA ${pa_id}] Uploading PDF for patientId=${patientId}`);
                
                // check if the pa download status is not true
                // if not, then log to csv, otherwise - skip
                if (processedPA.get(pa_id).downloaded != true) {
                    await logPaDownload({ pa_id, patient_fname, patient_lname, patient_dob, drug, submitted_by, patientId });
                }
                
                // Mark as downloaded
                processedPA.get(pa_id).downloaded = true;

                let emaTabId = null;
                try {
                    const tabs = await chrome.tabs.query({});
                    const emaTab = tabs.find(t => t.url?.includes('ema.md'));
                    if (emaTab) {
                        emaTabId = emaTab.id;
                        console.log(`[PA ${pa_id}] Found EMA tab ID:`, emaTabId);
                    }
                } catch (tabErr) {
                    console.error(`[PA ${pa_id}] Error finding EMA tab:`, tabErr);
                }

                if (emaTabId) {
                    // try {
                        const resp = await fetch(
                            `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`,
                            { credentials: 'include' }
                        );
                        if (!resp.ok) throw new Error(`PDF fetch failed: ${resp.statusText}`);

                        const pdfBlob = await resp.blob();
                        const fileName = `${patient_fname}-${patient_lname}-${drug}.pdf`;
                        const fileObj = new File([pdfBlob], fileName, { type: 'application/pdf' });

                        const dtoList = [{
                            patient: { id: String(patientId), lastName: patient_lname, firstName: patient_fname },
                            additionalInfo: { performedDate: new Date().toISOString() },
                            fileName: fileObj.name,
                            title: `${drug} pa submitted: ${new Date().toLocaleDateString()}`
                        }];

                        const uploadResult = await uploadPdf(emaTabId, dtoList, fileObj);
                        console.log(`[PA ${pa_id}] EMA upload result:`, uploadResult);
                    // } catch (uploadErr) {
                    //     console.error(`[PA ${pa_id}] Upload error:`, uploadErr);
                    // }
                }
            }
        }
        else {
            return;
        }
    } catch (error) {
        console.error(`[PA ${pa_id}] Error:`, error);
    } finally {
        processingPA.delete(pa_id);
    }
}

// Listener for PA requests
chrome.webRequest.onCompleted.addListener(
    handlePARequest,
    { urls: ["*://*.covermymeds.com/*"] }
);

// Optional: manually trigger for testing
export async function pdfManipulation(pa_id) {
    try {
        const pa_info = await getPAInfo(pa_id);
        const { patient_fname, patient_lname, drug } = pa_info;

        const downloadId = await downloadPA(pa_id, patient_fname, patient_lname, drug);
        const filepath = await waitForDownloadFilename(downloadId);
        console.log(`[Manual] PDF path:`, filepath);
    } catch (error) {
        console.error(`[Manual] Error in pdfManipulation for PA ID ${pa_id}:`, error);
    }
}
