function b(s) {
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
async function P(s) {
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
      patient_dob: b(o),
      drug: o.drug.split(" ")[0],
      submitted_by: o.submitted_by,
      epa_status: o.ePA_Status_description,
      workflow_status: o.workflow_status,
      submitted_by_user_category: o.submitted_by_user_category,
      completed: o.completed
    };
  } catch (e) {
    throw console.error("Error fetching PA info:", e), e;
  }
}
async function A(s, t, e, o) {
  return new Promise((n) => {
    const u = `https://dashboard.covermymeds.com/api/requests/${s}/download`;
    console.log("downloadPA called"), chrome.downloads.download({
      url: u,
      filename: `${t}-${e}-${o}.pdf`
    }, (a) => {
      console.log("Download started, id=", a), a && n(a);
    });
  });
}
function $(s) {
  return new Promise((t, e) => {
  });
}
async function q(s, t, e) {
  console.log(`Trying to find the patient in ema: ${t} ${e} ${s}`);
  const o = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const n = {
      term: s,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, u = new URLSearchParams(n).toString(), a = await fetch(`${o}${u}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!a.ok)
      throw new Error(`HTTP ${a.status}`);
    const c = await a.json();
    console.log("EMA patient return data:", c);
    const l = Array.isArray(c) ? c : Array.isArray(c.patients) ? c.patients : [], h = t.toLowerCase().split(/\s+|-/).filter((r) => r), g = e.toLowerCase().split(/\s+|-/).filter((r) => r), m = l.filter((r) => {
      const d = [
        r.firstName || "",
        r.lastName || "",
        r.fullName || ""
      ].join(" ").toLowerCase(), i = h.some((w) => d.includes(w)), _ = g.some((w) => d.includes(w));
      return i && _;
    });
    return console.log("Matched patients:", m), m;
  } catch (n) {
    throw console.error(`Error fetching user in ema: ${n}`), n;
  }
}
const f = /* @__PURE__ */ new Set(), p = /* @__PURE__ */ new Set();
function y(s) {
  let t;
  (s.url.includes("dashboard.covermymeds.com/api/requests/") || s.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = s.url.split("/")[5], t.includes("?") && (t = t.split("?")[0])), !(!t || f.has(t) || p.has(t)) && (p.add(t), P(t).then((e) => {
    const {
      patient_fname: o,
      patient_lname: n,
      patient_dob: u,
      drug: a,
      submitted_by: c,
      epa_status: l,
      workflow_status: h,
      submitted_by_user_category: g,
      completed: m
    } = e;
    console.log(o, n, a), console.log("Submitted by: ", c), console.log("ePA status: ", l), console.log("Details: ", s), l === "PA Request - Sent to Plan" || // checking status for pas that are sent, but didn't go to the faxconfirmation page
    s.url.includes(`faxconfirmation/${t}`) ? (f.add(t), A(t, o, n, a).then((r) => $()).then((r) => {
      console.log("PDF path: ", r), console.log("Listener removed."), chrome.storage.local.get(["downloadHistory"], (d) => {
        let i = d.downloadHistory || [];
        i.unshift(r), i = i.slice(0, 10), chrome.storage.local.set({ downloadHistory: i });
      });
    }).then((r, d, i) => q(r, d, i)).then((r) => {
      console.log("Ema Patient: ", r);
    })) : (l === "PA Response" || l === "Question Response" && m !== "false" || h === "Sent to Plan") && f.add(t);
  }).catch((e) => {
    console.error(`Error processing pa ${t}: `, e);
  }).finally(() => {
    p.delete(t);
  }));
}
chrome.webRequest.onCompleted.addListener(
  y,
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
chrome.webNavigation.onHistoryStateUpdated.addListener((s) => {
  const t = s.url.match(/faxconfirmation\/([^/?#]+)/);
  if (t) {
    const e = t[1];
    if (f.has(e) || p.has(e)) return;
    console.log("Detected faxconfirmation URL change for PA ID:", e), y({ url: s.url, tabId: s.tabId });
  }
}, {
  url: [{ urlMatches: "https://www.covermymeds.com/request/faxconfirmation/" }]
});
