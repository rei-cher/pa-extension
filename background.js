import { getCookie } from "./func/cmm-cookie.js";
import { getPatientInfo } from "./func/pt-pa-info.js";
import { downloadPA } from "./func/pa-downloader.js";
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
            details.url === `https://dashboard.covermymeds.com/api/requests/${pa_id}?type=Web%20Socket` ||
            details.url === `https://dashboard.covermymeds.com/api/requests/${pa_id}?type=Elapsed%20Time`
        ) {
            // Check if response contains 'ePa_Status_description' with the value 'PA Request - Sent to Plan'
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: checkStatusAndDownload,
                    args: [pa_id]  // Pass PA ID to the script
                });
            });
        }

        // check is the page changed to the fax confirmation page
        else if (details.url.includes(`covermymeds.com/request/faxconfirmation/${pa_id}`)){
            // get the patient info to pass to downloadPA
            // TODO: use this info to find a patient in ema and upload downloaded pdf to that patient's page
            getPatientInfo(pa_id).then((patient_info) => {
                const patient_fname = patient_info.patient_fname;
                const patient_lname = patient_info.patient_lname;
                const patient_dob = patient_info.patient_dob;
                const drug = patient_info.drug;

                console.log(patient_fname, patient_lname, drug);

                // TODO: sanitize patietn names and dob
                // dob should be stored in safeDOB as mm-dd-yyyy
                // check if any name is a compound, then split with '-'

                // download PA
                downloadPA(pa_id, patient_fname, patient_lname, drug);
            })
        }
    },
    // listen to the responses on those 2 pages for status updates on PAs
    { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);

// Function to check response data and trigger download if needed
function checkStatusAndDownload(pa_id) {
    console.log("checkStatusAndDownload called");
    console.log("window.data: ", window.data);

    // Example of how to check the page's data (replace this with your logic to get the API response)
    if (window.data && window.data.ePa_Status_description === 'PA Request - Sent to Plan') {
        console.log('Found matching status in API response, triggering download');
    }
}
