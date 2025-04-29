import { getCookie } from "./func/cmm-cookie.js";
import { getPatientInfo } from "./func/pt-pa-info.js";
import { downloadPA } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";

//utility
const fileToBase64 = file =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(",")[1];
            resolve (base64);
        }
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // wait until the request page is fully loaded
    if (changeInfo.status !== 'complete') return;
    
    const url = tab.url;
    if (!url.includes('/v2/requests/')) return;
  
    const pa_id = url.split('/').pop();

    const confirmationPattern = `*://www.covermymeds.com/request/faxconfirmation/${pa_id}*`;
  
    getCookie(url)
        .then(token => {
            if (!token) throw new Error(`No session token for ${url}`);
            // return getPatientInfo(pa_id, token);
            return getPatientInfo(pa_id);
        })
        .then(async ({ patient_fname, patient_lname, patient_dob, drug}) => {
            // format the values
            const dobSafe = patient_dob.replace(/\//g, '-');

            console.log({ patient_fname, patient_lname, dobSafe, drug });

            console.log("URL changed to: ", changeInfo.url);
            if (changeInfo.url && changeInfo.url.match(confirmationPattern)){
                console.log("URL changed to requested match pattern url");
                
                downloadPA(pa_id, patient_fname, patient_lname, drug);
            }
        })
        .catch(error => console.error(`PA flow error: ${error}`));
});