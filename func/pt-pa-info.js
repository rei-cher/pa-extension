async function getPatientInfo(pa_id, token) {
    console.log(`Getting patient info with ID - ${pa_id}`)
    const url = `https://dashboard.covermymeds.com/api/requests/${pa_id}?`;
  
    try {
      const resp = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Cookie': token
        }
      });
  
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
  
      const data = await resp.json();
      console.log('PA data:', data);
      return data;
    } catch (err) {
      console.error('Error fetching PA info:', err);
      throw err;
    }
}
  
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const { token, pa_id } = msg;
    if (!(pa_id && token)) return;
  
    getPatientInfo(pa_id, token)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
  
    return true;
  });