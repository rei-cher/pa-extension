function F(a) {
  if (a.patient_dob) return a.patient_dob;
  for (const t of a.sections || [])
    for (const s of t.rows || [])
      for (const n of s.questions || []) {
        const o = n.question_text || n.label || n.name || "";
        if (/date of birth/i.test(o) || /patient_date_of_birth/i.test(o))
          return n.answer_text ?? n.answer ?? null;
      }
  return null;
}
async function N(a) {
  var s, n;
  console.log(`Getting patient info with ID - ${a}`);
  const t = `https://dashboard.covermymeds.com/api/requests/${a}?`;
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
      patient_dob: F(e),
      drug: e.drug.split(" ")[0],
      submitted_by: e.submitted_by,
      epa_status: e.ePA_Status_description,
      workflow_status: e.workflow_status,
      submitted_by_user_category: e.submitted_by_user_category,
      completed: e.completed,
      status_dialog: (s = e.status_dialog_loading) != null && s.text ? e.status_dialog_loading.text : null,
      status_dialog_loading: (n = e.status_dialog_loading) != null && n.text ? e.status_dialog_loading.text : null
    };
  } catch (o) {
    throw console.error("Error fetching PA info:", o), o;
  }
}
async function C(a, t, s, n) {
  return new Promise((o, e) => {
    const i = `https://dashboard.covermymeds.com/api/requests/${a}/download`;
    console.log("downloadPA called:", i), chrome.downloads.download({
      url: i,
      filename: `${t}-${s}-${n}.pdf`
    }, (r) => {
      if (chrome.runtime.lastError)
        return e(chrome.runtime.lastError);
      console.log("Download started, id=", r), r ? o(r) : e(new Error("Failed to start download"));
    });
  });
}
function L(a) {
  return new Promise((t, s) => {
    const n = (o) => {
      var e, i;
      o.id === a && ((e = o.state) == null ? void 0 : e.current) === "complete" && (chrome.downloads.onChanged.removeListener(n), chrome.downloads.search({ id: a }, (r) => {
        r && r.length ? (console.log("Found download result:", r[0]), t(r[0].filename)) : s(new Error("No results found for downloadId"));
      })), o.id === a && ((i = o.state) == null ? void 0 : i.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(n), s(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(n), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(n), s(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function M(a, t, s) {
  console.log(`Trying to find the patient in ema: ${t} ${s} ${a}`);
  const n = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const o = {
      term: a,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, e = new URLSearchParams(o).toString(), i = await fetch(`${n}${e}`, {
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
    const u = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], c = t.toLowerCase().split(/\s+|-/).filter((l) => l), f = s.toLowerCase().split(/\s+|-/).filter((l) => l), g = u.filter((l) => {
      const h = [
        l.firstName || "",
        l.lastName || "",
        l.fullName || ""
      ].join(" ").toLowerCase(), _ = c.some((d) => h.includes(d)), y = f.some((d) => h.includes(d));
      return _ && y;
    });
    return console.log("Matched patients:", g), g;
  } catch (o) {
    throw console.error(`Error fetching user in ema: ${o}`), o;
  }
}
async function R(a, t, s) {
  try {
    const n = new FormData();
    n.append("dtoList", JSON.stringify(t));
    const o = new Blob([await s.arrayBuffer()], { type: s.type });
    n.append("files", o, s.name);
    for (let r of n.entries())
      console.log(r[0], r[1]);
    const e = await fetch(
      "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
      {
        method: "POST",
        body: n
      }
    );
    return e.ok || (console.error(e), console.error(e.statusText)), await e.json();
  } catch (n) {
    console.error("Upload error:", n);
  }
}
const I = "pa_csv_log", T = [
  "pa_id",
  "First Name",
  "Last Name",
  "DOB",
  "Drug",
  "Submitted by",
  "Submitted at",
  "Status",
  "Pt Ema ID"
].join(",") + `
`;
async function k(a) {
  const {
    pa_id: t,
    patient_fname: s,
    patient_lname: n,
    patient_dob: o,
    drug: e,
    submitted_by: i,
    patientId: r
  } = a, u = /* @__PURE__ */ new Date(), c = String(u.getMonth() + 1).padStart(2, "0"), f = String(u.getDate()).padStart(2, "0"), g = u.getFullYear(), l = `${c}/${f}/${g}`;
  function h(E) {
    const m = String(E ?? "");
    return m.includes(",") || m.includes('"') || m.includes(`
`) ? `"${m.replace(/"/g, '""')}"` : m;
  }
  const _ = [
    `=HYPERLINK("https://dashboard.covermymeds.com/v2/requests/${t}", "${t}")`,
    s,
    n,
    o,
    e,
    i,
    l,
    "Pending",
    r
  ].map(h).join(",") + `
`, { pa_csv_log: y = T } = await chrome.storage.local.get(I), d = y + _;
  await chrome.storage.local.set({ [I]: d }), await O(d);
}
async function O(a) {
  const { pa_csv_log: t = T } = await chrome.storage.local.get(I), n = "data:text/csv;charset=utf-8," + encodeURIComponent(a || t);
  chrome.downloads.download({
    url: n,
    filename: "pa_log.csv",
    conflictAction: "overwrite",
    saveAs: !1
  }, (o) => {
    console.log("[CSV Logger] download triggered:", o);
  });
}
const p = /* @__PURE__ */ new Map(), D = /* @__PURE__ */ new Set();
setInterval(() => {
  console.log("===Processed PAs===");
  for (const [a, t] of p.entries())
    console.log(`PA id: ${a}: downloaded - ${t.downloaded}`);
}, 3e4);
async function B(a) {
  let t;
  if ((a.url.includes("dashboard.covermymeds.com/api/requests/") || a.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = a.url.split("/")[5].split("?")[0]), !t || D.has(t)) return;
  const s = p.get(t);
  if (s != null && s.downloaded) {
    console.log(`[PA ${t}] Ignored`);
    return;
  }
  D.add(t);
  try {
    p.has(t) || p.set(t, { downloaded: !1 });
    const n = await N(t), {
      patient_fname: o,
      patient_lname: e,
      patient_dob: i,
      drug: r,
      submitted_by: u,
      epa_status: c,
      workflow_status: f,
      submitted_by_user_category: g,
      completed: l,
      status_dialog: h,
      status_dialog_loading: _
    } = n;
    console.log("Processing PA:", t, o, e, r);
    const y = c === "PA Request - Sent to Plan" || a.url.includes(`faxconfirmation/${t}`), d = c === "PA Response" || f === "Sent to Plan" || f === "Archived" || c === "Question Response" && l !== "false" || c === "PA Request - Sent to Plan" && _.length;
    if (!p.get(t).downloaded && (y || d)) {
      const E = await C(t, o, e, r), m = await L(E);
      console.log(`[PA ${t}] Downloaded file path:`, m);
      const b = await M(i, o, e);
      if (console.log("Ema Patient:", b), b != null && b.length) {
        const { id: S } = b[0];
        console.log(`[PA ${t}] Uploading PDF for patientId=${S}`), p.get(t).downloaded != !0 && await k({ pa_id: t, patient_fname: o, patient_lname: e, patient_dob: i, drug: r, submitted_by: u, patientId: S }), p.get(t).downloaded = !0;
        let A = null;
        try {
          const $ = (await chrome.tabs.query({})).find((v) => {
            var P;
            return (P = v.url) == null ? void 0 : P.includes("ema.md");
          });
          $ && (A = $.id, console.log(`[PA ${t}] Found EMA tab ID:`, A));
        } catch (w) {
          console.error(`[PA ${t}] Error finding EMA tab:`, w);
        }
        if (A) {
          const w = await fetch(
            `https://dashboard.covermymeds.com/api/requests/${t}/download`,
            { credentials: "include" }
          );
          if (!w.ok) throw new Error(`PDF fetch failed: ${w.statusText}`);
          const $ = await w.blob(), v = `${o}-${e}-${r}.pdf`, P = new File([$], v, { type: "application/pdf" }), q = [{
            patient: { id: String(S), lastName: e, firstName: o },
            additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
            fileName: P.name,
            title: `${r} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
          }], x = await R(A, q, P);
          console.log(`[PA ${t}] EMA upload result:`, x);
        }
      }
    } else
      return;
  } catch (n) {
    console.error(`[PA ${t}] Error:`, n);
  } finally {
    D.delete(t);
  }
}
chrome.webRequest.onCompleted.addListener(
  B,
  { urls: ["*://*.covermymeds.com/*"] }
);
async function U(a) {
  try {
    const t = await N(a), { patient_fname: s, patient_lname: n, drug: o } = t, e = await C(a, s, n, o), i = await L(e);
    console.log("[Manual] PDF path:", i);
  } catch (t) {
    console.error(`[Manual] Error in pdfManipulation for PA ID ${a}:`, t);
  }
}
export {
  U as pdfManipulation
};
