function u(n) {
  if (n.patient_dob) return n.patient_dob;
  for (const e of n.sections || [])
    for (const t of e.rows || [])
      for (const o of t.questions || []) {
        const s = o.question_text || o.label || o.name || "";
        if (/date of birth/i.test(s) || /patient_date_of_birth/i.test(s))
          return o.answer_text ?? o.answer ?? null;
      }
  return null;
}
async function m(n) {
  console.log(`Getting patient info with ID - ${n}`);
  const e = `https://dashboard.covermymeds.com/api/requests/${n}?`;
  try {
    const t = await fetch(e, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!t.ok)
      throw new Error(`HTTP ${t.status}`);
    const o = await t.json();
    return console.log("PA data:", o), {
      patient_fname: o.patient_fname,
      patient_lname: o.patient_lname,
      patient_dob: u(o),
      drug: o.drug.split(" ")[0],
      submitted_by: o.submitted_by,
      epa_status: o.ePA_Status_description
    };
  } catch (t) {
    throw console.error("Error fetching PA info:", t), t;
  }
}
async function p(n, e, t, o) {
  return new Promise((s) => {
    const a = `https://dashboard.covermymeds.com/api/requests/${n}/download`;
    console.log("downloadPA called"), chrome.downloads.download({
      url: a,
      filename: `${e}-${t}-${o}.pdf`
    }, (r) => {
      console.log("Download started, id=", r), r && s(r);
    });
  });
}
function f(n) {
  return new Promise((e, t) => {
  });
}
const d = /* @__PURE__ */ new Set(), c = /* @__PURE__ */ new Set();
function w(n) {
  let e;
  (n.url.includes("dashboard.covermymeds.com/api/requests/") || n.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (e = n.url.split("/")[5], e.includes("?") && (e = e.split("?")[0])), !(!e || d.has(e) || c.has(e)) && (c.add(e), m(e).then((t) => {
    const o = t.patient_fname, s = t.patient_lname;
    t.patient_dob;
    const a = t.drug, r = t.submitted_by, i = t.epa_status;
    console.log(o, s, a), console.log("Submitted by: ", r), console.log("ePA status: ", i), console.log("Details: ", n), (i === "PA Request - Sent to Plan" || n.url.includes(`covermymeds.com/request/faxconfirmation/${e}`)) && (d.add(e), p(e, o, s, a).then((l) => f()).then((l) => {
      console.log("PDF path: ", l), console.log("Listener removed.");
    }));
  }).catch((t) => {
    console.error(`Error processing pa ${e}: `, t);
  }).finally(() => {
    c.delete(e);
  }));
}
chrome.webRequest.onCompleted.addListener(
  w,
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
