/**
    * determines whether this PA should immediately be uploaded
    * because epa_status_description is “PA Request – Sent to Plan” AND
    * it was sent today, or URL explicitly contains “faxconfirmation”.
*/
export function isUploadCase(pa_info, url, todayISO) {
    const {
        epa_status_description,
        sent = "",
    } = pa_info;

    const sentIncludesToday = sent?.includes(todayISO);
    const statusMatch =
        epa_status_description === "PA Request - Sent to Plan" && sentIncludesToday;
    const urlMatch = url.includes("/faxconfirmation/");

    return Boolean(statusMatch || urlMatch);
}

/**
    * determines if the PA has reached a terminal (skip) state:
    * - request_outcome in ["Unknown","Favorable","Unfavorable"]
    * - workflow_status === "Sent to Plan" && sent is NOT today
    * - epa_status_description contains “Expired”
    * - status_dialog_loading includes one of the known “unable” phrases
    * - status_dialog_sending includes the known message about closing the dialog
*/
export function isTerminalCase(pa_info, todayISO) {
    const {
        request_outcome = "",
        workflow_status = "",
        epa_status_description = "",
        status_dialog_loading = "",
        status_dialog_sending = "",
        sent = "",
    } = pa_info;

    const outcomeMatch = ["Unknown", "Favorable", "Unfavorable"].includes(request_outcome);
    const sentIncludesToday = sent?.includes(todayISO);
    const workflowStale = (workflow_status === "Sent to Plan") && !sentIncludesToday;
    const expired = epa_status_description?.includes("Expired");
    const unableLoading = [
        "is unable to respond with clinical questions",
        "is unable to retrieve the clinical questions",
    ].some((substr) => status_dialog_loading?.includes(substr));
    const unableSending = status_dialog_sending?.includes(
        "You may close this dialog and return to your dashboard to perform other"
    );

    console.log(`[teminal case outcome]\noutcomeMatch - ${outcomeMatch}\nworkflowStale - ${workflowStale}\nexpired - ${expired}\nunableLoading - ${unableLoading}\nunableSending - ${unableSending}\ntodayISO - ${todayISO}`)

    return Boolean(
        outcomeMatch ||
        workflowStale ||
        expired ||
        unableLoading ||
        unableSending
    );
}
