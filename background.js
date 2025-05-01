import { getCookie } from "./func/cmm-cookie.js";
import { getPAInfo } from "./func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";

// Utility: convert File → base64 (unused here but handy)
const fileToBase64 = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// Track which PAs are in progress or done
const processedPA = new Set();
const processingPA = new Set();

// Track the tab where the user is focused
let currentTabId = null;

// On extension startup: find active tab in current window
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs[0]) currentTabId = tabs[0].id;
});

// Update currentTabId when the user switches tabs
chrome.tabs.onActivated.addListener(activeInfo => {
  currentTabId = activeInfo.tabId;
});

// Update currentTabId when the window focus changes
chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId }, tabs => {
    if (tabs[0]) currentTabId = tabs[0].id;
  });
});

// Encapsulated download flow
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

      chrome.storage.local.get(["downloadHistory"], result => {
        const history = [filepath]
          .concat(result.downloadHistory || [])
          .slice(0, 10);
        chrome.storage.local.set({ downloadHistory: history });
      });
    })
    .catch(err => console.error(`Error downloading PA ${pa_id}:`, err))
    .finally(() => processingPA.delete(pa_id));
}

// webRequest listener (only for currentTabId)
function handlePARequest(details) {
  // ignore requests from other tabs
  if (details.tabId !== currentTabId) return;

  let pa_id = null;
  if (details.url.includes("dashboard.covermymeds.com/api/requests/")) {
    pa_id = details.url.split("/")[5].split("?")[0];
  }
  if (!pa_id) return;

  processAndDownload(pa_id);
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

// tabs.onUpdated listener (only for currentTabId)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // only look at our active tab
  if (details.tabId !== currentTabId) return;

  const url = details.url;
  const match = url.match(/\/request\/faxconfirmation\/([^/?#]+)/);
  if (!match) return;

  const pa_id = match[1];
  processAndDownload(pa_id);
}, {
  // filter to only run on covermymeds domains
  url: [
    { hostContains: "covermymeds.com", pathContains: "/request/faxconfirmation/" }
  ]
});

// Optional: manual trigger
function pdfManipulation(pa_id) {
  processAndDownload(pa_id);
}
