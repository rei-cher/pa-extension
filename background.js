import { getPAInfo } from "./func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";
import { uploadPdf } from "./func/pt-ema-upload.js";
import { logPaDownload } from "./func/csv-logger.js";


// Utilities
const processedPA = new Map(); // pa_id => { downloaded: boolean }
const processingPA = new Set();
const ignoredPA = new Set();

const PA_DONWLOADED_KEYS = "downloaded_pa_keys";

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
        epa_status_description, 
        workflow_status,
        status_dialog,
        status_dialog_loading
    } = pa_info;

    // Cases when to skip and not listen
    // epa_status_description.includes("Expired")
    // status_dialog_loading.includes("is unable to respond with clinical questions")
    // status_dialog.includes("You may close this dialog and return to your dashboard to perform other")
}

setInterval(() => {
    console.log("===Processed PAs===");
    for (const [pa_id, state] of processedPA.entries()){
        console.log(`PA id: ${pa_id}: downloaded - ${state.downloaded}`);
    }
    console.log("===Skipped PAs===");
    ignoredPA.forEach(pa => {console.log(pa)});
}, 30000)

async function handlePARequest(details) {
    // console.warn("[background.js] Details url: ", details.url);
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

    let downloaded_pa_keys_obj  = await chrome.storage.local.get(PA_DONWLOADED_KEYS);
    const downloaded_pa_keys = downloaded_pa_keys_obj[PA_DONWLOADED_KEYS] || {};


    // skip (don't listen) if the pa_id has 'downloaded = true', it is in ignored list, or it was prev downloaded (in local storage of downloaded pas)
    if (state?.downloaded || ignoredPA.has(pa_id) || downloaded_pa_keys[pa_id]) {
        console.warn(`[PA ${pa_id}] Ignored`);
        return;
    }

    processingPA.add(pa_id);

    try {
        // Add to processedPA if not tracked yet
        if (!processedPA.has(pa_id) && !ignoredPA.has(pa_id)) {
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
            epa_status_description,
            workflow_status,
            submitted_by_user_category,
            completed,
            insurance,
            status_dialog,
            status_dialog_loading,
            sent,
            npi,
            request_outcome
        } = pa_info;

        const isUploadCase =
            epa_status_description === "PA Request - Sent to Plan" ||
            details.url.includes(`faxconfirmation`);

        
        const isTerminalCase =
            ["Unknown", "Favorable", "Unfavorable"].includes(request_outcome) ||
            (workflow_status === "Sent to Plan" && !sent.includes(getTodayDay()))

        if (isTerminalCase) {
            console.log(`========== [PA ${pa_id}] Terminal case — skipping future ==========`);
            // TODO: stop listening to this pa_id
            ignoredPA.add(pa_id);
            return;
        }

        console.log(`========\nChecking isUploadCase: epa_status=${epa_status}, url=${details.url}\n=======`);
            
        console.log(`========\nStatuses: isUploadCase - ${isUploadCase}, isTerminalCase - ${isTerminalCase}\n========`)
                
        console.log("[backgound.js] PA INFO: ",pa_info);
        console.log("Processing PA:", pa_id, patient_fname, patient_lname, drug);
        console.log(`==========\nStatuses pre-if statement:\nprocessedPA.get(pa_id).downloaded - ${processedPA.get(pa_id).downloaded}\ndownloaded_pa_keys[pa_id] - ${downloaded_pa_keys[pa_id]}\nisUploadCase - ${isUploadCase}\n==========`)
        let overall_status = (!processedPA.get(pa_id).downloaded || !downloaded_pa_keys[pa_id]) && isUploadCase
        console.log(`==========\n Overall status - ${overall_status} \n==========`)

        if ((!processedPA.get(pa_id).downloaded || !downloaded_pa_keys[pa_id]) && isUploadCase) {
            console.log("==========\nInside the if statement with conditional check\n==========");
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
                    await logPaDownload({ 
                        pa_id, 
                        patient_fname, 
                        patient_lname, 
                        patient_dob, 
                        drug, 
                        submitted_by,
                        insurance,
                        patientId,
                        npi
                    });
                }
                
                // Mark as downloaded
                processedPA.get(pa_id).downloaded = true;

                // Add the new pa_id
                downloaded_pa_keys[pa_id] = true;

                // Save it back to storage
                await chrome.storage.local.set({ [PA_DONWLOADED_KEYS]: downloaded_pa_keys });

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
                        // const resp = await fetch(
                        //     `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`,
                        //     { credentials: 'include' }
                        // );
                        // if (!resp.ok) throw new Error(`PDF fetch failed: ${resp.statusText}`);

                        // const pdfBlob = await resp.blob();
                        // const fileName = `${patient_fname}-${patient_lname}-${drug}.pdf`;
                        // const fileObj = new File([pdfBlob], fileName, { type: 'application/pdf' });

                        // const dtoList = [{
                        //     patient: { id: String(patientId), lastName: patient_lname, firstName: patient_fname },
                        //     additionalInfo: { performedDate: new Date().toISOString() },
                        //     fileName: fileObj.name,
                        //     title: `${drug} pa submitted: ${new Date().toLocaleDateString()}`
                        // }];

                        // const uploadResult = await uploadPdf(emaTabId, dtoList, fileObj);
                        // console.log(`[PA ${pa_id}] EMA upload result:`, uploadResult);
                    // } catch (uploadErr) {
                    //     console.error(`[PA ${pa_id}] Upload error:`, uploadErr);
                    // }
                }
            }
            else {
                if (processedPA.get(pa_id).downloaded != true) {
                    const temp_pt_id = "";
                    await logPaDownload({ 
                        pa_id, 
                        patient_fname, 
                        patient_lname, 
                        patient_dob, 
                        drug, 
                        submitted_by,
                        insurance,
                        temp_pt_id,
                        npi
                    });
                }
                
                // Mark as downloaded
                processedPA.get(pa_id).downloaded = true;

                // Add the new pa_id
                downloaded_pa_keys[pa_id] = true;

                // Save it back to storage
                await chrome.storage.local.set({ [PA_DONWLOADED_KEYS]: downloaded_pa_keys });
            }
        }
        else {
            return;
        }
    } catch (error) {
        console.error(`[PA ${pa_id}] Error:`, error);
        // ignoredPA.add(pa_id);
    } finally {
        processingPA.delete(pa_id);
    }
}

// Listener for PA requests
chrome.webRequest.onCompleted.addListener(
    handlePARequest,
    { urls: ["*://*.covermymeds.com/*"] }
);

// listener to the tab change
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url && changeInfo.url.includes('faxconfirmation')){
        const details = { url: changeInfo.url };

        console.log(`[tabs.onUpdated] Detected faxconfirmation URL change: ${changeInfo.url}`);
        handlePARequest(details);
    }
})