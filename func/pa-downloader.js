export async function downloadPA(pa_id, pt_fname, pt_lname, med) {
    const pdfUrl = `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`;
    
    console.log("downloadPA called");

    chrome.downloads.download({
        url: pdfUrl,
        filename: `${pt_fname}-${pt_lname}-${med}.pdf`
    }, downloadId => {
        console.log('Download started, id=', downloadId);
    });
}

