import { getPAInfo } from "./func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";
import { uploadPdf } from "./func/pt-ema-upload.js";

// Utilities
const processedPA = new Set();
const processingPA = new Set();

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

    if (!pa_id || processedPA.has(pa_id) || processingPA.has(pa_id)) return;
    processingPA.add(pa_id);

    try {
        // Fetch PA info
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
            completed
        } = pa_info;

        console.log(patient_fname, patient_lname, drug);
        console.log("Submitted by:", submitted_by);
        console.log("ePA status:", epa_status);
        console.log("Details:", details);

        if (
            epa_status === "PA Request - Sent to Plan" ||
            details.url.includes(`faxconfirmation/${pa_id}`)
        ) {
            // Mark as processed
            processedPA.add(pa_id);

            // Download and wait for file
            const downloadId = await downloadPA(pa_id, patient_fname, patient_lname, drug);
            
            let filepath;
            
            try{
                filepath = await waitForDownloadFilename(downloadId);
                console.log("Download completed");
            }
            catch (error) {
                console.error("Error downloading: ", error);
            }

            console.log("PDF path:", filepath);
            console.log("Listener removed.");

            // Update download history (keep last 10)
            // await new Promise(resolve => {
            //     chrome.storage.local.get(['downloadHistory'], result => {
            //         let history = result.downloadHistory || [];
            //         history.unshift(filepath);
            //         history = history.slice(0, 10);
            //         chrome.storage.local.set({ downloadHistory: history }, resolve);
            //     });
            // });

            // Find EMA patient
            const matches = await findEmaPatient(patient_dob, patient_fname, patient_lname);
            console.log("Ema Patient:", matches);

            // Upload to found patient in ema
            if (matches && matches.length) {
                const { id: patientId } = matches[0];
                console.log(`[PA ${pa_id}] uploading PDF for patientId=${patientId}`);

                let emaTabId = null;
                // find ema tab id
                try {
                    const tabs = await chrome.tabs.query({});
                    const emaTab = tabs.find(t => t.url && t.url.includes('ema.md'));
                    if (emaTab) {
                        emaTabId = emaTab.id;
                        console.log(`[PA ${pa_id}] Found EMA tab ID:`, emaTabId);
                    } else {
                        console.warn(`[PA ${pa_id}] No EMA tab found`);
                    }
                } catch (tabErr) {
                    console.error(`[PA ${pa_id}] Error finding EMA tab:`, tabErr);
                }

                // upload only if emaTabId exists
                if (emaTabId){
                    try {
                        // Fetch PDF again over HTTPS (avoiding file://)
                        console.log(`[PA ${pa_id}] fetching PDF over network for upload`);
                        const resp = await fetch(
                            `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`,
                            { credentials: 'include' }
                        );
    
                        if (!resp.ok) {
                            throw new Error(`PDF fetch failed ${resp.status}: ${resp.statusText}`);
                        }
    
                        const pdfBlob = await resp.blob();
                        const fileName = `${patient_fname}-${patient_lname}-${drug}.pdf`;
                        const fileObj = new File([pdfBlob], fileName, { type: 'application/pdf' });
    
                        const dtoList = [{
                            patient: { id: patientId, lastName: patient_lname, firstName: patient_fname },
                            additionalInfo: { performedDate: new Date().toISOString() },
                            fileName: fileObj.name,
                            title: `${drug} pa submitted: ${new Date().toLocaleDateString()}`
                        }];
    
                        console.log(`[PA ${pa_id}] uploading to EMA for patient ${patientId}`);
                        const uploadResult = await uploadPdf(
                            emaTabId, dtoList, fileObj
                        );
    
                        console.log(`[PA ${pa_id}] EMA upload result:`, uploadResult);
                    } catch (fileErr) {
                        console.error(`[PA ${pa_id}] local file→EMA error:`, fileErr);
                    }
                }
            }
        }
        else if (
            epa_status === "PA Response" ||
            (epa_status === "Question Response" && completed !== "false") ||
            workflow_status === "Sent to Plan"
        ) {
            processedPA.add(pa_id);
        }
    }
    catch (error) {
        console.error(`Error processing pa ${pa_id}:`, error);
    }
    finally {
        processingPA.delete(pa_id);
    }
}

// Listener for API responses
chrome.webRequest.onCompleted.addListener(
    handlePARequest,
    { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);

// Monitor history-state updates for faxconfirmation routes
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    const match = details.url.match(/faxconfirmation\/([^/?#]+)/);
    if (match) {
        const pa_id = match[1];
        if (!processedPA.has(pa_id) && !processingPA.has(pa_id)) {
            console.log("Detected faxconfirmation URL change for PA ID:", pa_id);
            handlePARequest({ url: details.url, tabId: details.tabId });
        }
    }
}, {
    url: [{ urlMatches: "https://www.covermymeds.com/request/faxconfirmation/" }]
});

// Standalone PDF manipulation utility
export async function pdfManipulation(pa_id) {
    try {
        const pa_info = await getPAInfo(pa_id);
        const { patient_fname, patient_lname, patient_dob, drug, submitted_by, epa_status } = pa_info;
        console.log(patient_fname, patient_lname, drug);

        const downloadId = await downloadPA(pa_id, patient_fname, patient_lname, drug);
        const filepath = await waitForDownloadFilename(downloadId);
        console.log("PDF path:", filepath);
    }
    catch (error) {
        console.error(`Error in pdfManipulation for PA ID ${pa_id}:`, error);
    }
}
