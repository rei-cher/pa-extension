function _(s) {
  if (s.patient_dob) return s.patient_dob;
  for (const t of s.sections || [])
    for (const e of t.rows || [])
      for (const o of e.questions || []) {
        const n = o.question_text || o.label || o.name || "";
        if (/date of birth/i.test(n) || /patient_date_of_birth/i.test(n))
          return o.answer_text ?? o.answer ?? null;
      }
  return null;
}
async function f(s) {
  console.log(`Getting patient info with ID - ${s}`);
  const t = `https://dashboard.covermymeds.com/api/requests/${s}?`;
  try {
    const e = await fetch(t, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!e.ok)
      throw new Error(`HTTP ${e.status}`);
    const o = await e.json();
    return console.log("PA data:", o), {
      patient_fname: o.patient_fname,
      patient_lname: o.patient_lname,
      patient_dob: _(o),
      drug: o.drug.split(" ")[0],
      submitted_by: o.submitted_by,
      epa_status: o.ePA_Status_description,
      workflow_status: o.workflow_status,
      submitted_by_user_category: o.submitted_by_user_category
    };
  } catch (e) {
    throw console.error("Error fetching PA info:", e), e;
  }
}
async function b(s, t, e, o) {
  return new Promise((n) => {
    const a = `https://dashboard.covermymeds.com/api/requests/${s}/download`;
    console.log("downloadPA called"), chrome.downloads.download({
      url: a,
      filename: `${t}-${e}-${o}.pdf`
    }, (r) => {
      console.log("Download started, id=", r), r && n(r);
    });
  });
}
function h(s) {
  return new Promise((t, e) => {
  });
}
const d = /* @__PURE__ */ new Set(), u = /* @__PURE__ */ new Set();
function y(s) {
  let t;
  (s.url.includes("dashboard.covermymeds.com/api/requests/") || s.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = s.url.split("/")[5], t.includes("?") && (t = t.split("?")[0])), !(!t || d.has(t) || u.has(t)) && (u.add(t), f(t).then((e) => {
    const o = e.patient_fname, n = e.patient_lname;
    e.patient_dob;
    const a = e.drug, r = e.submitted_by, c = e.epa_status, m = e.workflow_status, w = e.submitted_by_user_category;
    console.log(o, n, a), console.log("Submitted by: ", r), console.log("ePA status: ", c), console.log("Details: ", s), c === "PA Request - Sent to Plan" || // checking status for pas that are sent, but didn't go to the faxconfirmation page
    w === "PRESCRIBER" ? (d.add(t), b(t, o, n, a).then((i) => h()).then((i) => {
      console.log("PDF path: ", i), console.log("Listener removed."), chrome.storage.local.get(["downloadHistory"], (p) => {
        let l = p.downloadHistory || [];
        l.unshift(i), l = l.slice(0, 10), chrome.storage.local.set({ downloadHistory: l });
      });
    })) : (c === "PA Response" || c === "Question Response" || m === "Sent to Plan") && d.add(t);
  }).catch((e) => {
    console.error(`Error processing pa ${t}: `, e);
  }).finally(() => {
    u.delete(t);
  }));
}
chrome.webRequest.onCompleted.addListener(
  y,
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
