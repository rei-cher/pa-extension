chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // only when the page is fully loaded…
  if (changeInfo.status !== 'complete') return;

  const url = tab.url;
  if (!url.includes('/v2/requests/')) return;

  const pa_id = url.split('/').pop();

  getCookie(url, token => {
    if (!token) return console.error('No session token for', url);

    if (typeof getPatientInfo !== 'function') {
      return console.error('getPatientInfo() not defined');
    }

    getPatientInfo(pa_id)
      .then(data => {
        downloadPA(pa_id,
                   data.patient_fname,
                   data.patient_lname,
                   data.drug.replaceAll(' ', '-'));
      })
      .catch(err => console.error('Error fetching PA info:', err));
  });
});
