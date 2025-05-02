function S(n) {
  if (n.patient_dob) return n.patient_dob;
  for (const e of n.sections || [])
    for (const r of e.rows || [])
      for (const t of r.questions || []) {
        const o = t.question_text || t.label || t.name || "";
        if (/date of birth/i.test(o) || /patient_date_of_birth/i.test(o))
          return t.answer_text ?? t.answer ?? null;
      }
  return null;
}
async function D(n) {
  console.log(`Getting patient info with ID - ${n}`);
  const e = `https://dashboard.covermymeds.com/api/requests/${n}?`;
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
      patient_dob: S(t),
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
async function N(n, e, r, t) {
  return new Promise((o, i) => {
    const a = `https://dashboard.covermymeds.com/api/requests/${n}/download`;
    console.log("downloadPA called:", a), chrome.downloads.download({
      url: a,
      filename: `${e}-${r}-${t}.pdf`
    }, (s) => {
      if (chrome.runtime.lastError)
        return i(chrome.runtime.lastError);
      console.log("Download started, id=", s), s ? o(s) : i(new Error("Failed to start download"));
    });
  });
}
function T(n) {
  return new Promise((e, r) => {
    const t = (o) => {
      var i, a;
      o.id === n && ((i = o.state) == null ? void 0 : i.current) === "complete" && (chrome.downloads.onChanged.removeListener(t), chrome.downloads.search({ id: n }, (s) => {
        s && s.length ? (console.log("Found download result:", s[0]), e(s[0].filename)) : r(new Error("No results found for downloadId"));
      })), o.id === n && ((a = o.state) == null ? void 0 : a.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(t), r(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(t), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(t), r(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function M(n, e, r) {
  console.log(`Trying to find the patient in ema: ${e} ${r} ${n}`);
  const t = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const o = {
      term: n,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, i = new URLSearchParams(o).toString(), a = await fetch(`${t}${i}`, {
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
    const p = Array.isArray(s) ? s : Array.isArray(s.patients) ? s.patients : [], y = e.toLowerCase().split(/\s+|-/).filter((c) => c), $ = r.toLowerCase().split(/\s+|-/).filter((c) => c), f = p.filter((c) => {
      const m = [
        c.firstName || "",
        c.lastName || "",
        c.fullName || ""
      ].join(" ").toLowerCase(), b = y.some((l) => m.includes(l)), P = $.some((l) => m.includes(l));
      return b && P;
    });
    return console.log("Matched patients:", f), f;
  } catch (o) {
    throw console.error(`Error fetching user in ema: ${o}`), o;
  }
}
async function k(n, e, r) {
  const t = new FormData();
  t.append(
    "dtoList",
    new Blob([JSON.stringify(e)], { type: "application/json" })
  ), t.append("file", r, r.name);
  try {
    console.log("Executing upload sctipt in tabid: ", n), chrome.scripting.executeScript({
      target: { tabId: n },
      func: (o) => (async () => {
        const i = new FormData();
        i.append(
          "dtoList",
          new Blob([o.dtoList], { type: "application/json" })
        ), i.append(
          "file",
          new Blob([Uint8Array.from(o.fileData)], { type: o.fileType }),
          o.fileName
        );
        try {
          return { success: !0, result: await (await fetch("https://khasak.ema.md/ema/ws/v3/fileAttachment/upload", {
            method: "POST",
            body: i
          })).json() };
        } catch (a) {
          return { success: !1, error: a.message };
        }
      })(),
      args: [{
        dtoList: JSON.stringify(e),
        fileData: Array.from(new Uint8Array(await r.arrayBuffer())),
        fileType: r.type,
        fileName: r.name
      }]
    }, (o) => {
      if (chrome.runtime.lastError)
        console.error("Script injection error:", chrome.runtime.lastError);
      else if (o && o[0] && o[0].result) {
        const { success: i, result: a, error: s } = o[0].result;
        i ? console.log("Upload result:", a) : console.error("Upload failed:", s);
      } else
        console.error("Upload failed: No result returned");
    });
  } catch (o) {
    console.error("Error during uploading a pdf: ", o.message);
  }
}
const g = /* @__PURE__ */ new Map(), A = /* @__PURE__ */ new Set();
async function v(n) {
  let e;
  if ((n.url.includes("dashboard.covermymeds.com/api/requests/") || n.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (e = n.url.split("/")[5].split("?")[0]), !(!e || A.has(e))) {
    A.add(e);
    try {
      g.has(e) || g.set(e, { downloaded: !1 });
      const r = await D(e), {
        patient_fname: t,
        patient_lname: o,
        patient_dob: i,
        drug: a,
        submitted_by: s,
        epa_status: p,
        workflow_status: y,
        submitted_by_user_category: $,
        completed: f
      } = r;
      console.log("Processing PA:", e, t, o, a);
      const c = p === "PA Request - Sent to Plan" || n.url.includes(`faxconfirmation/${e}`), m = p === "PA Response" || p === "Question Response" && f !== "false" || y === "Sent to Plan";
      if (!g.get(e).downloaded && (c || m)) {
        const b = await N(e, t, o, a), P = await T(b);
        if (console.log(`[PA ${e}] Downloaded file path:`, P), g.get(e).downloaded = !0, c) {
          const l = await M(i, t, o);
          if (console.log("Ema Patient:", l), l != null && l.length) {
            const { id: E } = l[0];
            console.log(`[PA ${e}] Uploading PDF for patientId=${E}`);
            let w = null;
            try {
              const h = (await chrome.tabs.query({})).find((_) => {
                var u;
                return (u = _.url) == null ? void 0 : u.includes("ema.md");
              });
              h && (w = h.id, console.log(`[PA ${e}] Found EMA tab ID:`, w));
            } catch (d) {
              console.error(`[PA ${e}] Error finding EMA tab:`, d);
            }
            if (w)
              try {
                const d = await fetch(
                  `https://dashboard.covermymeds.com/api/requests/${e}/download`,
                  { credentials: "include" }
                );
                if (!d.ok) throw new Error(`PDF fetch failed: ${d.statusText}`);
                const h = await d.blob(), _ = `${t}-${o}-${a}.pdf`, u = new File([h], _, { type: "application/pdf" }), L = [{
                  patient: { id: E, lastName: o, firstName: t },
                  additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
                  fileName: u.name,
                  title: `${a} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
                }], q = await k(w, L, u);
                console.log(`[PA ${e}] EMA upload result:`, q);
              } catch (d) {
                console.error(`[PA ${e}] Upload error:`, d);
              }
          }
        }
      }
    } catch (r) {
      console.error(`[PA ${e}] Error:`, r);
    } finally {
      A.delete(e);
    }
  }
}
chrome.webRequest.onCompleted.addListener(
  v,
  { urls: ["*://*.covermymeds.com/*"] }
);
async function F(n) {
  try {
    const e = await D(n), { patient_fname: r, patient_lname: t, drug: o } = e, i = await N(n, r, t, o), a = await T(i);
    console.log("[Manual] PDF path:", a);
  } catch (e) {
    console.error(`[Manual] Error in pdfManipulation for PA ID ${n}:`, e);
  }
}
export {
  F as pdfManipulation
};
