function M(a) {
  if (a.patient_dob) return a.patient_dob;
  for (const t of a.sections || [])
    for (const s of t.rows || [])
      for (const o of s.questions || []) {
        const n = o.question_text || o.label || o.name || "";
        if (/date of birth/i.test(n) || /patient_date_of_birth/i.test(n))
          return o.answer_text ?? o.answer ?? null;
      }
  return null;
}
async function C(a) {
  var s, o;
  console.log(`Getting patient info with ID - ${a}`);
  const t = `https://dashboard.covermymeds.com/api/requests/${a}?`;
  try {
    const n = await fetch(t, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!n.ok)
      throw new Error(`HTTP ${n.status}`);
    const e = await n.json();
    return console.log("PA data:", e), {
      patient_fname: e.patient_fname,
      patient_lname: e.patient_lname,
      patient_dob: M(e),
      drug: e.drug.split(" ")[0],
      submitted_by: e.submitted_by,
      epa_status_description: e.ePA_Status_description,
      workflow_status: e.workflow_status,
      submitted_by_user_category: e.submitted_by_user_category,
      completed: e.completed,
      status_dialog: (s = e.status_dialog_loading) != null && s.text ? e.status_dialog_loading.text : null,
      status_dialog_loading: (o = e.status_dialog_loading) != null && o.text ? e.status_dialog_loading.text : null,
      sent: e != null && e.sent ? e.sent : null
    };
  } catch (n) {
    throw console.error("Error fetching PA info:", n), n;
  }
}
async function T(a, t, s, o) {
  return console.warn("[pa-downloader] Download function is called"), new Promise((n, e) => {
    const i = `https://dashboard.covermymeds.com/api/requests/${a}/download`;
    console.log("downloadPA called:", i), chrome.downloads.download({
      url: i,
      filename: `${t}-${s}-${o}.pdf`
    }, (r) => {
      if (chrome.runtime.lastError)
        return e(chrome.runtime.lastError);
      console.log("Download started, id=", r), r ? n(r) : e(new Error("Failed to start download"));
    });
  });
}
function N(a) {
  return console.warn("[pa-downloader] waitForDownloadFilename function called"), new Promise((t, s) => {
    const o = (n) => {
      var e, i;
      n.id === a && ((e = n.state) == null ? void 0 : e.current) === "complete" && (chrome.downloads.onChanged.removeListener(o), chrome.downloads.search({ id: a }, (r) => {
        r && r.length ? (console.log("Found download result:", r[0]), t(r[0].filename)) : s(new Error("No results found for downloadId"));
      })), n.id === a && ((i = n.state) == null ? void 0 : i.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(o), s(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(o), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(o), s(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function k(a, t, s) {
  console.log(`Trying to find the patient in ema: ${t} ${s} ${a}`);
  const o = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const n = {
      term: a,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, e = new URLSearchParams(n).toString(), i = await fetch(`${o}${e}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!i.ok)
      throw new Error(`HTTP ${i.status}`);
    const r = await i.json();
    console.log("EMA patient return data:", r);
    const u = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], d = t.toLowerCase().split(/\s+|-/).filter((l) => l), f = s.toLowerCase().split(/\s+|-/).filter((l) => l), g = u.filter((l) => {
      const h = [
        l.firstName || "",
        l.lastName || "",
        l.fullName || ""
      ].join(" ").toLowerCase(), _ = d.some((c) => h.includes(c)), y = f.some((c) => h.includes(c));
      return _ && y;
    });
    return console.log("Matched patients:", g), g;
  } catch (n) {
    throw console.error(`Error fetching user in ema: ${n}`), n;
  }
}
async function R(a, t, s) {
  try {
    const o = new FormData();
    o.append("dtoList", JSON.stringify(t));
    const n = new Blob([await s.arrayBuffer()], { type: s.type });
    o.append("files", n, s.name);
    for (let r of o.entries())
      console.log(r[0], r[1]);
    const e = await fetch(
      "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
      {
        method: "POST",
        body: o
      }
    );
    return e.ok || (console.error(e), console.error(e.statusText)), await e.json();
  } catch (o) {
    console.error("Upload error:", o);
  }
}
const I = "pa_csv_log", F = [
  "pa_id",
  "First Name",
  "Last Name",
  "DOB",
  "Drug",
  "Submitted by",
  "Submitted at",
  "Status",
  "Insurance",
  "Pt Ema ID"
].join(",") + `
`;
async function O(a) {
  const {
    pa_id: t,
    patient_fname: s,
    patient_lname: o,
    patient_dob: n,
    drug: e,
    submitted_by: i,
    patientId: r
  } = a, u = /* @__PURE__ */ new Date(), d = String(u.getMonth() + 1).padStart(2, "0"), f = String(u.getDate()).padStart(2, "0"), g = u.getFullYear(), l = `${d}/${f}/${g}`;
  function h($) {
    const m = String($ ?? "");
    return m.includes(",") || m.includes('"') || m.includes(`
`) ? `"${m.replace(/"/g, '""')}"` : m;
  }
  const _ = [
    `=HYPERLINK("https://dashboard.covermymeds.com/v2/requests/${t}", "${t}")`,
    s,
    o,
    n,
    e,
    i,
    l,
    "Pending",
    "",
    r
  ].map(h).join(",") + `
`, { pa_csv_log: y = F } = await chrome.storage.local.get(I), c = y + _;
  await chrome.storage.local.set({ [I]: c }), await B(c);
}
async function B(a) {
  const { pa_csv_log: t = F } = await chrome.storage.local.get(I), o = "data:text/csv;charset=utf-8," + encodeURIComponent(a || t);
  chrome.downloads.download({
    url: o,
    filename: "pa_log.csv",
    conflictAction: "overwrite",
    saveAs: !1
  }, (n) => {
    console.log("[CSV Logger] download triggered:", n);
  });
}
const p = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Set();
function U() {
  const a = /* @__PURE__ */ new Date(), t = a.getFullYear(), s = String(a.getMonth() + 1).padStart(2, "0"), o = String(a.getDate()).padStart(2, "0");
  return `${t}-${s}-${o}`;
}
setInterval(() => {
  console.log("===Processed PAs===");
  for (const [a, t] of p.entries())
    console.log(`PA id: ${a}: downloaded - ${t.downloaded}`);
}, 5e3);
async function j(a) {
  let t;
  if ((a.url.includes("dashboard.covermymeds.com/api/requests/") || a.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = a.url.split("/")[5].split("?")[0]), !t || v.has(t)) return;
  const s = p.get(t);
  if (s != null && s.downloaded) {
    console.log(`[PA ${t}] Ignored`);
    return;
  }
  v.add(t);
  try {
    p.has(t) || p.set(t, { downloaded: !1 });
    const o = await C(t), {
      patient_fname: n,
      patient_lname: e,
      patient_dob: i,
      drug: r,
      submitted_by: u,
      epa_status_description: d,
      workflow_status: f,
      submitted_by_user_category: g,
      completed: l,
      status_dialog: h,
      status_dialog_loading: _,
      sent: y
    } = o;
    console.log("Processing PA:", t, n, e, r);
    const c = d === "PA Request - Sent to Plan" || a.url.includes(`faxconfirmation/${t}`), $ = d === "PA Response" || f === "Sent to Plan" && !y.includes(U()) || f === "Archived" || d === "Question Response" && l !== "false" || d === "PA Request - Sent to Plan" && _.length > 0;
    if (console.warn(`Status for ${t}
isUploadCase - ${c}
isTerminalCase - ${$}`), !p.get(t).downloaded && c && !$) {
      console.warn("Inside the if statement with conditional check");
      const m = await T(t, n, e, r), L = await N(m);
      console.log(`[PA ${t}] Downloaded file path:`, L);
      const b = await k(i, n, e);
      if (console.log("Ema Patient:", b), b != null && b.length) {
        const { id: D } = b[0];
        console.log(`[PA ${t}] Uploading PDF for patientId=${D}`), p.get(t).downloaded != !0 && await O({ pa_id: t, patient_fname: n, patient_lname: e, patient_dob: i, drug: r, submitted_by: u, patientId: D }), p.get(t).downloaded = !0;
        let A = null;
        try {
          const S = (await chrome.tabs.query({})).find((E) => {
            var P;
            return (P = E.url) == null ? void 0 : P.includes("ema.md");
          });
          S && (A = S.id, console.log(`[PA ${t}] Found EMA tab ID:`, A));
        } catch (w) {
          console.error(`[PA ${t}] Error finding EMA tab:`, w);
        }
        if (A) {
          const w = await fetch(
            `https://dashboard.covermymeds.com/api/requests/${t}/download`,
            { credentials: "include" }
          );
          if (!w.ok) throw new Error(`PDF fetch failed: ${w.statusText}`);
          const S = await w.blob(), E = `${n}-${e}-${r}.pdf`, P = new File([S], E, { type: "application/pdf" }), q = [{
            patient: { id: String(D), lastName: e, firstName: n },
            additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
            fileName: P.name,
            title: `${r} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
          }], x = await R(A, q, P);
          console.log(`[PA ${t}] EMA upload result:`, x);
        }
      }
    } else
      return;
  } catch (o) {
    console.error(`[PA ${t}] Error:`, o);
  } finally {
    v.delete(t);
  }
}
chrome.webRequest.onCompleted.addListener(
  j,
  { urls: ["*://*.covermymeds.com/*"] }
);
async function G(a) {
  try {
    const t = await C(a), { patient_fname: s, patient_lname: o, drug: n } = t, e = await T(a, s, o, n), i = await N(e);
    console.log("[Manual] PDF path:", i);
  } catch (t) {
    console.error(`[Manual] Error in pdfManipulation for PA ID ${a}:`, t);
  }
}
export {
  G as pdfManipulation
};
