function i(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const s of o.sections || [])
    for (const t of s.rows || [])
      for (const e of t.questions || []) {
        const n = e.question_text || e.label || e.name || "";
        if (/date of birth/i.test(n) || /patient_date_of_birth/i.test(n))
          return e.answer_text ?? e.answer ?? null;
      }
  return null;
}
async function c(o) {
  console.log(`Getting patient info with ID - ${o}`);
  const s = `https://dashboard.covermymeds.com/api/requests/${o}?`;
  try {
    const t = await fetch(s, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!t.ok)
      throw new Error(`HTTP ${t.status}`);
    const e = await t.json();
    return console.log("PA data:", e), {
      patient_fname: e.patient_fname,
      patient_lname: e.patient_lname,
      patient_dob: i(e),
      drug: e.drug.split(" ")[0]
    };
  } catch (t) {
    throw console.error("Error fetching PA info:", t), t;
  }
}
self.getPatientInfo = c;
async function d(o, s, t, e) {
  const n = `https://dashboard.covermymeds.com/api/requests/${o}/download`;
  console.log("downloadPA called"), chrome.downloads.download({
    url: n,
    filename: `${s}-${t}-${e}.pdf`
  }, (a) => {
    console.log("Download started, id=", a);
  });
}
chrome.webRequest.onCompleted.addListener(
  (o) => {
    let t = o.url.split("/")[5];
    t.includes("?") && (t = t.split("?")[0]), console.log("PA ID: ", t), console.log("Details object: ", o), o.url === `https://dashboard.covermymeds.com/api/requests/${t}?type=Web%20Socket` || o.url === `https://dashboard.covermymeds.com/api/requests/${t}?type=Elapsed%20Time` ? chrome.tabs.query({ active: !0, currentWindow: !0 }, (e) => {
      chrome.scripting.executeScript({
        target: { tabId: e[0].id },
        func: l,
        args: [t]
        // Pass PA ID to the script
      });
    }) : o.url.includes(`covermymeds.com/request/faxconfirmation/${t}`) && c(t).then((e) => {
      const n = e.patient_fname, a = e.patient_lname;
      e.patient_dob;
      const r = e.drug;
      console.log(n, a, r), d(t, n, a, r);
    });
  },
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
function l(o) {
  console.log("checkStatusAndDownload called"), console.log("window.data: ", window.data), window.data && window.data.ePa_Status_description === "PA Request - Sent to Plan" && console.log("Found matching status in API response, triggering download");
}
