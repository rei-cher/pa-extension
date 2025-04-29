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

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Wait until the request page is fully loaded
    if (changeInfo.status !== 'complete') return;

    const url = tab.url;
    if (!url.includes('/v2/requests/')) return;

    const pa_id = url.split('/').pop();
    const confirmationPattern = `*://www.covermymeds.com/request/faxconfirmation/${pa_id}*`;

    // Check for session token and patient info
    getCookie(url)
        .then(token => {
            if (!token) throw new Error(`No session token for ${url}`);
            return getPatientInfo(pa_id);  // Removed token from here as it was not used
        })
        .then(async ({ patient_fname, patient_lname, patient_dob, drug }) => {
            const dobSafe = patient_dob.replace(/\//g, '-');
            console.log({ patient_fname, patient_lname, dobSafe, drug });

            // Check if the URL matches the confirmation pattern
            if (changeInfo.url && changeInfo.url.match(confirmationPattern)) {
                console.log("URL changed to requested match pattern URL");
                // Trigger the PA download
                downloadPA(pa_id, patient_fname, patient_lname, drug);
            }
        })
        .catch(error => console.error(`PA flow error: ${error}`));
});

// Listen for API responses from the dashboard
chrome.webRequest.onCompleted.addListener(
    (details) => {
        const pa_id = details.url.split('/').pop();  // Extract PA ID from the API URL

        // Check if the URL is the expected one and response is valid
        if (details.url.includes(`dashboard.covermymeds.com/api/requests/${pa_id}`)) {
            // Check if response contains 'ePa_Status_description' with the value 'PA Request - Sent to Plan'
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    func: checkStatusAndDownload,
                    args: [pa_id]  // Pass PA ID to the script
                });
            });
        }
    },
    { urls: ["*://dashboard.covermymeds.com/api/requests/*"] }
);

// Function to check response data and trigger download if needed
function checkStatusAndDownload(pa_id) {
    // Example of how to check the page's data (replace this with your logic to get the API response)
    if (window.data && window.data.ePa_Status_description === 'PA Request - Sent to Plan') {
        console.log('Found matching status in API response, triggering download');
        // Trigger downloadPA when the status matches
        downloadPA(pa_id);
    }
}
