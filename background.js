import { getCookie } from "./func/cmm-cookie.js";
import { getPatientInfo } from "./func/pt-pa-info.js";
import { downloadPA } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";
import { uploadPdf } from "./func/pt-ema-upload.js";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // wait until the request page is fully loaded
    if (changeInfo.status !== 'complete') return;
    
    const url = tab.url;
    if (!url.includes('/v2/requests/')) return;

    await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const s = document.createElement("script");
            s.type = "module";
            s.src = chrome.runtime.getURL("content/ema-upload.js");
            document.head.appendChild(s);
        },
    });
  
    const pa_id = url.split('/').pop();
  
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

            // return the download promise here
            return downloadPA(pa_id, patient_fname, patient_lname, drug)
                .then(file => ({ file, patient_fname, patient_lname, patient_dob, drug }));
        })
        .then(async ({ file, patient_fname, patient_lname, patient_dob, drug }) => {
            // now we’ve waited for the download, so findEmaPatient and uploadPdf
            const patientArr = await findEmaPatient(patient_dob, patient_fname, patient_lname);
            const id = patientArr[0].id;
            
            // send the upload job to the content script
            // chrome.tabs.sendMessage(tabId, {
            //     action: 'uploadPdf',
            //     payload: {
            //         patientId: id,
            //         patientLname: patient_lname,
            //         patientFname: patient_fname,
            //         drug,
            //         file
            //     }
            // },
            //     response => {
            //         if (chrome.runtime.lastError) {
            //             console.warn("Message could not be delivered:", chrome.runtime.lastError.message);
            //             return;
            //         }
                    
            //         if (response?.success) {
            //             console.log("upload suceeded: ",response.data);
            //         }
            //         else {
            //             console.error("upload failed: ",response?.error);
            //         }
            //     }
            // );
            // try {
            //     const data = await uploadPdf({
            //         patientId: id,
            //         patientLname: patient_lname,
            //         patientFname: patient_fname,
            //         drug,
            //         file
            //     });
            //     console.log("upload succeeded:", data);
            // }
            // catch (error) {
            //     console.error('upload failed: ', error);
            // }

            await chrome.scripting.executeScript({
                target: { tabId },
                func: async ({ patientId, patientLname, patientFname, drug, file }) => {
                  try {
                    const data = await window.uploadPdf({
                      patientId,
                      patientLname,
                      patientFname,
                      drug,
                      file
                    });
                    console.log("upload succeeded:", data);
                  } catch (e) {
                    console.error("upload failed:", e);
                  }
                },
                // pass blob and metadata along
                args: [{
                  patientId:   id,
                  patientLname: patient_lname,
                  patientFname: patient_fname,
                  drug,
                  file
                }]
              });

        })
        .catch(error => console.error(`PA flow error: ${error}`));
});