import { getCookie }     from './func/cmm-cookie.js';
import { getPatientInfo } from './func/pt-pa-info.js';

// When the PA-request API returns, stash the patient info
chrome.webRequest.onCompleted.addListener(
  async details => {
    // match e.g. https://dashboard.covermymeds.com/api/requests/ABC123
    const m = details.url.match(/\/api\/requests\/([^/]+)$/);
    if (!m || details.statusCode !== 200) return;
    const pa_id = m[1];

    try {
      // fetch session token & patient info
      const token = getCookie(details.url);
      if (!token) throw new Error('No session token');
      const info = await getPatientInfo(pa_id);
      // store it keyed by PA ID
      chrome.storage.local.set({ [`paInfo_${pa_id}`]: info });
    } catch (err) {
      console.error('PA info error', err);
    }
  },
  { urls: ['*://dashboard.covermymeds.com/api/requests/*'] }
);

// When the PDF‐download URL completes, pull that info and actually download
chrome.webRequest.onCompleted.addListener(
  details => {
    const m = details.url.match(/\/api\/requests\/([^/]+)\/download/);
    if (!m || details.statusCode !== 200) return;
    const pa_id = m[1];

    chrome.storage.local.get(`paInfo_${pa_id}`, data => {
      const info = data[`paInfo_${pa_id}`];
      if (!info) return console.error('No patient info for', pa_id);

      const { patient_fname, patient_lname, drug } = info;
      chrome.downloads.download({
        url: details.url,
        filename: `${patient_fname}-${patient_lname}-${drug}.pdf`
      });
    });
  },
  { urls: ['*://dashboard.covermymeds.com/api/requests/*/download'] }
);
