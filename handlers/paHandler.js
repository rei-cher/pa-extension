import { getPAInfo } from "../func/pt-pa-info.js";
import { downloadPA, waitForDownloadFilename } from "../func/pa-downloader.js";
import { findEmaPatient } from "../func/pt-ema.js";
import { uploadPdf } from "../func/pt-ema-upload.js";
import { logPaDownload } from "../func/csv-logger.js";

import { getTodayISODate } from "../utils/dateUtils.js";

import {
    getDownloadedPAKeys,
    hasPADownloaded,
    initDownloadTrigger,
    getDownloadTrigger,
    setDownloadTriggered,
    markPAAsDownloaded,
    initProcessedPA,
    ignorePA,
    isPAIgnored,
    unignorePA,
    setCSVTriggered,
    getCSVTrigger,
} from "../utils/storageUtils.js";

import {
    isUploadCase,
    isTerminalCase,
} from "../utils/statusUtils.js";

import { shouldSkipPA } from "../utils/skipUtils.js";

// in-memory set to prevent parallel processing on the same PA
const processingPA = new Set();

/**
    * main handler: given an object { url, source }, decides
    * whether and how to download & upload this PA’s PDF.
*/
export async function handlePARequest({ url, source }) {
    console.log("=============\nDetails:\n", { url, source }, "\n=============");

    // 1extract pa_id immediately
    const pa_id = extractPAIdFromUrl(url, source);
    if (!pa_id) return;

    // if it’s already in processing, skip
    // except if the source is a webNavigation
    // if webNavigation, then we want to proceed further and download
    if (processingPA.has(pa_id) && source !== "webNavigation") return;

    // initialize in-memory tracking if first seen
    initProcessedPA(pa_id);
    initDownloadTrigger(pa_id);

    // Test - if pa was added to ignore list (to unignore)
    // unignorePA(pa_id);

    // check if we should ignore it:
    if (isPAIgnored(pa_id)) {
        console.warn(`[PA ${pa_id}] [Source ${source}] Already ignored. Skipping.`);
        return;
    }

    // check persistent storage: if already downloaded → skip
    if (await hasPADownloaded(pa_id)) {
        console.warn(`[PA ${pa_id}] [Source ${source}] Already downloaded (in storage). Skipping.`);
        return;
    }

    processingPA.add(pa_id);
    try {
        // fetch full PA info
        const pa_info = await getPAInfo(pa_id, source);
        if (!pa_info) {
            console.error(`[PA ${pa_id}] [Source ${source}] Failed to fetch pa_info.`);
            processingPA.delete(pa_id);
            return;
        }

        console.log('[paHandler] Extracted pa info: ', pa_info);

        // check custom skip logic
        // if (shouldSkipPA(pa_info)) {
        //     console.log(`[PA ${pa_id}] Custom skip logic triggered. Ignoring forever.`);
        //     ignorePA(pa_id);
        //     return;
        // }

        // check terminal case
        const todayISO = getTodayISODate();
        if (isTerminalCase(pa_info, todayISO)) {
            console.log(`[PA ${pa_id}] [Source ${source}] Terminal case — skipping future.`, pa_info.request_outcome);
            ignorePA(pa_id);
            return;
        }

        // decide if this is an “upload case”:
        const uploadCase = isUploadCase(pa_info, url, todayISO);
        console.log(`[paHandler] [Source - ${source}] uploadCase - ${uploadCase}`);

        // if not an uploadCase, do nothing.
        if (!uploadCase) {
            console.log(`[PA ${pa_id}] [Source ${source}] Not an upload case. State:`, {
                epa_status: pa_info.epa_status,
                workflow_status: pa_info.workflow_status,
            });
            return;
        }

        // if we reach here, we want to download + optionally upload.
        const triggerDownloadObj = getDownloadTrigger(pa_id);
        const triggerCSVObj = getCSVTrigger(pa_id);

        console.log("downloadTrigger:", triggerDownloadObj);
        console.log("csvTrigger:", triggerCSVObj);

        if (triggerDownloadObj.triggered || triggerCSVObj.triggered) {
            console.log(`[PA ${pa_id}] [Source ${source}] Download or CSV already triggered once. Logging only.`);
            await logDownloadFallback(pa_id, pa_info);
            await markPAAsDownloaded(pa_id);
            return;
        }

        // perform the download:
        console.log(`[PA ${pa_id}] [Source ${source}] Initiating download...`);
        const downloadId = await downloadPA(
            pa_id,
            pa_info.patient_fname,
            pa_info.patient_lname,
            pa_info.drug
        );
        setDownloadTriggered(pa_id);

        const filepath = await waitForDownloadFilename(downloadId);
        console.log(`[PA ${pa_id}] [Source ${source}] Downloaded to:`, filepath);

        // attempt to find EMA patient:
        const matches = await findEmaPatient(
            pa_info.patient_dob,
            pa_info.patient_fname,
            pa_info.patient_lname
        );

        // if found, upload; if not, still log (temp_pt_id = "")
        let patientId = "";
        if (matches && matches.length > 0) {
            patientId = matches[0].id;
            console.log(`[PA ${pa_id}] [Source ${source}] Found EMA patient ID=${patientId}. Uploading...`);
        } 
        else {
            console.log(`[PA ${pa_id}] [Source ${source}] No EMA patient match found. Logging with empty patientId.`);
        }

        // log to CSV (regardless of upload success)
        console.log(`[PA ${pa_id}] [Source ${source}] Initiating csv download...`)
        await logPaDownload({
            pa_id,
            patient_fname: pa_info.patient_fname,
            patient_lname: pa_info.patient_lname,
            patient_dob: pa_info.patient_dob,
            drug: pa_info.drug,
            submitted_by: pa_info.submitted_by,
            insurance: pa_info.insurance,
            patientId,
            npi: pa_info.npi,
        }, source);
        
        setCSVTriggered(pa_id);
        
        // mark this PA as downloaded (both in-memory and in storage)
        await markPAAsDownloaded(pa_id);

        // try to upload to EMA tab if open
        // TODO: find a way to upload (current idea is to use selenium)
        if (patientId) {
        try {
            const tabs = await chrome.tabs.query({});
            const emaTab = tabs.find((tab) => tab.url?.includes("ema.md"));
            if (emaTab) {
            console.log(`[PA ${pa_id}] [Source ${source}] Uploading PDF to EMA tab #${emaTab.id}...`);
            // (Example sketch; uncomment & fill in if needed)
            // const fileObj = await fetchPDFasFile(pa_id, filepath);
            // const dtoList = [{
            //   patient: { id: String(patientId), lastName: pa_info.patient_lname, firstName: pa_info.patient_fname },
            //   additionalInfo: { performedDate: new Date().toISOString() },
            //   fileName: fileObj.name,
            //   title: `${pa_info.drug} PA submitted: ${new Date().toLocaleDateString()}`,
            // }];
            // await uploadPdf(emaTab.id, dtoList, fileObj);
            }
        } catch (tabErr) {
            console.error(`[PA ${pa_id}] [Source ${source}] Error finding/uploading to EMA tab:`, tabErr);
        }
        }

    } catch (err) {
        console.error(`[PA ${pa_id}] [Source ${source}] Unexpected error in handler:`, err);
        return;
    } finally {
        processingPA.delete(pa_id);
    }
}

/**
    * if download was already triggered, but we still want to do a “log only” pass,
    * this function wraps the CSV‐logging + marking in storage.
*/
async function logDownloadFallback(pa_id, pa_info) {
    const {
        patient_fname,
        patient_lname,
        patient_dob,
        drug,
        submitted_by,
        insurance,
        npi,
    } = pa_info;

    await logPaDownload({
        pa_id,
        patient_fname,
        patient_lname,
        patient_dob,
        drug,
        submitted_by,
        insurance,
        patientId: "",
        npi,
    });
}

/**
    * reuse the same URL-to-ID logic instead of duplicating in background.js
*/
function extractPAIdFromUrl(url, source) {
    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();

        const paIdPatterns = [
            "/api/requests/",
            "/request/faxconfirmation/"
        ];

        for (const pattern of paIdPatterns) {
            const index = path.indexOf(pattern);
            if (index !== -1) {
                const segments = urlObj.pathname.split("/").filter(Boolean);
                const patternParts = pattern.split("/").filter(Boolean);
                const patternIndex = segments.findIndex(seg => seg.toLowerCase() === patternParts[patternParts.length - 1]);
                
                // PA ID is the next segment after the matched pattern
                const paId = segments[patternIndex + 1];

                const invalidIds = [
                    "reminders",
                    "history",
                    "notes",
                    "attachments",
                    "dialog_views",
                    "next_request"
                ];

                if (!invalidIds.includes(paId?.toLowerCase())) {
                    console.log(`[extractPAIdFromUrl] [Source ${source}] Extracted PA ID: ${paId}`);
                    return paId;
                } else {
                    return null;
                }
            }
        }

        return null;
    } catch (err) {
        console.error("Invalid URL in extractPAIdFromUrl:", url);
        return null;
    }
}
