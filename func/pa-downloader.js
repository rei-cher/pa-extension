export async function downloadPA(pa_id, pt_fname, pt_lname, med) {
    return new Promise((resolve, reject) => {
        const pdfUrl = `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`;
        console.log("downloadPA called:", pdfUrl);

        chrome.downloads.download({
            url: pdfUrl,
            filename: `${pt_fname}-${pt_lname}-${med}.pdf`
        }, downloadId => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            console.log("Download started, id=", downloadId);
            if (downloadId) {
                resolve(downloadId);
            } 
            else {
                reject(new Error("Failed to start download"));
            }
        });
    });
}

export function waitForDownloadFilename(downloadId) {
    return new Promise((resolve, reject) => {
        const listener = delta => {
        // only care about our download completing
        if (delta.id === downloadId && delta.state?.current === 'complete') {
            // stop listening
            chrome.downloads.onChanged.removeListener(listener);

            // lookup the final filename
            chrome.downloads.search({ id: downloadId }, results => {
                if (results && results.length) {
                    console.log("Found download result:", results[0]);
                    resolve(results[0].filename);
                } else {
                    reject(new Error("No results found for downloadId"));
                }
            });
        }
        // optionally handle errors:
        if (delta.id === downloadId && delta.state?.current === 'interrupted') {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error("Download was interrupted"));
            }
        };

        // register the listener
        chrome.downloads.onChanged.addListener(listener);

        // safety timeout in case onChanged never fires
        setTimeout(() => {
            chrome.downloads.onChanged.removeListener(listener);
            reject(new Error("Timed out waiting for download to complete"));
        }, 60_000);
    });
}
