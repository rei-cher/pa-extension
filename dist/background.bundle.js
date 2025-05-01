function q(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const t of o.sections || [])
    for (const s of t.rows || [])
      for (const e of s.questions || []) {
        const a = e.question_text || e.label || e.name || "";
        if (/date of birth/i.test(a) || /patient_date_of_birth/i.test(a))
          return e.answer_text ?? e.answer ?? null;
      }
  return null;
}
async function b(o) {
  console.log(`Getting patient info with ID - ${o}`);
  const t = `https://dashboard.covermymeds.com/api/requests/${o}?`;
  try {
    const s = await fetch(t, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!s.ok)
      throw new Error(`HTTP ${s.status}`);
    const e = await s.json();
    return console.log("PA data:", e), {
      patient_fname: e.patient_fname,
      patient_lname: e.patient_lname,
      patient_dob: q(e),
      drug: e.drug.split(" ")[0],
      submitted_by: e.submitted_by,
      epa_status: e.ePA_Status_description,
      workflow_status: e.workflow_status,
      submitted_by_user_category: e.submitted_by_user_category,
      completed: e.completed
    };
  } catch (s) {
    throw console.error("Error fetching PA info:", s), s;
  }
}
async function P(o, t, s, e) {
  return new Promise((a) => {
    const i = `https://dashboard.covermymeds.com/api/requests/${o}/download`;
    console.log("downloadPA called"), chrome.downloads.download({
      url: i,
      filename: `${t}-${s}-${e}.pdf`
    }, (n) => {
      console.log("Download started, id=", n), n && a(n);
    });
  });
}
async function A(o) {
  return new Promise((t, s) => {
  });
}
async function E(o, t, s) {
  console.log(`Trying to find the patient in ema: ${t} ${s} ${o}`);
  const e = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const a = {
      term: o,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, i = new URLSearchParams(a).toString(), n = await fetch(`${e}${i}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!n.ok)
      throw new Error(`HTTP ${n.status}`);
    const c = await n.json();
    console.log("EMA patient return data:", c);
    const l = Array.isArray(c) ? c : Array.isArray(c.patients) ? c.patients : [], m = t.toLowerCase().split(/\s+|-/).filter((r) => r), _ = s.toLowerCase().split(/\s+|-/).filter((r) => r), p = l.filter((r) => {
      const d = [
        r.firstName || "",
        r.lastName || "",
        r.fullName || ""
      ].join(" ").toLowerCase(), y = m.some((f) => d.includes(f)), u = _.some((f) => d.includes(f));
      return y && u;
    });
    return console.log("Matched patients:", p), p;
  } catch (a) {
    throw console.error(`Error fetching user in ema: ${a}`), a;
  }
}
const h = /* @__PURE__ */ new Set(), g = /* @__PURE__ */ new Set();
async function $(o) {
  let t;
  if ((o.url.includes("dashboard.covermymeds.com/api/requests/") || o.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = o.url.split("/")[5].split("?")[0]), !(!t || h.has(t) || g.has(t))) {
    g.add(t);
    try {
      const s = await b(t), {
        patient_fname: e,
        patient_lname: a,
        patient_dob: i,
        drug: n,
        submitted_by: c,
        epa_status: l,
        workflow_status: m,
        submitted_by_user_category: _,
        completed: p
      } = s;
      if (console.log(e, a, n), console.log("Submitted by:", c), console.log("ePA status:", l), console.log("Details:", o), l === "PA Request - Sent to Plan" || o.url.includes(`faxconfirmation/${t}`)) {
        h.add(t);
        const r = await P(t, e, a, n);
        let d;
        try {
          d = await A(r), console.log("Download completed");
        } catch (u) {
          console.error("Error downloading: ", u);
        }
        console.log("PDF path:", d), console.log("Listener removed."), await new Promise((u) => {
          chrome.storage.local.get(["downloadHistory"], (f) => {
            let w = f.downloadHistory || [];
            w.unshift(d), w = w.slice(0, 10), chrome.storage.local.set({ downloadHistory: w }, u);
          });
        });
        const y = await E(i, e, a);
        console.log("Ema Patient:", y);
      } else (l === "PA Response" || l === "Question Response" && p !== "false" || m === "Sent to Plan") && h.add(t);
    } catch (s) {
      console.error(`Error processing pa ${t}:`, s);
    } finally {
      g.delete(t);
    }
  }
}
chrome.webRequest.onCompleted.addListener(
  $,
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
chrome.webNavigation.onHistoryStateUpdated.addListener((o) => {
  const t = o.url.match(/faxconfirmation\/([^/?#]+)/);
  if (t) {
    const s = t[1];
    !h.has(s) && !g.has(s) && (console.log("Detected faxconfirmation URL change for PA ID:", s), $({ url: o.url, tabId: o.tabId }));
  }
}, {
  url: [{ urlMatches: "https://www.covermymeds.com/request/faxconfirmation/" }]
});
async function v(o) {
  try {
    const t = await b(o), { patient_fname: s, patient_lname: e, patient_dob: a, drug: i, submitted_by: n, epa_status: c } = t;
    console.log(s, e, i);
    const l = await P(o, s, e, i), m = await A(l);
    console.log("PDF path:", m);
  } catch (t) {
    console.error(`Error in pdfManipulation for PA ID ${o}:`, t);
  }
}
export {
  v as pdfManipulation
};
