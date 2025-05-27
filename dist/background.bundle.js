function x(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const t of o.sections || [])
    for (const n of t.rows || [])
      for (const e of n.questions || []) {
        const a = e.question_text || e.label || e.name || "";
        if (/date of birth/i.test(a) || /patient_date_of_birth/i.test(a))
          return e.answer_text ?? e.answer ?? null;
      }
  return null;
}
function I(o) {
  if (Array.isArray(o))
    for (const t of o) {
      const n = I(t);
      if (n) return n;
    }
  else if (typeof o == "object" && o !== null) {
    if (o.name === "provider_npi" && "answer_text" in o)
      return o.answer_text;
    for (const t in o) {
      const n = I(o[t]);
      if (n) return n;
    }
  }
  return null;
}
async function T(o) {
  console.log(`Getting patient info with ID - ${o}`);
  const t = `https://dashboard.covermymeds.com/api/requests/${o}?`;
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
      patient_dob: x(e),
      drug: e.drug.split(" ")[0],
      submitted_by: e.submitted_by,
      epa_status_description: e.ePA_Status_description,
      workflow_status: e.workflow_status,
      submitted_by_user_category: e.submitted_by_user_category,
      completed: e.completed,
      insurance: e.form_description.split(" ")[0],
      // status_dialog: data.status_dialog_loading?.text ? data.status_dialog_loading.text : null,
      // status_dialog_loading: data.status_dialog_loading?.text ? data.status_dialog_loading.text : null,
      sent: e != null && e.sent ? e.sent : null,
      npi: I(e)
    };
  } catch (n) {
    throw console.error("Error fetching PA info:", n), n;
  }
}
async function F(o, t, n, e) {
  return console.warn("[pa-downloader] Download function is called"), new Promise((a, s) => {
    const i = `https://dashboard.covermymeds.com/api/requests/${o}/download`;
    console.log("downloadPA called:", i), chrome.downloads.download({
      url: i,
      filename: `${t}-${n}-${e}.pdf`
    }, (r) => {
      if (chrome.runtime.lastError)
        return s(chrome.runtime.lastError);
      console.log("Download started, id=", r), r ? a(r) : s(new Error("Failed to start download"));
    });
  });
}
function L(o) {
  return console.warn("[pa-downloader] waitForDownloadFilename function called"), new Promise((t, n) => {
    const e = (a) => {
      var s, i;
      a.id === o && ((s = a.state) == null ? void 0 : s.current) === "complete" && (chrome.downloads.onChanged.removeListener(e), chrome.downloads.search({ id: o }, (r) => {
        r && r.length ? (console.log("Found download result:", r[0]), t(r[0].filename)) : n(new Error("No results found for downloadId"));
      })), a.id === o && ((i = a.state) == null ? void 0 : i.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(e), n(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(e), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(e), n(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function R(o, t, n) {
  console.log(`Trying to find the patient in ema: ${t} ${n} ${o}`);
  const e = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const a = {
      term: o,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, s = new URLSearchParams(a).toString(), i = await fetch(`${e}${s}`, {
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
    const g = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], u = t.toLowerCase().split(/\s+|-/).filter((c) => c), p = n.toLowerCase().split(/\s+|-/).filter((c) => c), h = g.filter((c) => {
      const m = [
        c.firstName || "",
        c.lastName || "",
        c.fullName || ""
      ].join(" ").toLowerCase(), P = u.some((d) => m.includes(d)), y = p.some((d) => m.includes(d));
      return P && y;
    });
    return console.log("Matched patients:", h), h;
  } catch (a) {
    throw console.error(`Error fetching user in ema: ${a}`), a;
  }
}
async function O(o, t, n) {
  try {
    const e = new FormData();
    e.append("dtoList", JSON.stringify(t));
    const a = new Blob([await n.arrayBuffer()], { type: n.type });
    e.append("files", a, n.name);
    for (let r of e.entries())
      console.log(r[0], r[1]);
    const s = await fetch(
      "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
      {
        method: "POST",
        body: e
      }
    );
    return s.ok || (console.error(s), console.error(s.statusText)), await s.json();
  } catch (e) {
    console.error("Upload error:", e);
  }
}
const N = "pa_csv_log", k = [
  "pa_id",
  "First Name",
  "Last Name",
  "DOB",
  "Drug",
  "Submitted by",
  "Submitted at",
  "Status",
  "Insurance",
  "Pt Ema ID",
  "Additional Info",
  "NPI"
].join(",") + `
`;
async function B(o) {
  const {
    pa_id: t,
    patient_fname: n,
    patient_lname: e,
    patient_dob: a,
    drug: s,
    submitted_by: i,
    insurance: r,
    patientId: g,
    npi: u
  } = o, p = /* @__PURE__ */ new Date(), h = String(p.getMonth() + 1).padStart(2, "0"), c = String(p.getDate()).padStart(2, "0"), m = p.getFullYear(), P = `${h}/${c}/${m}`;
  function y(E) {
    const l = String(E ?? "");
    return l.includes(",") || l.includes('"') || l.includes(`
`) ? `"${l.replace(/"/g, '""')}"` : l;
  }
  const d = [
    `=HYPERLINK("https://dashboard.covermymeds.com/v2/requests/${t}", "${t}")`,
    n,
    e,
    a,
    s,
    i,
    P,
    "Pending",
    r,
    g,
    "",
    // blank space for additional info
    u
  ].map(y).join(",") + `
`, { pa_csv_log: C = k } = await chrome.storage.local.get(N), A = C + d;
  await chrome.storage.local.set({ [N]: A }), await U(A);
}
async function U(o) {
  const { pa_csv_log: t = k } = await chrome.storage.local.get(N), e = "data:text/csv;charset=utf-8," + encodeURIComponent(o || t);
  chrome.downloads.download({
    url: e,
    filename: "pa_log.csv",
    conflictAction: "overwrite",
    saveAs: !1
  }, (a) => {
    console.log("[CSV Logger] download triggered:", a);
  });
}
const f = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Set();
setInterval(() => {
  console.log("===Processed PAs===");
  for (const [o, t] of f.entries())
    console.log(`PA id: ${o}: downloaded - ${t.downloaded}`);
}, 5e3);
async function G(o) {
  let t;
  if ((o.url.includes("dashboard.covermymeds.com/api/requests/") || o.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = o.url.split("/")[5].split("?")[0]), !t || v.has(t)) return;
  const n = f.get(t);
  if (n != null && n.downloaded) {
    console.log(`[PA ${t}] Ignored`);
    return;
  }
  v.add(t);
  try {
    f.has(t) || f.set(t, { downloaded: !1 });
    const e = await T(t), {
      patient_fname: a,
      patient_lname: s,
      patient_dob: i,
      drug: r,
      submitted_by: g,
      epa_status_description: u,
      workflow_status: p,
      submitted_by_user_category: h,
      completed: c,
      insurance: m,
      // status_dialog,
      sent: P,
      npi: y
    } = e;
    console.log("[backgound.js] PA INFO: ", e), console.log("Processing PA:", t, a, s, r);
    const d = u === "PA Request - Sent to Plan" || o.url.includes(`faxconfirmation/${t}`);
    if (console.warn(`Status for ${t}
isUploadCase - ${d}
isTerminalCase - ${u === "PA Response" || // (workflow_status === "Sent to Plan" && !sent.includes(getTodayDay())) ||
    p === "Archived" || u === "Question Response" && c !== "false"}
Details url - ${o.url}`), !f.get(t).downloaded && d) {
      console.warn("Inside the if statement with conditional check");
      const A = await F(t, a, s, r), E = await L(A);
      console.log(`[PA ${t}] Downloaded file path:`, E);
      const l = await R(i, a, s);
      if (console.log("Ema Patient:", l), l != null && l.length) {
        const { id: D } = l[0];
        console.log(`[PA ${t}] Uploading PDF for patientId=${D}`), f.get(t).downloaded != !0 && await B({
          pa_id: t,
          patient_fname: a,
          patient_lname: s,
          patient_dob: i,
          drug: r,
          submitted_by: g,
          insurance: m,
          patientId: D,
          npi: y
        }), f.get(t).downloaded = !0;
        let $ = null;
        try {
          const b = (await chrome.tabs.query({})).find((S) => {
            var _;
            return (_ = S.url) == null ? void 0 : _.includes("ema.md");
          });
          b && ($ = b.id, console.log(`[PA ${t}] Found EMA tab ID:`, $));
        } catch (w) {
          console.error(`[PA ${t}] Error finding EMA tab:`, w);
        }
        if ($) {
          const w = await fetch(
            `https://dashboard.covermymeds.com/api/requests/${t}/download`,
            { credentials: "include" }
          );
          if (!w.ok) throw new Error(`PDF fetch failed: ${w.statusText}`);
          const b = await w.blob(), S = `${a}-${s}-${r}.pdf`, _ = new File([b], S, { type: "application/pdf" }), q = [{
            patient: { id: String(D), lastName: s, firstName: a },
            additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
            fileName: _.name,
            title: `${r} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
          }], M = await O($, q, _);
          console.log(`[PA ${t}] EMA upload result:`, M);
        }
      }
    } else
      return;
  } catch (e) {
    console.error(`[PA ${t}] Error:`, e);
    return;
  } finally {
    v.delete(t);
  }
}
chrome.webRequest.onCompleted.addListener(
  G,
  { urls: ["*://*.covermymeds.com/*"] }
);
async function H(o) {
  try {
    const t = await T(o), { patient_fname: n, patient_lname: e, drug: a } = t, s = await F(o, n, e, a), i = await L(s);
    console.log("[Manual] PDF path:", i);
  } catch (t) {
    console.error(`[Manual] Error in pdfManipulation for PA ID ${o}:`, t);
  }
}
export {
  H as pdfManipulation
};
