function getCookie(tabUrl, callback) {
    chrome.cookies.get(
        { url: tabUrl, name: "cmm_production_session" },
        (cookie) => {
            if (chrome.runtime.lastError) {
                console.error("Cookie API error:", chrome.runtime.lastError);
                return callback(null);
            }
            callback(cookie ? cookie.value : null);
        }
    );
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo.url) return;

    const url = changeInfo.url;
    if (!url.includes("/v2/requests")) return;
  
    const pa_id = url.split("/").pop();

    getCookie(url, (token) => {
        if (!token) {
            console.error("No session token found for", url);
            return;
        }

        console.log(
            `Parameters for sending in the message:\n  Token: ${token}\n  PA ID: ${pa_id}`
        );

        // TODO: call the function when the form is submitted - status code 200 
        if (typeof getPatientInfo === 'function'){
            getPatientInfo(pa_id)
                .then(data => {
                    console.log(`PA data: ${data}`);
                    console.log(`PT drug: ${data.drug.replaceAll(" ", "-")}`);
                    console.log(`PT first name: ${data.patient_fname}`);
                    console.log(`PT last name: ${data.patient_lname}`);
                    console.log(`PT dob: ${data.sections[1].rows[1].questions[0].answer_text}`);

                    downloadPA(pa_id, data.patient_fname, data.patient_lname, data.drug.replaceAll(" ", "-"));
                })
                .catch(error => {
                    console.error(`Error fetching patient info: ${error}`)
                });
        }
        else {
            console.error("getPatientInfo() not defined")
        }
    });
});