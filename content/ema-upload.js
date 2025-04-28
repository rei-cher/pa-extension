import { uploadPdf } from "../func/pt-ema-upload.js";

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.action === "uploadPdf") {
        uploadPdf(msg.payload)
            .then(data => sendResponse({ success: true, data }))
            .catch(err  => sendResponse({ success: false, error: err.message }));
        return true;
    }
});