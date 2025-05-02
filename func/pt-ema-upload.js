export async function uploadPdf(tabId, dtoList, file) {
  const formData = new FormData();

  // Ensure dtoList is an array of objects and wrap it in a JSON Blob
  formData.append(
    "dtoList",
    new Blob([JSON.stringify(dtoList)], { type: "application/json" })
  );

  // Ensure file is a Blob or File (e.g., from input or fetched file)
  formData.append("file", file, file.name);

  chrome.scripting.executeScript({
    target: { tabId },
    func: async (formDataSerialized) => {
      const formData = new FormData();

      // Reconstruct dtoList and file
      formData.append(
        "dtoList",
        new Blob([formDataSerialized.dtoList], { type: "application/json" })
      );
      formData.append(
        "file",
        new Blob([Uint8Array.from(formDataSerialized.fileData)], { type: formDataSerialized.fileType }),
        formDataSerialized.fileName
      );

      const response = await fetch("https://your-api-endpoint.com/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      return result;
    },
    args: [{
      dtoList: JSON.stringify(dtoList),
      fileData: Array.from(new Uint8Array(await file.arrayBuffer())), // serialize file bytes
      fileType: file.type,
      fileName: file.name
    }]
  }, (results) => {
    if (chrome.runtime.lastError) {
      console.error("Script injection error:", chrome.runtime.lastError);
    } else {
      console.log("Upload result:", results[0].result);
    }
  });
}
