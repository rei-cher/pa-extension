import { getCookie } from "./func/cmm-cookie.js";
import { getPAInfo } from "./func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";

// Utility: convert File → base64 (unused here but handy)
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

// Track which PAs are in progress or done
const processedPA = new Set();
const processingPA = new Set();

// Core download flow, given a pa_id
function processAndDownload(pa_id) {
  if (processingPA.has(pa_id) || processedPA.has(pa_id)) return;
  processingPA.add(pa_id);

  getPAInfo(pa_id)
    .then(pa_info => {
      const { patient_fname, patient_lname, drug } = pa_info;
      return downloadPA(pa_id, patient_fname, patient_lname, drug);
    })
    .then(downloadedID => waitForDownloadFilename(downloadedID))
    .then(filepath => {
      console.log("PDF path:", filepath);
      processedPA.add(pa_id);

      // keep only the last 10 entries
      chrome.storage.local.get(['downloadHistory'], result => {
        const history = [filepath]
          .concat(result.downloadHistory || [])
          .slice(0, 10);
        chrome.storage.local.set({ downloadHistory: history });
      });
    })
    .catch(err => {
      console.error(`Error downloading PA ${pa_id}:`, err);
    })
    .finally(() => {
      processingPA.delete(pa_id);
    });
}

// 1) Listen for API responses in the dashboard that contain pa_id
function handlePARequest(details) {
  let pa_id;
  if (
    details.url.includes('dashboard.covermymeds.com/api/requests/') ||
    details.url.includes('www.covermymeds.com/request/faxconfirmation/')
  ) {
    // extract the ID segment
    const parts = details.url.split('/');
    pa_id = parts[5].split('?')[0];
  }

  if (pa_id) {
    processAndDownload(pa_id);
  }
}

chrome.webRequest.onCompleted.addListener(
  handlePARequest,
  {
    urls: [
      "*://dashboard.covermymeds.com/api/requests/*",
      "*://www.covermymeds.com/request/*"
    ]
  }
);

// 2) Also catch when the user actually navigates to the fax-confirmation page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // only fire when the URL changes
  if (!changeInfo.url) return;

  const match = changeInfo.url.match(/\/request\/faxconfirmation\/([^/?#]+)/);
  if (!match) return;

  const pa_id = match[1];
  processAndDownload(pa_id);
});

// Optional: if you want a manual trigger somewhere
function pdfManipulation(pa_id) {
  processAndDownload(pa_id);
}
