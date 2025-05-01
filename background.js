import { getCookie } from "./func/cmm-cookie.js";
import { getPAInfo } from "./func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";

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
      const filepath = await waitForDownloadFilename(downloadId);
      console.log("PDF path:", filepath);
      console.log("Listener removed.");

      // Update download history (keep last 10)
      await new Promise(resolve => {
        chrome.storage.local.get(['downloadHistory'], result => {
          let history = result.downloadHistory || [];
          history.unshift(filepath);
          history = history.slice(0, 10);
          chrome.storage.local.set({ downloadHistory: history }, resolve);
        });
      });

      // Find EMA patient
      const matches = await findEmaPatient(patient_dob, patient_fname, patient_lname);
      console.log("Ema Patient:", matches);
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
