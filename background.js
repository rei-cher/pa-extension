import { handlePARequest } from "./handlers/paHandler.js";

const URL_PATTERNS = [
    "*://*.covermymeds.com/api/requests/*",
    "*://*.covermymeds.com/request/faxconfirmation/*",
    "*://*.covermymeds.com/v2/requests/*",
];

// Helper to filter relevant URLs
const isTargetURL = (url) =>
    url.includes("/api/requests/") ||
    url.includes("/request/faxconfirmation/") ||
    url.includes("/fax/submit") ||
    url.includes("/v2/requests/");

// whenever a webRequest completes matching these patterns, call handlePARequest.
chrome.webRequest.onCompleted.addListener(
    async (details) => {
        const { url } = details;
        // If URL matches either “/api/requests/PA_ID” or “/request/faxconfirmation/PA_ID”
        if (isTargetURL(url)) {
            console.log(`[webRequest: onCompleted] Detected PA request: ${url}`);
            await handlePARequest({ url, source: "onCompleted" });
        }
    },
    {
        urls: URL_PATTERNS
    }
);

chrome.webNavigation.onHistoryStateUpdated.addListener(
    (details) => {
        const url = details.url;
        if (url.includes("/v2/requests/")) {
            console.log(`[webNavigation] History state updated: ${url}\n`, details);
            handlePARequest({ url, source: "historyStateUpdated" });
        }
    },
    {
        url: [
            {
                hostSuffix: "covermymeds.com",
                pathContains: "/v2/requests/",
            },
        ],
        frameId: 0,
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
