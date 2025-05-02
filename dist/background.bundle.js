function v(a) {
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
async function N(a) {
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
      patient_dob: v(e),
      drug: e.drug.split(" ")[0],
      submitted_by: e.submitted_by,
      epa_status: e.ePA_Status_description,
      workflow_status: e.workflow_status,
      submitted_by_user_category: e.submitted_by_user_category,
      completed: e.completed,
      status_dialog: (s = e.status_dialog_loading) != null && s.text ? e.status_dialog_loading.text : null,
      status_dialog_loading: (o = e.status_dialog_loading) != null && o.text ? e.status_dialog_loading.text : null
    };
  } catch (n) {
    throw console.error("Error fetching PA info:", n), n;
  }
}
async function S(a, t, s, o) {
  return new Promise((n, e) => {
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
function T(a) {
  return new Promise((t, s) => {
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
async function x(a, t, s) {
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
    const E = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], c = t.toLowerCase().split(/\s+|-/).filter((l) => l), _ = s.toLowerCase().split(/\s+|-/).filter((l) => l), y = E.filter((l) => {
      const P = [
        l.firstName || "",
        l.lastName || "",
        l.fullName || ""
      ].join(" ").toLowerCase(), b = c.some((f) => P.includes(f)), w = _.some((f) => P.includes(f));
      return b && w;
    });
    return console.log("Matched patients:", y), y;
  } catch (n) {
    throw console.error(`Error fetching user in ema: ${n}`), n;
  }
}
async function M(a, t, s) {
  try {
    const o = new FormData(), n = new Blob([JSON.stringify(t)], { type: "application/json" });
    o.append("dtoList", JSON.stringify(n)), o.append("file", s, s.name);
    const e = await fetch(
      "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
      {
        method: "POST",
        body: o
      }
    );
    if (!e.ok)
      throw new Error(`Upload failed: ${e.statusText}`);
    return await e.json();
  } catch (o) {
    throw console.error("Upload error:", o), o;
  }
}
const u = /* @__PURE__ */ new Map(), $ = /* @__PURE__ */ new Set();
setInterval(() => {
  console.log("===Processed PAs===");
  for (const [a, t] of u.entries())
    console.log(`PA id: ${a}: downloaded - ${t.downloaded}`);
}, 3e4);
async function C(a) {
  let t;
  if ((a.url.includes("dashboard.covermymeds.com/api/requests/") || a.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = a.url.split("/")[5].split("?")[0]), !t || $.has(t)) return;
  const s = u.get(t);
  if (s != null && s.downloaded) {
    console.log(`[PA ${t}] Ignored`);
    return;
  }
  $.add(t);
  try {
    u.has(t) || u.set(t, { downloaded: !1 });
    const o = await N(t), {
      patient_fname: n,
      patient_lname: e,
      patient_dob: i,
      drug: r,
      submitted_by: E,
      epa_status: c,
      workflow_status: _,
      submitted_by_user_category: y,
      completed: l,
      status_dialog: P,
      status_dialog_loading: b
    } = o;
    console.log("Processing PA:", t, n, e, r);
    const w = c === "PA Request - Sent to Plan" || a.url.includes(`faxconfirmation/${t}`), f = c === "PA Response" || c === "Question Response" && l !== "false" || _ === "Sent to Plan" || c === "PA Request - Sent to Plan" && b.length;
    if (!u.get(t).downloaded && (w || f)) {
      const q = await S(t, n, e, r), I = await T(q);
      if (console.log(`[PA ${t}] Downloaded file path:`, I), u.get(t).downloaded = !0, w) {
        const p = await x(i, n, e);
        if (console.log("Ema Patient:", p), p != null && p.length) {
          const { id: D } = p[0];
          console.log(`[PA ${t}] Uploading PDF for patientId=${D}`);
          let h = null;
          try {
            const g = (await chrome.tabs.query({})).find((A) => {
              var m;
              return (m = A.url) == null ? void 0 : m.includes("ema.md");
            });
            g && (h = g.id, console.log(`[PA ${t}] Found EMA tab ID:`, h));
          } catch (d) {
            console.error(`[PA ${t}] Error finding EMA tab:`, d);
          }
          if (h)
            try {
              const d = await fetch(
                `https://dashboard.covermymeds.com/api/requests/${t}/download`,
                { credentials: "include" }
              );
              if (!d.ok) throw new Error(`PDF fetch failed: ${d.statusText}`);
              const g = await d.blob(), A = `${n}-${e}-${r}.pdf`, m = new File([g], A, { type: "application/pdf" }), L = [{
                patient: { id: D, lastName: e, firstName: n },
                additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
                fileName: m.name,
                title: `${r} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
              }], k = await M(h, L, m);
              console.log(`[PA ${t}] EMA upload result:`, k);
            } catch (d) {
              console.error(`[PA ${t}] Upload error:`, d);
            }
        }
      }
    } else
      return;
  } catch (o) {
    console.error(`[PA ${t}] Error:`, o);
  } finally {
    $.delete(t);
  }
}
chrome.webRequest.onCompleted.addListener(
  C,
  { urls: ["*://*.covermymeds.com/*"] }
);
async function F(a) {
  try {
    const t = await N(a), { patient_fname: s, patient_lname: o, drug: n } = t, e = await S(a, s, o, n), i = await T(e);
    console.log("[Manual] PDF path:", i);
  } catch (t) {
    console.error(`[Manual] Error in pdfManipulation for PA ID ${a}:`, t);
  }
}
export {
  F as pdfManipulation
};
