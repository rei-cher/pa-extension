export async function uploadPdf({ patientId, patientLname, patientFname, drug, file}) {
    if (!(file instanceof Blob)) {
        throw new Error("`file` must be a Blob or File");
    }
    
    // build your dtoList JSON
    const dto = [{
      patient: {
        id: patientId,
        lastName: patientLname,
        firstName: patientFname
      },
      additionalInfo: {
        performedDate: new Date().toISOString()
      },
      fileName: file.name,
      title: `${drug} pa submitted: ${new Date().toLocaleDateString()}`
    }];
  
    // create a FormData instance
    const formData = new FormData();
  
    // append the JSON part as its own blob so that Content-Type is set to application/json
    formData.append(
      "dtoList",
      new Blob([JSON.stringify(dto)], { type: "application/json" }),
      "dtoList.json"
    );
  
    // append the actual PDF file
    formData.append("files", file, file.name);
  
    // pOST with fetch
    const resp = await fetch("https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
        {
            method: "POST",
            credentials: 'include',
            body: formData,
        }
    );
  
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Upload failed ${resp.status}: ${text}`);
    }
  
    return resp.json();
}