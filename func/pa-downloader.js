export async function downloadPA(pa_id, pt_fname, pt_lname, med) {
    return new Promise((resolve) => {
        const pdfUrl = `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`;
        
        console.log("downloadPA called");
    
        chrome.downloads.download({
            url: pdfUrl,
            filename: `${pt_fname}-${pt_lname}-${med}.pdf`
        }, downloadId => {
            if (downloadId) {
                console.log('Download started, id=', downloadId);
                resolve(downloadId);
            }
        });
    })
}

export function waitForDownloadFilename(downloadId) {
    return new Promise((resolve, reject) => {
        const listener = delta => {
            if (delta.id === downloadId && delta.state?.current === 'complete') {
                chrome.downloads.search({id: downloadId}, results => {
                    if (results && results.length > 0) {
                        resolve(results[0].filename);
                        chrome.downloads.onChanged.removeListener(listener);
                    } else {
                        reject(new Error("No results for downloadId"));
                    }
                });
            }
        };
        chrome.downloads.onChanged.addListener(listener);
    });
}
