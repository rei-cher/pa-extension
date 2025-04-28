import { getCookie } from "./func/cmm-cookie.js";
import { getPatientInfo } from "./func/pt-pa-info.js";
import { downloadPA } from "./func/pa-downloader.js";
import { findEmaPatient } from "./func/pt-ema.js";

// Utility function to convert a file to Base64
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Wait until the request page is fully loaded
  if (changeInfo.status !== "complete") return;

  const url = tab.url;
  if (!url.includes("/v2/requests/")) return;

  const pa_id = url.split("/").pop();

  // Define the URL pattern for faxconfirmation
  const confirmationPattern = `*://www.covermymeds.com/requests/faxconfirmation/${pa_id}*`;

  // Listen for the confirmation request with status 200
  const onComplete = (details) => {
    // Check if the status code is 200 and the URL matches the confirmationPattern
    if (details.statusCode === 200 && details.url.match(confirmationPattern)) {
      // Trigger downloadPA after the confirmation request has status 200
      getCookie(url)
        .then((token) => {
          if (!token) throw new Error(`No session token for ${url}`);
          return getPatientInfo(pa_id);
        })
        .then(async ({ patient_fname, patient_lname, patient_dob, drug }) => {
          const dobSafe = patient_dob.replace(/\//g, "-");

          console.log({ patient_fname, patient_lname, dobSafe, drug });

          // Download the PA document
          return downloadPA(pa_id, patient_fname, patient_lname, drug)
            .then((file) => ({
              file,
              patient_fname,
              patient_lname,
              patient_dob,
              drug,
            }));
        })
        .then(async ({ file, patient_fname, patient_lname, patient_dob, drug }) => {
          // Now that the download is complete, search for the EMA patient
          const patientArr = await findEmaPatient(patient_dob, patient_fname, patient_lname);
          if (!patientArr.length) throw new Error("No matching EMA patient found");

          const id = patientArr[0].id;

          // Convert the PDF File to Base64
          const b64 = await fileToBase64(file);

          // Find the EMA tab
          const emaTabs = await chrome.tabs.query({ url: "*://khasak.ema.md/*" });
          if (!emaTabs.length) throw new Error("Could not find an open EMA tab");
          const emaTabId = emaTabs[0].id;

          await chrome.scripting.executeScript({
            target: { tabId: emaTabId },
            world: "MAIN",
            func: async ({ id, patient_lname, patient_fname, drug, b64 }) => {
              // Reconstruct the PDF Blob & File
              const blob = await (await fetch(`data:application/pdf;base64,${b64}`)).blob();
              const pdfFile = new File(
                [blob],
                `${patient_fname}-${patient_lname}-${drug}.pdf`,
                { type: "application/pdf" }
              );

              // Build the DTO and FormData
              const dto = [
                {
                  patient: {
                    id: String(id),
                    lastName: patient_lname,
                    firstName: patient_fname,
                  },
                  additionalInfo: {
                    performedDate: new Date().toISOString(),
                  },
                  fileName: pdfFile.name,
                  title: `${drug} pa submitted: ${new Date().toLocaleDateString()}`,
                },
              ];

              const formData = new FormData();
              formData.append("dtoList", JSON.stringify(dto));
              formData.append("files", pdfFile, pdfFile.name);

              // Perform the upload under khasak.ema.md origin
              try {
                const resp = await fetch(
                  "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
                  {
                    method: "POST",
                    credentials: "include",
                    body: formData,
                  }
                );
                if (!resp.ok) {
                  const errText = await resp.text();
                  throw new Error(`Upload failed ${resp.status}: ${errText}`);
                }
                console.log("Upload succeeded:", await resp.json());
              } catch (err) {
                console.error("Upload error:", err);
              }
            },
            args: [
              {
                id,
                patient_lname,
                patient_fname,
                drug,
                b64,
              },
            ],
          });
        })
        .catch((error) => console.error(`PA flow error: ${error}`));
    }

    // Remove the listener to avoid it triggering again
    chrome.webRequest.onCompleted.removeListener(onComplete);
  };

  // Add the listener to listen for the faxconfirmation URL request
  chrome.webRequest.onCompleted.addListener(onComplete, {
    urls: [confirmationPattern],
  });
});
