function v(n) {
  if (n.patient_dob) return n.patient_dob;
  for (const t of n.sections || [])
    for (const o of t.rows || [])
      for (const e of o.questions || []) {
        const r = e.question_text || e.label || e.name || "";
        if (/date of birth/i.test(r) || /patient_date_of_birth/i.test(r))
          return e.answer_text ?? e.answer ?? null;
      }
  return null;
}
async function $(n) {
  console.log(`Getting patient info with ID - ${n}`);
  const t = `https://dashboard.covermymeds.com/api/requests/${n}?`;
  try {
    const o = await fetch(t, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!o.ok)
      throw new Error(`HTTP ${o.status}`);
    const e = await o.json();
    return console.log("PA data:", e), {
      patient_fname: e.patient_fname,
      patient_lname: e.patient_lname,
      patient_dob: v(e),
      drug: e.drug.split(" ")[0],
      submitted_by: e.submitted_by,
      epa_status: e.ePA_Status_description,
      workflow_status: e.workflow_status,
      submitted_by_user_category: e.submitted_by_user_category,
      completed: e.completed
    };
  } catch (o) {
    throw console.error("Error fetching PA info:", o), o;
  }
}
async function E(n, t, o, e) {
  return new Promise((r, i) => {
    const a = `https://dashboard.covermymeds.com/api/requests/${n}/download`;
    console.log("downloadPA called:", a), chrome.downloads.download({
      url: a,
      filename: `${t}-${o}-${e}.pdf`
    }, (s) => {
      if (chrome.runtime.lastError)
        return i(chrome.runtime.lastError);
      console.log("Download started, id=", s), s ? r(s) : i(new Error("Failed to start download"));
    });
  });
}
function D(n) {
  return new Promise((t, o) => {
    const e = (r) => {
      var i, a;
      r.id === n && ((i = r.state) == null ? void 0 : i.current) === "complete" && (chrome.downloads.onChanged.removeListener(e), chrome.downloads.search({ id: n }, (s) => {
        s && s.length ? (console.log("Found download result:", s[0]), t(s[0].filename)) : o(new Error("No results found for downloadId"));
      })), r.id === n && ((a = r.state) == null ? void 0 : a.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(e), o(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(e), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(e), o(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function S(n, t, o) {
  console.log(`Trying to find the patient in ema: ${t} ${o} ${n}`);
  const e = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const r = {
      term: n,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, i = new URLSearchParams(r).toString(), a = await fetch(`${e}${i}`, {
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
    const d = Array.isArray(s) ? s : Array.isArray(s.patients) ? s.patients : [], f = t.toLowerCase().split(/\s+|-/).filter((c) => c), A = o.toLowerCase().split(/\s+|-/).filter((c) => c), h = d.filter((c) => {
      const w = [
        c.firstName || "",
        c.lastName || "",
        c.fullName || ""
      ].join(" ").toLowerCase(), u = f.some((m) => w.includes(m)), p = A.some((m) => w.includes(m));
      return u && p;
    });
    return console.log("Matched patients:", h), h;
  } catch (r) {
    throw console.error(`Error fetching user in ema: ${r}`), r;
  }
}
async function T(n, t, o) {
  const e = new FormData();
  e.append(
    "dtoList",
    new Blob([JSON.stringify(t)], { type: "application/json" })
  ), e.append("file", o, o.name);
  try {
    console.log("Executing upload sctipt in tabid: ", n), chrome.scripting.executeScript(
      {
        target: { tabId: n },
        func: async (r) => {
          const i = new FormData();
          i.append(
            "dtoList",
            new Blob([r.dtoList], { type: "application/json" })
          ), i.append(
            "file",
            new Blob([Uint8Array.from(r.fileData)], { type: r.fileType }),
            r.fileName
          );
          const a = await fetch("https://khasak.ema.md/ema/ws/v3/fileAttachment/upload", {
            method: "POST",
            body: i
          });
          return console.log("Response after fetch: ", a), await a.json();
        },
        args: [{
          dtoList: JSON.stringify(t),
          fileData: Array.from(new Uint8Array(await o.arrayBuffer())),
          // serialize file bytes
          fileType: o.type,
          fileName: o.name
        }]
      },
      (r) => {
        chrome.runtime.lastError ? console.error("Script injection error:", chrome.runtime.lastError) : console.log("Upload result:", r[0].result);
      }
    );
  } catch (r) {
    console.error("Error during uploading a pdf: ", r.message);
  }
}
const b = /* @__PURE__ */ new Set(), P = /* @__PURE__ */ new Set();
async function N(n) {
  let t;
  if ((n.url.includes("dashboard.covermymeds.com/api/requests/") || n.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = n.url.split("/")[5].split("?")[0]), !(!t || b.has(t) || P.has(t))) {
    P.add(t);
    try {
      const o = await $(t), {
        patient_fname: e,
        patient_lname: r,
        patient_dob: i,
        drug: a,
        submitted_by: s,
        epa_status: d,
        workflow_status: f,
        submitted_by_user_category: A,
        completed: h
      } = o;
      if (console.log(e, r, a), console.log("Submitted by:", s), console.log("ePA status:", d), console.log("Details:", n), d === "PA Request - Sent to Plan" || n.url.includes(`faxconfirmation/${t}`)) {
        b.add(t);
        const c = await E(t, e, r, a);
        let w;
        try {
          w = await D(c), console.log("Download completed");
        } catch (p) {
          console.error("Error downloading: ", p);
        }
        console.log("PDF path:", w), console.log("Listener removed.");
        const u = await S(i, e, r);
        if (console.log("Ema Patient:", u), u && u.length) {
          const { id: p } = u[0];
          console.log(`[PA ${t}] uploading PDF for patientId=${p}`);
          let m = null;
          try {
            const g = (await chrome.tabs.query({})).find((y) => y.url && y.url.includes("ema.md"));
            g ? (m = g.id, console.log(`[PA ${t}] Found EMA tab ID:`, m)) : console.warn(`[PA ${t}] No EMA tab found`);
          } catch (l) {
            console.error(`[PA ${t}] Error finding EMA tab:`, l);
          }
          if (m)
            try {
              console.log(`[PA ${t}] fetching PDF over network for upload`);
              const l = await fetch(
                `https://dashboard.covermymeds.com/api/requests/${t}/download`,
                { credentials: "include" }
              );
              if (!l.ok)
                throw new Error(`PDF fetch failed ${l.status}: ${l.statusText}`);
              const g = await l.blob(), y = `${e}-${r}-${a}.pdf`, _ = new File([g], y, { type: "application/pdf" }), L = [{
                patient: { id: p, lastName: r, firstName: e },
                additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
                fileName: _.name,
                title: `${a} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
              }];
              console.log(`[PA ${t}] uploading to EMA for patient ${p}`);
              const q = await T(
                m,
                L,
                _
              );
              console.log(`[PA ${t}] EMA upload result:`, q);
            } catch (l) {
              console.error(`[PA ${t}] local file→EMA error:`, l);
            }
        }
      } else (d === "PA Response" || d === "Question Response" && h !== "false" || f === "Sent to Plan") && b.add(t);
    } catch (o) {
      console.error(`Error processing pa ${t}:`, o);
    } finally {
      P.delete(t);
    }
  }
}
chrome.webRequest.onCompleted.addListener(
  N,
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
chrome.webNavigation.onHistoryStateUpdated.addListener((n) => {
  const t = n.url.match(/faxconfirmation\/([^/?#]+)/);
  if (t) {
    const o = t[1];
    !b.has(o) && !P.has(o) && (console.log("Detected faxconfirmation URL change for PA ID:", o), N({ url: n.url, tabId: n.tabId }));
  }
}, {
  url: [{ urlMatches: "https://www.covermymeds.com/request/faxconfirmation/" }]
});
async function F(n) {
  try {
    const t = await $(n), { patient_fname: o, patient_lname: e, patient_dob: r, drug: i, submitted_by: a, epa_status: s } = t;
    console.log(o, e, i);
    const d = await E(n, o, e, i), f = await D(d);
    console.log("PDF path:", f);
  } catch (t) {
    console.error(`Error in pdfManipulation for PA ID ${n}:`, t);
  }
}
export {
  F as pdfManipulation
};
