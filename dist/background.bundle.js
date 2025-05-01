function $(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const e of o.sections || [])
    for (const r of e.rows || [])
      for (const t of r.questions || []) {
        const n = t.question_text || t.label || t.name || "";
        if (/date of birth/i.test(n) || /patient_date_of_birth/i.test(n))
          return t.answer_text ?? t.answer ?? null;
      }
  return null;
}
async function b(o) {
  console.log(`Getting patient info with ID - ${o}`);
  const e = `https://dashboard.covermymeds.com/api/requests/${o}?`;
  try {
    const r = await fetch(e, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!r.ok)
      throw new Error(`HTTP ${r.status}`);
    const t = await r.json();
    return console.log("PA data:", t), {
      patient_fname: t.patient_fname,
      patient_lname: t.patient_lname,
      patient_dob: $(t),
      drug: t.drug.split(" ")[0],
      submitted_by: t.submitted_by,
      epa_status: t.ePA_Status_description,
      workflow_status: t.workflow_status,
      submitted_by_user_category: t.submitted_by_user_category,
      completed: t.completed
    };
  } catch (r) {
    throw console.error("Error fetching PA info:", r), r;
  }
}
async function P(o, e, r, t) {
  return new Promise((n, i) => {
    const a = `https://dashboard.covermymeds.com/api/requests/${o}/download`;
    console.log("downloadPA called:", a), chrome.downloads.download({
      url: a,
      filename: `${e}-${r}-${t}.pdf`
    }, (s) => {
      if (chrome.runtime.lastError)
        return i(chrome.runtime.lastError);
      console.log("Download started, id=", s), s ? n(s) : i(new Error("Failed to start download"));
    });
  });
}
function A(o) {
  return new Promise((e, r) => {
    const t = (n) => {
      var i, a;
      n.id === o && ((i = n.state) == null ? void 0 : i.current) === "complete" && (chrome.downloads.onChanged.removeListener(t), chrome.downloads.search({ id: o }, (s) => {
        s && s.length ? (console.log("Found download result:", s[0]), e(s[0].filename)) : r(new Error("No results found for downloadId"));
      })), n.id === o && ((a = n.state) == null ? void 0 : a.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(t), r(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(t), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(t), r(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function q(o, e, r) {
  console.log(`Trying to find the patient in ema: ${e} ${r} ${o}`);
  const t = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const n = {
      term: o,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, i = new URLSearchParams(n).toString(), a = await fetch(`${t}${i}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!a.ok)
      throw new Error(`HTTP ${a.status}`);
    const s = await a.json();
    console.log("EMA patient return data:", s);
    const l = Array.isArray(s) ? s : Array.isArray(s.patients) ? s.patients : [], m = e.toLowerCase().split(/\s+|-/).filter((c) => c), _ = r.toLowerCase().split(/\s+|-/).filter((c) => c), p = l.filter((c) => {
      const d = [
        c.firstName || "",
        c.lastName || "",
        c.fullName || ""
      ].join(" ").toLowerCase(), y = m.some((f) => d.includes(f)), u = _.some((f) => d.includes(f));
      return y && u;
    });
    return console.log("Matched patients:", p), p;
  } catch (n) {
    throw console.error(`Error fetching user in ema: ${n}`), n;
  }
}
const h = /* @__PURE__ */ new Set(), g = /* @__PURE__ */ new Set();
async function E(o) {
  let e;
  if ((o.url.includes("dashboard.covermymeds.com/api/requests/") || o.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (e = o.url.split("/")[5].split("?")[0]), !(!e || h.has(e) || g.has(e))) {
    g.add(e);
    try {
      const r = await b(e), {
        patient_fname: t,
        patient_lname: n,
        patient_dob: i,
        drug: a,
        submitted_by: s,
        epa_status: l,
        workflow_status: m,
        submitted_by_user_category: _,
        completed: p
      } = r;
      if (console.log(t, n, a), console.log("Submitted by:", s), console.log("ePA status:", l), console.log("Details:", o), l === "PA Request - Sent to Plan" || o.url.includes(`faxconfirmation/${e}`)) {
        h.add(e);
        const c = await P(e, t, n, a);
        let d;
        try {
          d = await A(c), console.log("Download completed");
        } catch (u) {
          console.error("Error downloading: ", u);
        }
        console.log("PDF path:", d), console.log("Listener removed."), await new Promise((u) => {
          chrome.storage.local.get(["downloadHistory"], (f) => {
            let w = f.downloadHistory || [];
            w.unshift(d), w = w.slice(0, 10), chrome.storage.local.set({ downloadHistory: w }, u);
          });
        });
        const y = await q(i, t, n);
        console.log("Ema Patient:", y);
      } else (l === "PA Response" || l === "Question Response" && p !== "false" || m === "Sent to Plan") && h.add(e);
    } catch (r) {
      console.error(`Error processing pa ${e}:`, r);
    } finally {
      g.delete(e);
    }
  }
}
chrome.webRequest.onCompleted.addListener(
  E,
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
chrome.webNavigation.onHistoryStateUpdated.addListener((o) => {
  const e = o.url.match(/faxconfirmation\/([^/?#]+)/);
  if (e) {
    const r = e[1];
    !h.has(r) && !g.has(r) && (console.log("Detected faxconfirmation URL change for PA ID:", r), E({ url: o.url, tabId: o.tabId }));
  }
}, {
  url: [{ urlMatches: "https://www.covermymeds.com/request/faxconfirmation/" }]
});
async function v(o) {
  try {
    const e = await b(o), { patient_fname: r, patient_lname: t, patient_dob: n, drug: i, submitted_by: a, epa_status: s } = e;
    console.log(r, t, i);
    const l = await P(o, r, t, i), m = await A(l);
    console.log("PDF path:", m);
  } catch (e) {
    console.error(`Error in pdfManipulation for PA ID ${o}:`, e);
  }
}
export {
  v as pdfManipulation
};
