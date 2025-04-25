async function downloadPA(pa_id, pt_fname, pt_lname, med){
    pdf_url = `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`;
    conf_url = `https://covermymeds.com/requests/faxconfirmation/${pa_id}?*`;

    try {
        chrome.webRequest.onCompleted.addListener(
            (details) => {
                // if (details.url.includes(conf_url) && details.statusCode === 200){
                //     chrome.downloads.download({
                //         url: pdf_url,
                //         filename: `${pt_fname}-${pt_lname}-${med}.pdf`
                //     }, (downloadId) => {
                //         console.log('Download started with ID: ', downloadId);
                //     });
                // }
                chrome.downloads.download({
                    url: pdf_url,
                    filename: `${pt_fname}-${pt_lname}-${med}.pdf`
                }, (downloadId) => {
                    console.log('Download started with ID: ', downloadId);
                });
            },
            { urls: ["<all_urls>"] }
        );
    }
    catch (error) {
        console.error('Error fetching PA info: ', error);
        throw error;
    }
}