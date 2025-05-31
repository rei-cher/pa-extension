import { handlePARequest } from "./handlers/paHandler.js";

// whenever a webRequest completes matching these patterns, call handlePARequest.
chrome.webRequest.onCompleted.addListener(
    async (details) => {
        const { url } = details;
        // If URL matches either “/api/requests/PA_ID” or “/request/faxconfirmation/PA_ID”
        if (
            url.includes("/api/requests/") ||
            url.includes("/request/faxconfirmation/")
        ) {
            console.log(`[webRequest] Detected PA request for URL: ${url}`);
            await handlePARequest({ url, source: "webRequest" });
        }
    },
    {
        urls: [
            "*://*.covermymeds.com/api/requests/*",
            "*://*.covermymeds.com/request/faxconfirmation/*",
        ],
    }
);

// if the tab navigates to “/request/faxconfirmation/...”, call handlePARequest again.
chrome.webNavigation.onCompleted.addListener(
    (details) => {
        const url = details.url;
        if (url.includes("/request/faxconfirmation/")) {
            console.log(`[webNavigation] Completed: ${url}`);
            handlePARequest({ url, source: "webNavigation" });
        }
    },
    {
        url: [
            {
                hostSuffix: "covermymeds.com",
                pathContains: "/request/faxconfirmation/",
            },
        ],
        frameId: 0,
    }
);
