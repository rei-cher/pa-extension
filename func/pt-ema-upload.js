export async function uploadPdf(tabId, dtoList, file) {
    try {
        const formData = new FormData();

        const dtoListBlob = new Blob([JSON.stringify(dtoList)], { type: 'application/json' });
        formData.append('dtoList', JSON.stringify(dtoListBlob));
        
        formData.append('file', file, file.name);

        // formData.append('tabId', tabId);

        const response = await fetch(
            "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload", 
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        return result;
    } 
    catch (error) {
        console.error('Upload error:', error);
        throw error;
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
