export function getCookie(tabUrl) {
    return new Promise((resolve, reject) => {
        chrome.cookies.get(
            { url: tabUrl, name: "cmm_production_session" },
            (cookie) => {
                if (chrome.runtime.lastError) {
                    console.error("Cookie API error:", chrome.runtime.lastError);
                    return reject(chrome.runtime.lastError);
                }
                resolve(cookie ? cookie.value : null);
            }
        );
    });
}