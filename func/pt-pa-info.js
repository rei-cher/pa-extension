function getPatientInfo(pa_id, token){
    const url = `https://dashboard.covermymeds.com/api/requests/${pa_id}`
    fetch(url, {
        method: 'GET',
        headers : {
            "Content-Type": "application/json",
            "Cookie": token
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error (`Https error. Status: ${response.status}`);
        }
        return response.json();
    })
    .catch(error => {
        console.error(`Error fetching data: ${error}`)
    });
}

chrome.runtime.onMessage.addListener((obj, sender, response) => {
    console.log("Message recieved")
    const { token, pa_id} = obj;
    if (token && pa_id) {
        getPatientInfo(pa_id, token);
    }
});