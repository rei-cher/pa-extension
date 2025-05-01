import { getCookie } from "./func/cmm-cookie.js";
import { getPAInfo } from "./func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";

// Utility function to convert file to base64 (not used in this code but might be useful)
const fileToBase64 = file =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(",")[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

const processedPA = new Set();
const processingPA = new Set();

// handle function to listen and download pa 
function handlePARequest(details) {
    let pa_id;
    if (
        details.url.includes('dashboard.covermymeds.com/api/requests/') || 
        details.url.includes('www.covermymeds.com/request/faxconfirmation/')
    ) {
        // extracting pa id
        const url_parts = details.url.split('/');
        pa_id = url_parts[5];
        if (pa_id.includes("?")) {
            pa_id = pa_id.split("?")[0];
        }
    }

    if (!pa_id || processedPA.has(pa_id) || processingPA.has(pa_id)) {
        return;
    }

    processingPA.add(pa_id);

    // getting pa info
    getPAInfo(pa_id)
        .then((pa_info) => {
            const patient_fname = pa_info.patient_fname;
            const patient_lname = pa_info.patient_lname;
            const patient_dob = pa_info.patient_dob;
            const drug = pa_info.drug;
            const submitted_by = pa_info.submitted_by;
            const epa_status = pa_info.epa_status;

            console.log(patient_fname, patient_lname, drug);
            console.log("Submitted by: ", submitted_by);
            console.log("ePA status: ", epa_status);
            console.log("Details: ", details);

            if (
                epa_status === "PA Request - Sent to Plan" ||
                details.url.includes(`covermymeds.com/request/faxconfirmation/${pa_id}`)
            ) {
                processedPA.add(pa_id);

                downloadPA(pa_id, patient_fname, patient_lname, drug)
                    .then(downloadedID => {
                        return waitForDownloadFilename(downloadedID);
                    })
                    .then(filepath => {
                        console.log("PDF path: ", filepath);
                        // stop listening after one successful case
                        console.log("Listener removed.");

                        // Update history in storage
                        chrome.storage.local.get(['downloadHistory'], result => {
                            let history = result.downloadHistory || [];
                            history.unshift(filepath); // add to front
                            history = history.slice(0, 10); // keep only last 10
                            chrome.storage.local.set({ downloadHistory: history });
                        });
                    });
            }
        })
        .catch(error => {
            console.error(`Error processing pa ${pa_id}: `, error)
        })
        .finally(() => {
            processingPA.delete(pa_id);
        })
}

// Attach the listener for API responses from the dashboard
chrome.webRequest.onCompleted.addListener(
    handlePARequest,
    { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);

function pdfManipulation(pa_id) {
    getPAInfo(pa_id).then((pa_info) => {
        const patient_fname = pa_info.patient_fname;
        const patient_lname = pa_info.patient_lname;
        const patient_dob = pa_info.patient_dob;
        const drug = pa_info.drug;
        const submitted_by = pa_info.submitted_by;
        const epa_status = pa_info.epa_status;

        console.log(patient_fname, patient_lname, drug);

        // TODO: sanitize patietn names and dob
        // dob should be stored in safeDOB as mm-dd-yyyy
        // check if any name is a compound, then split with '-'

        // download PA
        downloadPA(pa_id, patient_fname, patient_lname, drug)
            .then(downloadedID => {
                // waiting for download to complete and get a filepath
                return waitForDownloadFilename(downloadedID);
            })
            .then(filepath => {
                console.log("PDF path: ", filepath);
            })
    });
}
