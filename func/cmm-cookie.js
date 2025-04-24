// cookie name: cmm_production_session
async function getCookie(name, callback) {
    chrome.cookies.get({
        "url" : "https://dashboard.covermymeds.com",
        "name" : name
    },
    function(data){
        callback(data);
    });
}

chrome.tabs.onUpdated.addListener((tab) => {
    if (tab.url && tab.url.includes("covermymeds.com/v2/requests")) {
        const pa_id = tab.url.split("/").pop();
        var token = ""
        getCookie("cmm_production_session", function(cookieData){
            token = cookieData.value
        });

        console.log(`Parameters for sending in the message:\nToken: ${token}\nPA ID: ${pa_id}`);

        if (token && pa_id) {
            try{
                chrome.runtime.sendMessage({
                    token: token,
                    pa_id: pa_id
                });
            }
            catch(error){
                console.error(`Error sending the message: ${error}`);
            }
        }
    }
});