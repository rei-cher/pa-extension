// document.getElementById('fileInput').addEventListener('change', async (e) => {
//     const fileHandle = e.target.files[0]?.handle;
//     if (!fileHandle) {
//         alert('Choose a valid CSV or Excel file.');
//         return;
//     }
  
//     // persist handle via chrome.storage (it’s structured‑cloneable)
//     await chrome.storage.local.set({ paLogHandle: fileHandle });
//     chrome.runtime.sendMessage({ action: 'updateLogHandle' });
//     window.close();
// });


// const chooseBtn = document.getElementById('chooseBtn');
// const saveBtn = document.getElementById('saveBtn');
// const fileNameDiv = document.getElementById('fileName');

// // This will hold a FileSystemFileHandle once picked
// let fileHandle = null;

// chooseBtn.addEventListener('click', async () => {
//     try {
//         // Open picker, restrict to CSV/XLS/XLSX
//         const [handle] = await window.showOpenFilePicker({
//             types: [{
//             description: 'CSV or Excel',
//             accept: {
//                 'text/csv': ['.csv'],
//                 'application/vnd.ms-excel': ['.xls'],
//                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
//             }
//             }],
//             excludeAcceptAllOption: true,
//             multiple: false
//         });

//         fileHandle = handle;
//         fileNameDiv.textContent = handle.name;
//         saveBtn.disabled = false;
//     } 
//     catch (err) {
//         // user probably cancelled the dialog; do nothing
//         console.error('File picker aborted or failed:', err);
//     }
// });

// saveBtn.addEventListener('click', async () => {
//     if (!fileHandle) {
//         alert('Please choose a CSV or Excel file first.');
//         return;
//     }
//     // store the handle so background.js can retrieve and use it
//     await chrome.storage.local.set({ paLogHandle: fileHandle });
//     chrome.runtime.sendMessage({ action: 'updateLogHandle' });
//     window.close();
// });


// import { openDB } from 'idb';

// async function saveHandle(handle) {
//     const db = await openDB('my-extension-db', 1, {
//         upgrade(db) {
//             db.createObjectStore('handles');
//         }
//     });
//     // make sure we have write permission
//     await handle.requestPermission({ mode: 'readwrite' });
//     await db.put('handles', handle, 'paLogHandle');
// }

// // when user picks file…
// const [fileHandle] = await window.showOpenFilePicker({ /* … */ });
// fileNameDiv.textContent = fileHandle.name;
// await saveHandle(fileHandle);
// window.close();

// popup.js
document.getElementById("downloadBtn").addEventListener("click", async () => {
    const { paLog = [] } = await chrome.storage.local.get("paLog");
    if (!paLog.length) {
      return alert("No PA logs yet.");
    }
  
    // build CSV
    const header = [
      "PA ID",
      "First Name",
      "Last Name",
      "DOB",
      "Drug",
      "Timestamp",
      "Status",
      "Submitted By"
    ].join(",") + "\n";
  
    const rows = paLog.map(e =>
      [
        e.pa_id,
        e.firstName,
        e.lastName,
        e.dob,
        e.drug,
        e.timestamp,
        e.status,
        e.submittedBy
      ].join(",")
    ).join("\n");
  
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
  
    // fire off the download
    await chrome.downloads.download({
      url,
      filename: "pa-log.csv",
      saveAs: true
    });
  
    // clean up
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  
