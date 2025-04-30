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

// Listen for API responses from the dashboard
chrome.webRequest.onCompleted.addListener(
    (details) => {
        const url_parts = details.url.split('/');  // Extract PA ID from the API URL
        let pa_id = url_parts[5];
        if (pa_id.includes("?")) {
            pa_id = pa_id.split("?")[0];
        }
        console.log("PA ID: ", pa_id);
        console.log("Details object: ", details);

        // Check if the URL is the expected one and response is valid
        if (
            details.url.includes(`dashboard.covermymeds.com/api/requests/${pa_id}?type=Web%20Socket`) ||
            details.url.includes(`dashboard.covermymeds.com/api/requests/${pa_id}?type=Elapsed%20Time`) ||
            details.url.includes(`covermymeds.com/request/faxconfirmation/${pa_id}`)
        ) {
            pdfManipulation(pa_id);
        }
    },
    // listen to the responses on those 2 pages for status updates on PAs
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
