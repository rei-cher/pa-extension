// export async function downloadPA(pa_id, pt_fname, pt_lname, med) {
//     const pdfUrl  = `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`;
//     // match pattern for webRequest
//     // const confirmationPattern = `*://covermymeds.com/requests/faxconfirmation/${pa_id}*`;
//     const confirmationPattern = `*://portal-services.covermymeds.com/requests/${pa_id}/redacted*`;

//     // const onComplete = details => {
//     //     // only if we got a 200 OK
//     //     if (details.statusCode === 200) {
//     //         chrome.downloads.download({
//     //             url: pdfUrl,
//     //             filename: `${pt_fname}-${pt_lname}-${med}.pdf`
//     //         }, downloadId => {
//     //             console.log('Download started, id=', downloadId);
//     //         });
//     //     }
//     //     // remove the listener so it never fires again
//     //     chrome.webRequest.onCompleted.removeListener(onComplete);
//     // };

//     return new Promise((resolve, reject) => {
//         const onComplete = details => {
//             // tear it down immediately
//             chrome.webRequest.onCompleted.removeListener(onComplete);
        
//             // now fetch the JSON body ourselves (with cookies)
//             fetch(details.url, { credentials: 'include' })
//               .then(res => {
//                 if (!res.ok) throw new Error(`HTTP ${res.status}`);
//                 return res.json();
//               })
//               .then(data => {
//                 if (data.workflow_status === 'Sent to Plan') {
//                   // now fetch the actual PDF as a Blob
//                   fetch(pdfUrl, { credentials: 'include' })
//                     .then(res2 => {
//                       if (!res2.ok) throw new Error(`PDF fetch failed ${res2.status}`);
//                       return res2.blob();
//                     })
//                     .then(blob => {
//                       // wrap the blob in a File so uploadPdf can read .name
//                       const file = new File(
//                         [blob],
//                         `${pt_fname}-${pt_lname}-${med}.pdf`,
//                         { type: blob.type }
//                       );
//                       resolve(file);
//                     })
//                     .catch(reject);
//                 } else {
//                   reject(`Bad status: ${data.workflow_status}`);
//                 }
//               })
//               .catch(reject);
//           };
    
//         // add it, filtered to exactly your confirmation URL
//         chrome.webRequest.onCompleted.addListener(
//             onComplete,
//             { urls: [ confirmationPattern ] }
//         );
//     });
// }

export async function downloadPA(pa_id, pt_fname, pt_lname, med) {
    const pdfUrl = `https://dashboard.covermymeds.com/api/requests/${pa_id}/download`;
    // match pattern for webRequest
    const confirmationPattern = `*://www.covermymeds.com/request/faxconfirmation/${pa_id}*`;

    // Define the listener function
    const onComplete = (details) => {
        // Check if the request type is 'document', status is 200, and URL matches the confirmationPattern
        if (details.statusCode === 200 && details.url.match(confirmationPattern) && details.type === 'main_frame') {
            // Start the download after receiving a 200 OK status for the confirmation URL
            chrome.downloads.download({
                url: pdfUrl,
                filename: `${pt_fname}-${pt_lname}-${med}.pdf`
            }, (downloadId) => {
                console.log('Download started, id=', downloadId);
            });

            // Remove the listener so it doesn't fire again
            chrome.webRequest.onCompleted.removeListener(onComplete);
        }
    };

    // Add the listener to listen for the confirmation URL request of type 'document'
    chrome.webRequest.onCompleted.addListener(onComplete, { 
        urls: [confirmationPattern],
        types: ['main_frame'] // Listen for document requests
    });
}

