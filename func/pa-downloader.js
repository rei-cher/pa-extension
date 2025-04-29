export async function downloadPA(pa_id, pt_fname, pt_lname, med) {
    const pdfUrl = `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`;

    const onComplete = details => {
        // only if we got a 200 OK
        if (details.statusCode === 200) {
            chrome.downloads.download({
                url: pdfUrl,
                filename: `${pt_fname}-${pt_lname}-${med}.pdf`
            }, downloadId => {
                console.log('Download started, id=', downloadId);
            });
        }
        // remove the listener so it never fires again
        chrome.webRequest.onCompleted.removeListener(onComplete);
    };
}

