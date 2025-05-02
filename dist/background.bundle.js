function N(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const t of o.sections || [])
    for (const a of t.rows || [])
      for (const e of a.questions || []) {
        const n = e.question_text || e.label || e.name || "";
        if (/date of birth/i.test(n) || /patient_date_of_birth/i.test(n))
          return e.answer_text ?? e.answer ?? null;
      }
  return null;
}
async function _(o) {
  console.log(`Getting patient info with ID - ${o}`);
  const t = `https://dashboard.covermymeds.com/api/requests/${o}?`;
  try {
    const a = await fetch(t, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!a.ok)
      throw new Error(`HTTP ${a.status}`);
    const e = await a.json();
    return console.log("PA data:", e), {
      patient_fname: e.patient_fname,
      patient_lname: e.patient_lname,
      patient_dob: N(e),
      drug: e.drug.split(" ")[0],
      submitted_by: e.submitted_by,
      epa_status: e.ePA_Status_description,
      workflow_status: e.workflow_status,
      submitted_by_user_category: e.submitted_by_user_category,
      completed: e.completed
    };
  } catch (a) {
    throw console.error("Error fetching PA info:", a), a;
  }
}
async function $(o, t, a, e) {
  return new Promise((n, i) => {
    const s = `https://dashboard.covermymeds.com/api/requests/${o}/download`;
    console.log("downloadPA called:", s), chrome.downloads.download({
      url: s,
      filename: `${t}-${a}-${e}.pdf`
    }, (r) => {
      if (chrome.runtime.lastError)
        return i(chrome.runtime.lastError);
      console.log("Download started, id=", r), r ? n(r) : i(new Error("Failed to start download"));
    });
  });
}
function A(o) {
  return new Promise((t, a) => {
    const e = (n) => {
      var i, s;
      n.id === o && ((i = n.state) == null ? void 0 : i.current) === "complete" && (chrome.downloads.onChanged.removeListener(e), chrome.downloads.search({ id: o }, (r) => {
        r && r.length ? (console.log("Found download result:", r[0]), t(r[0].filename)) : a(new Error("No results found for downloadId"));
      })), n.id === o && ((s = n.state) == null ? void 0 : s.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(e), a(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(e), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(e), a(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function L(o, t, a) {
  console.log(`Trying to find the patient in ema: ${t} ${a} ${o}`);
  const e = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const n = {
      term: o,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, i = new URLSearchParams(n).toString(), s = await fetch(`${e}${i}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!s.ok)
      throw new Error(`HTTP ${s.status}`);
    const r = await s.json();
    console.log("EMA patient return data:", r);
    const c = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], w = t.toLowerCase().split(/\s+|-/).filter((m) => m), b = a.toLowerCase().split(/\s+|-/).filter((m) => m), h = c.filter((m) => {
      const f = [
        m.firstName || "",
        m.lastName || "",
        m.fullName || ""
      ].join(" ").toLowerCase(), p = w.some((l) => f.includes(l)), d = b.some((l) => f.includes(l));
      return p && d;
    });
    return console.log("Matched patients:", h), h;
  } catch (n) {
    throw console.error(`Error fetching user in ema: ${n}`), n;
  }
}
async function v({ patientId: o, patientLname: t, patientFname: a, drug: e, file: n }) {
  if (!(n instanceof Blob))
    throw new Error("`file` must be a Blob or File");
  console.log("Upload PDF called");
  const i = [{
    patient: {
      id: o,
      lastName: t,
      firstName: a
    },
    additionalInfo: {
      performedDate: (/* @__PURE__ */ new Date()).toISOString()
    },
    fileName: n.name,
    title: `${e} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
  }], s = new FormData();
  s.append(
    "dtoList",
    new Blob([JSON.stringify(i)], { type: "application/json" }),
    "dtoList.json"
  ), s.append("files", n, n.name);
  const r = await fetch(
    "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
    {
      method: "POST",
      credentials: "include",
      body: s
    }
  );
  if (!r.ok) {
    const c = await r.text();
    throw new Error(`Upload failed ${r.status}: ${c}`);
  }
}
const g = /* @__PURE__ */ new Set(), y = /* @__PURE__ */ new Set();
async function D(o) {
  let t;
  if ((o.url.includes("dashboard.covermymeds.com/api/requests/") || o.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = o.url.split("/")[5].split("?")[0]), !(!t || g.has(t) || y.has(t))) {
    y.add(t);
    try {
      const a = await _(t), {
        patient_fname: e,
        patient_lname: n,
        patient_dob: i,
        drug: s,
        submitted_by: r,
        epa_status: c,
        workflow_status: w,
        submitted_by_user_category: b,
        completed: h
      } = a;
      if (console.log(e, n, s), console.log("Submitted by:", r), console.log("ePA status:", c), console.log("Details:", o), c === "PA Request - Sent to Plan" || o.url.includes(`faxconfirmation/${t}`)) {
        g.add(t);
        const m = await $(t, e, n, s);
        let f;
        try {
          f = await A(m), console.log("Download completed");
        } catch (d) {
          console.error("Error downloading: ", d);
        }
        console.log("PDF path:", f), console.log("Listener removed."), await new Promise((d) => {
          chrome.storage.local.get(["downloadHistory"], (l) => {
            let u = l.downloadHistory || [];
            u.unshift(f), u = u.slice(0, 10), chrome.storage.local.set({ downloadHistory: u }, d);
          });
        });
        const p = await L(i, e, n);
        if (console.log("Ema Patient:", p), p && p.length) {
          const { id: d } = p[0];
          console.log(`[PA ${t}] uploading PDF for patientId=${d}`);
          try {
            console.log(`[PA ${t}] fetching PDF over network for upload`);
            const l = await fetch(
              `https://dashboard.covermymeds.com/api/requests/${t}/download`,
              { credentials: "include" }
            );
            if (!l.ok)
              throw new Error(`PDF fetch failed ${l.status}: ${l.statusText}`);
            const u = await l.blob(), E = `${e}-${n}-${s}.pdf`, P = new File([u], E, { type: "application/pdf" }), q = [{
              patient: { id: d, lastName: n, firstName: e },
              additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
              fileName: P.name,
              title: `${s} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
            }];
            console.log(`[PA ${t}] uploading to EMA for patient ${d}`);
            const S = await v({
              patientId: d,
              patientLname: n,
              patientFname: e,
              drug: s,
              file: P
            });
            console.log(`[PA ${t}] EMA upload result:`, S);
          } catch (l) {
            console.error(`[PA ${t}] local file→EMA error:`, l);
          }
        }
      } else (c === "PA Response" || c === "Question Response" && h !== "false" || w === "Sent to Plan") && g.add(t);
    } catch (a) {
      console.error(`Error processing pa ${t}:`, a);
    } finally {
      y.delete(t);
    }
  }
}
chrome.webRequest.onCompleted.addListener(
  D,
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
chrome.webNavigation.onHistoryStateUpdated.addListener((o) => {
  const t = o.url.match(/faxconfirmation\/([^/?#]+)/);
  if (t) {
    const a = t[1];
    !g.has(a) && !y.has(a) && (console.log("Detected faxconfirmation URL change for PA ID:", a), D({ url: o.url, tabId: o.tabId }));
  }
}, {
  url: [{ urlMatches: "https://www.covermymeds.com/request/faxconfirmation/" }]
});
async function F(o) {
  try {
    const t = await _(o), { patient_fname: a, patient_lname: e, patient_dob: n, drug: i, submitted_by: s, epa_status: r } = t;
    console.log(a, e, i);
    const c = await $(o, a, e, i), w = await A(c);
    console.log("PDF path:", w);
  } catch (t) {
    console.error(`Error in pdfManipulation for PA ID ${o}:`, t);
  }
}
export {
  F as pdfManipulation
};
