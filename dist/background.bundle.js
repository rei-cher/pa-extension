function C(a) {
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
      patient_dob: C(e),
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
async function I(a, t, s, n) {
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
function R(a) {
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
async function O(a, t, s) {
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
    const l = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], d = t.toLowerCase().split(/\s+|-/).filter((c) => c), g = s.toLowerCase().split(/\s+|-/).filter((c) => c), h = l.filter((c) => {
      const _ = [
        c.firstName || "",
        c.lastName || "",
        c.fullName || ""
      ].join(" ").toLowerCase(), y = d.some((m) => _.includes(m)), p = g.some((m) => _.includes(m));
      return y && p;
    });
    return console.log("Matched patients:", h), h;
  } catch (o) {
    throw console.error(`Error fetching user in ema: ${o}`), o;
  }
}
async function M(a, t, s) {
  try {
    const n = new FormData(), o = new Blob([JSON.stringify(t)], { type: "application/json" });
    n.append("dtoList", JSON.stringify(o)), n.append("file", s, s.name);
    const e = await fetch(
      "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
      {
        method: "POST",
        body: n
      }
    );
    if (!e.ok)
      throw new Error(`Upload failed: ${e.statusText}`);
    return await e.json();
  } catch (n) {
    throw console.error("Upload error:", n), n;
  }
}
const T = "pa_csv_log", q = "1NvSE5xwn5TM1iy_PXK-_ckk3F7-LZ3ksdHvNlOaY1es", F = "PA Status", x = [
  "pa_id",
  "First Name",
  "Last Name",
  "DOB",
  "Drug",
  "Submitted by",
  "Submitted at",
  "Status"
].join(",") + `
`;
function U() {
  return new Promise((a, t) => {
    chrome.identity.getAuthToken({ interactive: !0 }, (s) => {
      if (chrome.runtime.lastError || !s)
        return t(chrome.runtime.lastError);
      a(s);
    });
  });
}
async function j(a) {
  const t = await U(), s = `'${F}'!A1`, n = encodeURIComponent(s), o = `https://sheets.googleapis.com/v4/spreadsheets/${q}/values:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&range=${n}`, e = { values: [a] }, i = await fetch(o, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(e)
  }), r = await i.text(), l = i.headers.get("content-type") || "";
  if (!i.ok)
    throw console.error("[Sheets] bad response:", i.status, i.statusText, `
`, r), new Error(`Sheets API returned HTTP ${i.status}`);
  if (l.includes("application/json"))
    return JSON.parse(r);
  throw console.error("[Sheets] unexpected content-type:", l, `
`, r), new Error("Sheets API returned non‑JSON response (see console for HTML)");
}
async function H(a) {
  const {
    pa_id: t,
    patient_fname: s,
    patient_lname: n,
    patient_dob: o,
    drug: e,
    submitted_by: i
  } = a, r = /* @__PURE__ */ new Date(), l = String(r.getMonth() + 1).padStart(2, "0"), d = String(r.getDate()).padStart(2, "0"), g = r.getFullYear(), h = `${l}/${d}/${g}`;
  function c(P) {
    const f = String(P ?? "");
    return f.includes(",") || f.includes('"') || f.includes(`
`) ? `"${f.replace(/"/g, '""')}"` : f;
  }
  const _ = [
    `=HYPERLINK("https://dashboard.covermymeds.com/v2/requests/${t}", "${t}")`,
    s,
    n,
    o,
    e,
    i,
    h,
    "Pending"
  ].map(c).join(",") + `
`, { pa_csv_log: y = x } = await chrome.storage.local.get(T), p = y + _;
  await chrome.storage.local.set({ [T]: p }), await B(p);
  const m = [
    t,
    s,
    n,
    o,
    e,
    i,
    h,
    "Pending"
  ];
  try {
    await j(m), console.log("[Sheets] row appended");
  } catch (P) {
    console.error("[Sheets] append failed:", P);
  }
}
async function B(a) {
  const { pa_csv_log: t = x } = await chrome.storage.local.get(T), n = "data:text/csv;charset=utf-8," + encodeURIComponent(a || t);
  chrome.downloads.download({
    url: n,
    filename: "pa_log.csv",
    conflictAction: "overwrite",
    saveAs: !1
  }, (o) => {
    console.log("[CSV Logger] download triggered:", o);
  });
}
const w = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Set();
setInterval(() => {
  console.log("===Processed PAs===");
  for (const [a, t] of w.entries())
    console.log(`PA id: ${a}: downloaded - ${t.downloaded}`);
}, 3e4);
async function J(a) {
  let t;
  if ((a.url.includes("dashboard.covermymeds.com/api/requests/") || a.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = a.url.split("/")[5].split("?")[0]), !t || v.has(t)) return;
  const s = w.get(t);
  if (s != null && s.downloaded) {
    console.log(`[PA ${t}] Ignored`);
    return;
  }
  v.add(t);
  try {
    w.has(t) || w.set(t, { downloaded: !1 });
    const n = await N(t), {
      patient_fname: o,
      patient_lname: e,
      patient_dob: i,
      drug: r,
      submitted_by: l,
      epa_status: d,
      workflow_status: g,
      submitted_by_user_category: h,
      completed: c,
      status_dialog: _,
      status_dialog_loading: y
    } = n;
    console.log("Processing PA:", t, o, e, r);
    const p = d === "PA Request - Sent to Plan" || a.url.includes(`faxconfirmation/${t}`), m = d === "PA Response" || g === "Sent to Plan" || g === "Archived" || d === "Question Response" && c !== "false" || d === "PA Request - Sent to Plan" && y.length;
    if (!w.get(t).downloaded && (p || m)) {
      const P = await I(t, o, e, r), f = await R(P);
      if (console.log(`[PA ${t}] Downloaded file path:`, f), w.get(t).downloaded != !0 && await H({ pa_id: t, patient_fname: o, patient_lname: e, patient_dob: i, drug: r, submitted_by: l }), w.get(t).downloaded = !0, p) {
        const b = await O(i, o, e);
        if (console.log("Ema Patient:", b), b != null && b.length) {
          const { id: D } = b[0];
          console.log(`[PA ${t}] Uploading PDF for patientId=${D}`);
          let S = null;
          try {
            const $ = (await chrome.tabs.query({})).find((E) => {
              var A;
              return (A = E.url) == null ? void 0 : A.includes("ema.md");
            });
            $ && (S = $.id, console.log(`[PA ${t}] Found EMA tab ID:`, S));
          } catch (u) {
            console.error(`[PA ${t}] Error finding EMA tab:`, u);
          }
          if (S)
            try {
              const u = await fetch(
                `https://dashboard.covermymeds.com/api/requests/${t}/download`,
                { credentials: "include" }
              );
              if (!u.ok) throw new Error(`PDF fetch failed: ${u.statusText}`);
              const $ = await u.blob(), E = `${o}-${e}-${r}.pdf`, A = new File([$], E, { type: "application/pdf" }), L = [{
                patient: { id: D, lastName: e, firstName: o },
                additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
                fileName: A.name,
                title: `${r} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
              }], k = await M(S, L, A);
              console.log(`[PA ${t}] EMA upload result:`, k);
            } catch (u) {
              console.error(`[PA ${t}] Upload error:`, u);
            }
        }
      }
    } else
      return;
  } catch (n) {
    console.error(`[PA ${t}] Error:`, n);
  } finally {
    v.delete(t);
  }
}
chrome.webRequest.onCompleted.addListener(
  J,
  { urls: ["*://*.covermymeds.com/*"] }
);
async function G(a) {
  try {
    const t = await N(a), { patient_fname: s, patient_lname: n, drug: o } = t, e = await I(a, s, n, o), i = await R(e);
    console.log("[Manual] PDF path:", i);
  } catch (t) {
    console.error(`[Manual] Error in pdfManipulation for PA ID ${a}:`, t);
  }
}
export {
  G as pdfManipulation
};
