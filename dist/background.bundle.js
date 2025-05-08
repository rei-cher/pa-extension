function v(n) {
  if (n.patient_dob) return n.patient_dob;
  for (const t of n.sections || [])
    for (const s of t.rows || [])
      for (const a of s.questions || []) {
        const o = a.question_text || a.label || a.name || "";
        if (/date of birth/i.test(o) || /patient_date_of_birth/i.test(o))
          return a.answer_text ?? a.answer ?? null;
      }
  return null;
}
async function S(n) {
  var s, a;
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
      completed: e.completed,
      status_dialog: (s = e.status_dialog_loading) != null && s.text ? e.status_dialog_loading.text : null,
      status_dialog_loading: (a = e.status_dialog_loading) != null && a.text ? e.status_dialog_loading.text : null
    };
  } catch (o) {
    throw console.error("Error fetching PA info:", o), o;
  }
}
async function N(n, t, s, a) {
  return new Promise((o, e) => {
    const i = `https://dashboard.covermymeds.com/api/requests/${n}/download`;
    console.log("downloadPA called:", i), chrome.downloads.download({
      url: i,
      filename: `${t}-${s}-${a}.pdf`
    }, (r) => {
      if (chrome.runtime.lastError)
        return e(chrome.runtime.lastError);
      console.log("Download started, id=", r), r ? o(r) : e(new Error("Failed to start download"));
    });
  });
}
function I(n) {
  return new Promise((t, s) => {
    const a = (o) => {
      var e, i;
      o.id === n && ((e = o.state) == null ? void 0 : e.current) === "complete" && (chrome.downloads.onChanged.removeListener(a), chrome.downloads.search({ id: n }, (r) => {
        r && r.length ? (console.log("Found download result:", r[0]), t(r[0].filename)) : s(new Error("No results found for downloadId"));
      })), o.id === n && ((i = o.state) == null ? void 0 : i.current) === "interrupted" && (chrome.downloads.onChanged.removeListener(a), s(new Error("Download was interrupted")));
    };
    chrome.downloads.onChanged.addListener(a), setTimeout(() => {
      chrome.downloads.onChanged.removeListener(a), s(new Error("Timed out waiting for download to complete"));
    }, 6e4);
  });
}
async function x(n, t, s) {
  console.log(`Trying to find the patient in ema: ${t} ${s} ${n}`);
  const a = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const o = {
      term: n,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, e = new URLSearchParams(o).toString(), i = await fetch(`${a}${e}`, {
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
    const _ = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], c = t.toLowerCase().split(/\s+|-/).filter((l) => l), y = s.toLowerCase().split(/\s+|-/).filter((l) => l), P = _.filter((l) => {
      const b = [
        l.firstName || "",
        l.lastName || "",
        l.fullName || ""
      ].join(" ").toLowerCase(), A = c.some((m) => b.includes(m)), w = y.some((m) => b.includes(m));
      return A && w;
    });
    return console.log("Matched patients:", P), P;
  } catch (o) {
    throw console.error(`Error fetching user in ema: ${o}`), o;
  }
}
async function M(n, t, s) {
  try {
    const a = new FormData(), o = new Blob([JSON.stringify(t)], { type: "application/json" });
    a.append("dtoList", JSON.stringify(o)), a.append("file", s, s.name);
    const e = await fetch(
      "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
      {
        method: "POST",
        body: a
      }
    );
    if (!e.ok)
      throw new Error(`Upload failed: ${e.statusText}`);
    return await e.json();
  } catch (a) {
    throw console.error("Upload error:", a), a;
  }
}
const u = /* @__PURE__ */ new Map(), E = /* @__PURE__ */ new Set();
async function C(n) {
  const { paLog: t = [] } = await chrome.storage.local.get("paLog");
  t.push(n), await chrome.storage.local.set({ paLog: t });
}
setInterval(() => {
  console.log("===Processed PAs===");
  for (const [n, t] of u.entries())
    console.log(`PA id: ${n}: downloaded - ${t.downloaded}`);
}, 3e4);
async function F(n) {
  let t;
  if ((n.url.includes("dashboard.covermymeds.com/api/requests/") || n.url.includes("www.covermymeds.com/request/faxconfirmation/")) && (t = n.url.split("/")[5].split("?")[0]), !t || E.has(t)) return;
  const s = u.get(t);
  if (s != null && s.downloaded) {
    console.log(`[PA ${t}] Ignored`);
    return;
  }
  E.add(t);
  try {
    u.has(t) || u.set(t, { downloaded: !1 });
    const a = await S(t), {
      patient_fname: o,
      patient_lname: e,
      patient_dob: i,
      drug: r,
      submitted_by: _,
      epa_status: c,
      workflow_status: y,
      submitted_by_user_category: P,
      completed: l,
      status_dialog: b,
      status_dialog_loading: A
    } = a;
    console.log("Processing PA:", t, o, e, r);
    const w = c === "PA Request - Sent to Plan" || n.url.includes(`faxconfirmation/${t}`), m = c === "PA Response" || c === "Question Response" && l !== "false" || y === "Sent to Plan" || c === "PA Request - Sent to Plan" && A.length;
    if (!u.get(t).downloaded && (w || m)) {
      const L = await N(t, o, e, r), T = await I(L);
      if (console.log(`[PA ${t}] Downloaded file path:`, T), await C({
        pa_id: t,
        firstName: o,
        lastName: e,
        dob: i,
        drug: r,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "Pending",
        submyted_by: _
      }), u.get(t).downloaded = !0, w) {
        const f = await x(i, o, e);
        if (console.log("Ema Patient:", f), f != null && f.length) {
          const { id: D } = f[0];
          console.log(`[PA ${t}] Uploading PDF for patientId=${D}`);
          let g = null;
          try {
            const h = (await chrome.tabs.query({})).find(($) => {
              var p;
              return (p = $.url) == null ? void 0 : p.includes("ema.md");
            });
            h && (g = h.id, console.log(`[PA ${t}] Found EMA tab ID:`, g));
          } catch (d) {
            console.error(`[PA ${t}] Error finding EMA tab:`, d);
          }
          if (g)
            try {
              const d = await fetch(
                `https://dashboard.covermymeds.com/api/requests/${t}/download`,
                { credentials: "include" }
              );
              if (!d.ok) throw new Error(`PDF fetch failed: ${d.statusText}`);
              const h = await d.blob(), $ = `${o}-${e}-${r}.pdf`, p = new File([h], $, { type: "application/pdf" }), q = [{
                patient: { id: D, lastName: e, firstName: o },
                additionalInfo: { performedDate: (/* @__PURE__ */ new Date()).toISOString() },
                fileName: p.name,
                title: `${r} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
              }], k = await M(g, q, p);
              console.log(`[PA ${t}] EMA upload result:`, k);
            } catch (d) {
              console.error(`[PA ${t}] Upload error:`, d);
            }
        }
      }
    } else
      return;
  } catch (a) {
    console.error(`[PA ${t}] Error:`, a);
  } finally {
    E.delete(t);
  }
}
chrome.webRequest.onCompleted.addListener(
  F,
  { urls: ["*://*.covermymeds.com/*"] }
);
async function O(n) {
  try {
    const t = await S(n), { patient_fname: s, patient_lname: a, drug: o } = t, e = await N(n, s, a, o), i = await I(e);
    console.log("[Manual] PDF path:", i);
  } catch (t) {
    console.error(`[Manual] Error in pdfManipulation for PA ID ${n}:`, t);
  }
}
export {
  O as pdfManipulation
};
