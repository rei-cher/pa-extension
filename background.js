import { getCookie } from "./func/cmm-cookie.js";
import { getPatientInfo } from "./func/pt-pa-info.js";
import { downloadPA } from "./func/pa-downloader.js";

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // wait until the request page is fully loaded
    if (changeInfo.status !== 'complete') return;
    
    const url = tab.url;
    if (!url.includes('/v2/requests/')) return;
  
    const pa_id = url.split('/').pop();
  
    getCookie(url)
        .then(token => {
            if (!token) throw new Error(`No session token for ${url}`);
            return getPatientInfo(pa_id, token);
        })
        .then(({ patient_fname, patient_lname, patient_dob, drug}) => {
            // format the values
            const dobSafe = patient_dob.replace(/\//g, '-');
            const medSafe = drug.replaceAll(' ', '-');

            console.log('Patient fname:', patient_fname);
            console.log('Patient lname:', patient_lname);
            console.log('Patient dob:', dobSafe);
            console.log('Patient drug:', medSafe);

            // invoking downloadPA
            // downloadPA(pa_id, patient_fname, patient_lname, medSafe);
        })
        .catch(error => console.error(`PA flow error: ${error}`));
});