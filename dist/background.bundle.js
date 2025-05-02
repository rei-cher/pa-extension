function M(n) {
  if (n.patient_dob) return n.patient_dob;
  for (const t of n.sections || [])
    for (const r of t.rows || [])
      for (const a of r.questions || []) {
        const e = a.question_text || a.label || a.name || "";
        if (/date of birth/i.test(e) || /patient_date_of_birth/i.test(e))
          return a.answer_text ?? a.answer ?? null;
      }
  return null;
}
async function N(n) {
  var r, a;
  console.log(`Getting patient info with ID - ${n}`);
  const t = `https://dashboard.covermymeds.com/api/requests/${n}?`;
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
      patient_dob: M(o),
      drug: o.drug.split(" ")[0],
      submitted_by: o.submitted_by,
      epa_status: o.ePA_Status_description,
      workflow_status: o.workflow_status,
      submitted_by_user_category: o.submitted_by_user_category,
      completed: o.completed,
      status_dialog: (r = o.status_dialog_loading) != null && r.text ? o.status_dialog_loading.text : null,
      status_dialog_loading: (a = o.status_dialog_loading) != null && a.text ? o.status_dialog_loading.text : null
    };
  } catch (e) {
    throw console.error("Error fetching PA info:", e), e;
  }
}
async function T(n, t, r, a) {
  return new Promise((e, o) => {
    const i = `https://dashboard.covermymeds.com/api/requests/${n}/download`;
    console.log("downloadPA called:", i), chrome.downloads.download({
      url: i,
      filename: `${t}-${r}-${a}.pdf`
    }, (s) => {
      if (chrome.runtime.lastError)
        return o(chrome.runtime.lastError);
      console.log("Download started, id=", s), s ? e(s) : o(new Error("Failed to start download"));
    });
  });
}
function q(n) {
  return new Promise((t, r) => {
    const a = (e) => {
      var o, i;
      e.id === n && ((o = e.state) == null ? void 0 : o.current) === "complete" && (chrome.downloads.onChanged.removeListener(a), chrome.downloads.search({ id: n }, (s) => {
        s && s.length ? (console.log("Found download result:", s[0]), t(s[0].filename)) : r(new Error("No results found for downloadId"));
      })), e.id === n && ((i = e.state) == null ? void 0 : i.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(a), r(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(a), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(a), r(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function k(n, t, r) {
  console.log(`Trying to find the patient in ema: ${t} ${r} ${n}`);
  const a = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const e = {
      term: n,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, o = new URLSearchParams(e).toString(), i = await fetch(`${a}${o}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!i.ok)
      throw new Error(`HTTP ${i.status}`);
    const s = await i.json();
    console.log("EMA patient return data:", s);
    const E = Array.isArray(s) ? s : Array.isArray(s.patients) ? s.patients : [], d = t.toLowerCase().split(/\s+|-/).filter((l) => l), y = r.toLowerCase().split(/\s+|-/).filter((l) => l), _ = E.filter((l) => {
      const P = [
        l.firstName || "",
        l.lastName || "",
        l.fullName || ""
      ].join(" ").toLowerCase(), b = d.some((p) => P.includes(p)), w = y.some((p) => P.includes(p));
      return b && w;
    });
    return console.log("Matched patients:", _), _;
  } catch (e) {
    throw console.error(`Error fetching user in ema: ${e}`), e;
  }
}
async function F(n, t, r) {
  const a = new FormData();
  a.append(
    "dtoList",
    new Blob([JSON.stringify(t)], { type: "application/json" })
  ), a.append("file", r, r.name);
  try {
    console.log("Executing upload sctipt in tabid: ", n), chrome.scripting.executeScript({
      target: { tabId: n },
      func: (e) => (async () => {
        const o = new FormData();
        o.append(
          "dtoList",
          new Blob([e.dtoList], { type: "application/json" })
        ), o.append(
          "file",
          new Blob([Uint8Array.from(e.fileData)], { type: e.fileType }),
          e.fileName
        );
        try {
          return { success: !0, result: await (await fetch("https://khasak.ema.md/ema/ws/v3/fileAttachment/upload", {
            method: "POST",
            body: o
          })).json() };
        } catch (i) {
          return { success: !1, error: i.message };
        }
      })(),
      args: [{
        dtoList: JSON.stringify(t),
        fileData: Array.from(new Uint8Array(await r.arrayBuffer())),
        fileType: r.type,
        fileName: r.name
      }]
    }, (e) => {
      if (chrome.runtime.lastError)
        console.error("Script injection error:", chrome.runtime.lastError);
      else if (e && e[0] && e[0].result) {
        const { success: o, result: i, error: s } = e[0].result;
        o ? console.log("Upload result:", i) : console.error("Upload failed:", s);
      } else
        console.error("Upload failed: No result returned");
    });
  } catch (e) {
    console.error("Error during uploading a pdf: ", e.message);
  }
}
const u = /* @__PURE__ */ new Map(), $ = /* @__PURE__ */ new Set();
setInterval(() => {
  console.log("===Processed PAs===");
  for (const [n, t] of u.entries())
    console.log(`PA id: ${n}: downloaded - ${t.downloaded}`);
}, 3e4);
async function I(n) {
  let t;
  if ((n.url.includes("dashboard.covermymeds.com/api/requests/") || n.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = n.url.split("/")[5].split("?")[0]), !t || $.has(t)) return;
  const r = u.get(t);
  if (r != null && r.downloaded) {
    console.log(`[PA ${t}] Ignored`);
    return;
  }
  $.add(t);
  try {
    u.has(t) || u.set(t, { downloaded: !1 });
    const a = await N(t), {
      patient_fname: e,
      patient_lname: o,
      patient_dob: i,
      drug: s,
      submitted_by: E,
      epa_status: d,
      workflow_status: y,
      submitted_by_user_category: _,
      completed: l,
      status_dialog: P,
      status_dialog_loading: b
    } = a;
    console.log("Processing PA:", t, e, o, s);
    const w = d === "PA Request - Sent to Plan" || n.url.includes(`faxconfirmation/${t}`), p = d === "PA Response" || d === "Question Response" && l !== "false" || y === "Sent to Plan" || d === "PA Request - Sent to Plan" && b.length;
    if (!u.get(t).downloaded && (w || p)) {
      const L = await T(t, e, o, s), S = await q(L);
      if (console.log(`[PA ${t}] Downloaded file path:`, S), u.get(t).downloaded = !0, w) {
        const f = await k(i, e, o);
        if (console.log("Ema Patient:", f), f != null && f.length) {
          const { id: D } = f[0];
          console.log(`[PA ${t}] Uploading PDF for patientId=${D}`);
          let g = null;
          try {
            const h = (await chrome.tabs.query({})).find((A) => {
              var m;
              return (m = A.url) == null ? void 0 : m.includes("ema.md");
            });
            h && (g = h.id, console.log(`[PA ${t}] Found EMA tab ID:`, g));
          } catch (c) {
            console.error(`[PA ${t}] Error finding EMA tab:`, c);
          }
          if (g)
            try {
              const c = await fetch(
                `https://dashboard.covermymeds.com/api/requests/${t}/download`,
                { credentials: "include" }
              );
              if (!c.ok) throw new Error(`PDF fetch failed: ${c.statusText}`);
              const h = await c.blob(), A = `${e}-${o}-${s}.pdf`, m = new File([h], A, { type: "application/pdf" }), x = [{
                patient: { id: D, lastName: o, firstName: e },
                additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
                fileName: m.name,
                title: `${s} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
              }], v = await F(g, x, m);
              console.log(`[PA ${t}] EMA upload result:`, v);
            } catch (c) {
              console.error(`[PA ${t}] Upload error:`, c);
            }
        }
      }
    } else
      return;
  } catch (a) {
    console.error(`[PA ${t}] Error:`, a);
  } finally {
    $.delete(t);
  }
}
chrome.webRequest.onCompleted.addListener(
  I,
  { urls: ["*://*.covermymeds.com/*"] }
);
async function C(n) {
  try {
    const t = await N(n), { patient_fname: r, patient_lname: a, drug: e } = t, o = await T(n, r, a, e), i = await q(o);
    console.log("[Manual] PDF path:", i);
  } catch (t) {
    console.error(`[Manual] Error in pdfManipulation for PA ID ${n}:`, t);
  }
}
export {
  C as pdfManipulation
};
