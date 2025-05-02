export async function uploadPdf(tabId, dtoList, file) {
    const formData = new FormData();

    // Ensure dtoList is an array of objects and wrap it in a JSON Blob
    formData.append(
        "dtoList",
        new Blob([JSON.stringify(dtoList)], { type: "application/json" })
    );

    // Ensure file is a Blob or File (e.g., from input or fetched file)
    formData.append("file", file, file.name);

    try {
        console.log("Executing upload sctipt in tabid: ",tabId)
        chrome.scripting.executeScript({
    target: { tabId },
    func: (formDataSerialized) => {
        return (async () => {
            const formData = new FormData();
            formData.append(
                "dtoList",
                new Blob([formDataSerialized.dtoList], { type: "application/json" })
            );
            formData.append(
                "file",
                new Blob([Uint8Array.from(formDataSerialized.fileData)], { type: formDataSerialized.fileType }),
                formDataSerialized.fileName
            );

            try {
                const response = await fetch("https://khasak.ema.md/ema/ws/v3/fileAttachment/upload", {
                    method: "POST",
                    body: formData,
                });

                const result = await response.json();
                return { success: true, result };
            } catch (err) {
                return { success: false, error: err.message };
            }
        })();
    },
    args: [{
        dtoList: JSON.stringify(dtoList),
        fileData: Array.from(new Uint8Array(await file.arrayBuffer())),
        fileType: file.type,
        fileName: file.name
    }]
}, (results) => {
    if (chrome.runtime.lastError) {
        console.error("Script injection error:", chrome.runtime.lastError);
    } else if (results && results[0] && results[0].result) {
        const { success, result, error } = results[0].result;
        if (success) {
            console.log("Upload result:", result);
        } else {
            console.error("Upload failed:", error);
        }
    } else {
        console.error("Upload failed: No result returned");
    }
});

    }
    catch (error) {
        console.error("Error during uploading a pdf: ", error.message)
    }
}

/*
[PA BH2ACTMM] uploading PDF for patientId=22244561
background.bundle.js:177 [PA BH2ACTMM] Found EMA tab ID: 203091761
background.bundle.js:183 [PA BH2ACTMM] fetching PDF over network for upload
background.bundle.js:196 [PA BH2ACTMM] uploading to EMA for patient 22244561
background.bundle.js:108 Executing upload sctipt in tabid:  203091761
background.bundle.js:202 [PA BH2ACTMM] EMA upload result: undefined
background.bundle.js:136 Upload result: null
*/
