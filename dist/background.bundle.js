function p(n) {
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
async function f(n) {
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
      patient_dob: p(o),
      drug: o.drug.split(" ")[0],
      submitted_by: o.submitted_by,
      epa_status: o.ePA_Status_description
    };
  } catch (t) {
    throw console.error("Error fetching PA info:", t), t;
  }
}
async function w(n, e, t, o) {
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
function h(n) {
  return new Promise((e, t) => {
  });
}
const u = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Set();
function _(n) {
  let e;
  (n.url.includes("dashboard.covermymeds.com/api/requests/") || n.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (e = n.url.split("/")[5], e.includes("?") && (e = e.split("?")[0])), !(!e || u.has(e) || l.has(e)) && (l.add(e), f(e).then((t) => {
    const o = t.patient_fname, s = t.patient_lname;
    t.patient_dob;
    const a = t.drug, r = t.submitted_by, d = t.epa_status;
    console.log(o, s, a), console.log("Submitted by: ", r), console.log("ePA status: ", d), console.log("Details: ", n), (d === "PA Request - Sent to Plan" || n.url.includes(`covermymeds.com/request/faxconfirmation/${e}`)) && (u.add(e), w(e, o, s, a).then((i) => h()).then((i) => {
      console.log("PDF path: ", i), console.log("Listener removed."), chrome.storage.local.get(["downloadHistory"], (m) => {
        let c = m.downloadHistory || [];
        c.unshift(i), c = c.slice(0, 10), chrome.storage.local.set({ downloadHistory: c });
      });
    }));
  }).catch((t) => {
    console.error(`Error processing pa ${e}: `, t);
  }).finally(() => {
    l.delete(e);
  }));
}
chrome.webRequest.onCompleted.addListener(
  _,
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
