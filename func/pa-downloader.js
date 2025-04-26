export async function downloadPA(pa_id, pt_fname, pt_lname, med) {
    const pdfUrl  = `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`;
    // match pattern for webRequest
    // const confirmationPattern = `*://covermymeds.com/requests/faxconfirmation/${pa_id}*`;
    const confirmationPattern = `*://portal-services.covermymeds.com/requests/${pa_id}/redacted*`;

    // const onComplete = details => {
    //     // only if we got a 200 OK
    //     if (details.statusCode === 200) {
    //         chrome.downloads.download({
    //             url: pdfUrl,
    //             filename: `${pt_fname}-${pt_lname}-${med}.pdf`
    //         }, downloadId => {
    //             console.log('Download started, id=', downloadId);
    //         });
    //     }
    //     // remove the listener so it never fires again
    //     chrome.webRequest.onCompleted.removeListener(onComplete);
    // };

    const onComplete = details => {
        // tear it down immediately
        chrome.webRequest.onCompleted.removeListener(onComplete);
    
        // now fetch the JSON body ourselves (with cookies)
        fetch(details.url, { credentials: 'include' })
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(data => {
            if (data.workflow_status === 'Sent to Plan') {
              chrome.downloads.download({
                url:      pdfUrl,
                filename: `${pt_fname}-${pt_lname}-${med}.pdf`
              }, downloadId => {
                console.log('Download started:', downloadId);
              });
            } else {
              console.log('Not Sent to Plan (status=', data.workflow_status, ')');
            }
          })
          .catch(err => console.error('Error checking workflow_status:', err));
      };

    // add it, filtered to exactly your confirmation URL
    chrome.webRequest.onCompleted.addListener(
        onComplete,
        { urls: [ confirmationPattern ] }
    );
}

self.downloadPA = downloadPA;