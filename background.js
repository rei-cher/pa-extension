import { getPAInfo } from "./func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";
import { uploadPdf } from "./func/pt-ema-upload.js";
import { logPaDownload } from "./func/csv-logger.js";


// Utilities
const processedPA = new Map(); // pa_id => { downloaded: boolean }
const processingPA = new Set();
const ignoredPA = new Set();
const download_trigger = new Map(); // map for download triggers to avoid dublicate downloads

const PA_DONWLOADED_KEYS = "downloaded_pa_keys";

function getTodayDay(){
    const today = new Date()
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    return formattedDate;
}

// TODO: maybe not necessary
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
    console.log("=============\n\nDetails:\n\n", details,"\n\n=============")
    console.log(`=============\n\n${details.url}\n\n=============`)
    const url = details?.url;
    const source = details.source;

    // force download if webNavigation is faxconfirmation
    if (source === 'webNavigation' && url.includes('/request/faxconfirmation/')){
        console.log('[handlePARequest] forced upload on faxconfirmation navigation');
        const pa_id = extractPAIdFromUrl(url);

        download_trigger.set(pa_id, {triggered: false})

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

        if (!download_trigger.get(pa_id).triggered){
            const downloadId = await downloadPA(pa_id, patient_fname, patient_lname, drug);
            download_trigger.get(pa_id).triggered = true;
        }

        console.log(`[PA Trigger status] PA ${pa_id} - ${download_trigger.get(pa_id).triggered}`)
        const filepath = await waitForDownloadFilename(downloadId);
        console.log(`[PA ${pa_id}] Downloaded file path:`, filepath);

        const matches = await findEmaPatient(patient_dob, patient_fname, patient_lname);

        if (matches?.length) {
            const { id: patientId } = matches[0];
            console.log(`[PA ${pa_id}] Uploading PDF for patientId=${patientId}`);
            
            // check if the pa download status is not true
            // if not, then log to csv, otherwise - skip
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
            
            // Mark as downloaded
            processedPA.get(pa_id).downloaded = true;

            // Add the new pa_id
            downloaded_pa_keys[pa_id] = true;

            // Save it back to storage
            await chrome.storage.local.set({ [PA_DONWLOADED_KEYS]: downloaded_pa_keys });
        }
        else {
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
            
            // Mark as downloaded
            processedPA.get(pa_id).downloaded = true;

            // Add the new pa_id
            downloaded_pa_keys[pa_id] = true;

            // Save it back to storage
            await chrome.storage.local.set({ [PA_DONWLOADED_KEYS]: downloaded_pa_keys });
        }

        return;
    }

    // console.warn("[background.js] Details url: ", details.url);
    // Extract PA ID from URL
    let pa_id;
    if (
        url.includes('dashboard.covermymeds.com/api/requests/') ||
        url.includes('www.covermymeds.com/request/faxconfirmation/')
    ) {
        const parts = details.url.split('/');
        pa_id = parts[5].split('?')[0];
        console.log(`[handlePARequest] (${source}) Extracted PA ID: ${pa_id}`);
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
            download_trigger.set(pa_id, {triggered: false});
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

        console.warn("==========\nDetails before checking the isUploadCase: ", details)
        console.warn(`==========\nURL before checking the isUploadCase: ${details.url}`)
        const isUploadCase =
            (epa_status_description === "PA Request - Sent to Plan" && sent?.includes(getTodayDay())) ||
            url.includes(`faxconfirmation`);

        
        const isTerminalCase =
            ["Unknown", "Favorable", "Unfavorable"].includes(request_outcome) ||
            (workflow_status === "Sent to Plan" && !sent.includes(getTodayDay())) ||
            (epa_status_description?.includes("PA Request - Sent to Plan") && !sent?.includes(getTodayDay()) )

        if (isTerminalCase) {
            console.log(`========== [PA ${pa_id}] Terminal case — skipping future ==========`);
            // TODO: stop listening to this pa_id
            ignoredPA.add(pa_id);
            return;
        }

        console.log(`========\nChecking isUploadCase: epa_status=${epa_status}, url=${url}\n=======`);
            
        console.log(`========\nStatuses: isUploadCase - ${isUploadCase}, isTerminalCase - ${isTerminalCase}\n========`)
                
        console.log("[backgound.js] PA INFO: ",pa_info);
        console.log("Processing PA:", pa_id, patient_fname, patient_lname, drug);
        console.log(`==========\nStatuses pre-if statement:\nprocessedPA.get(pa_id).downloaded - ${processedPA.get(pa_id).downloaded}\ndownloaded_pa_keys[pa_id] - ${downloaded_pa_keys[pa_id]}\nisUploadCase - ${isUploadCase}\n==========`)
        let overall_status = (!processedPA.get(pa_id).downloaded || !downloaded_pa_keys[pa_id]) && isUploadCase && !download_trigger.get(pa_id).triggered
        console.log(`==========\n Overall status - ${overall_status} \n==========`)

        // check if either - downloaded is false or pa is not in downloaded pa keys set
        // and this is an upload case and download for pa was not triggered yet
        if ((!processedPA.get(pa_id).downloaded || !downloaded_pa_keys[pa_id]) && isUploadCase && !download_trigger.get(pa_id).triggered) {
            console.log("==========\nInside the if statement with conditional check\n==========");
            const downloadId = await downloadPA(pa_id, patient_fname, patient_lname, drug);

            // set downloaded triggere for pa as true to avoid repited downloads
            download_trigger.get(pa_id).triggered = true;
            console.log(`[PA Trigger status] PA ${pa_id} - ${download_trigger.get(pa_id).triggered}`)
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
// chrome.webRequest.onCompleted.addListener(
//     handlePARequest,
//     { urls: ["*://*.covermymeds.com/*"] }
// );

function extractPAIdFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        // Example: /request/faxconfirmation/BXBLL2V6
        //          /api/requests/BXBLL2V6
        const parts = pathname.split('/').filter(Boolean);

        // Match known patterns
        if (parts.includes('faxconfirmation') || parts.includes('requests')) {
            return parts[parts.length - 1].split('?')[0];  // Just the PA ID
        }

        return null;
    } catch (err) {
        console.error("Invalid URL in extractPAIdFromUrl:", url);
        return null;
    }
}

chrome.webRequest.onCompleted.addListener(
    async (details) => {
        const { url } = details;
        const pa_id = extractPAIdFromUrl(url);

        if (pa_id && !processingPA.has(pa_id) && (url.includes('/api/requests/') || url.includes('/request/faxconfirmation/') )) {
            console.log(`[webRequest] API request detected for PA ID: ${pa_id}`);
            await handlePARequest({ url, source: 'webRequest' });
        }
    },
    { urls: ["*://*.covermymeds.com/api/requests/*", "*://*.covermymeds.com/request/faxconfirmation/*"] }
);

// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//     if (changeInfo.status === "complete" && tab.url && tab.url.includes('/request/faxconfirmation/')){
//         console.log(`[tabs.onUpdated] Page finished loading faxconfiramtion: ${tab.url}`)
//         handlePARequest({ url: tab.url, source: 'tabs.onUpdated' });
//     }
// });

chrome.webNavigation.onCompleted.addListener(details => {
    const url = details.url;
    console.log(`[webNavigation] Completed: ${url}`);
    if (url.includes('/request/faxconfirmation/')){
        handlePARequest({ url, source: 'webNavigation' });
    }
}, {
    url: [
        {
            hostSuffix: 'covermymeds.com',
            pathContains: '/request/faxconfirmation/'
        }
    ],
    frameId: 0
});
