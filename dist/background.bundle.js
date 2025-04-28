function P(e) {
  return new Promise((s, r) => {
    chrome.cookies.get(
      { url: e, name: "cmm_production_session" },
      (t) => {
        if (chrome.runtime.lastError)
          return console.error("Cookie API error:", chrome.runtime.lastError), r(chrome.runtime.lastError);
        s(t ? t.value : null);
      }
    );
  });
}
function $(e) {
  if (e.patient_dob) return e.patient_dob;
  for (const s of e.sections || [])
    for (const r of s.rows || [])
      for (const t of r.questions || []) {
        const c = t.question_text || t.label || "";
        if (/date of birth/i.test(c))
          return t.answer_text ?? t.answer ?? null;
      }
  return null;
}
async function y(e) {
  console.log(`Getting patient info with ID - ${e}`);
  const s = `https://dashboard.covermymeds.com/api/requests/${e}?`;
  try {
    const r = await fetch(s, {
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
      patient_dob: $(t),
      drug: t.drug.split(" ")[0]
    };
  } catch (r) {
    throw console.error("Error fetching PA info:", r), r;
  }
}
self.getPatientInfo = y;
async function E(e, s, r, t) {
  const c = `https://dashboard.covermymeds.com/api/requests/${e}/download`, o = `*://portal-services.covermymeds.com/requests/${e}/redacted*`;
  return new Promise((a, n) => {
    const d = (h) => {
      chrome.webRequest.onCompleted.removeListener(d), fetch(h.url, { credentials: "include" }).then((i) => {
        if (!i.ok) throw new Error(`HTTP ${i.status}`);
        return i.json();
      }).then((i) => {
        i.workflow_status === "Sent to Plan" ? fetch(c, { credentials: "include" }).then((l) => {
          if (!l.ok) throw new Error(`PDF fetch failed ${l.status}`);
          return l.blob();
        }).then((l) => {
          const u = new File(
            [l],
            `${s}-${r}-${t}.pdf`,
            { type: l.type }
          );
          a(u);
        }).catch(n) : n(`Bad status: ${i.workflow_status}`);
      }).catch(n);
    };
    chrome.webRequest.onCompleted.addListener(
      d,
      { urls: [o] }
    );
  });
}
async function A(e, s, r) {
  console.log(`Trying to find the patient in ema: ${s} ${r} ${e}`);
  const t = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const c = {
      term: e,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, o = new URLSearchParams(c).toString(), a = await fetch(`${t}${o}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!a.ok)
      throw new Error(`HTTP ${a.status}`);
    const n = await a.json();
    console.log("EMA patient return data:", n);
    const d = Array.isArray(n) ? n : Array.isArray(n.patients) ? n.patients : [], h = s.toLowerCase().split(/\s+|-/).filter((u) => u), i = r.toLowerCase().split(/\s+|-/).filter((u) => u), l = d.filter((u) => {
      const f = [
        u.firstName || "",
        u.lastName || "",
        u.fullName || ""
      ].join(" ").toLowerCase(), p = h.some((m) => f.includes(m)), w = i.some((m) => f.includes(m));
      return p && w;
    });
    return console.log("Matched patients:", l), l;
  } catch (c) {
    throw console.error(`Error fetching user in ema: ${c}`), c;
  }
}
chrome.tabs.onUpdated.addListener(async (e, s, r) => {
  if (s.status !== "complete") return;
  const t = r.url;
  if (!t.includes("/v2/requests/")) return;
  await chrome.scripting.executeScript({
    target: { tabId: e },
    func: () => {
      const o = document.createElement("script");
      o.type = "module", o.src = chrome.runtime.getURL("content/ema-upload.js"), document.head.appendChild(o);
    }
  });
  const c = t.split("/").pop();
  P(t).then((o) => {
    if (!o) throw new Error(`No session token for ${t}`);
    return y(c);
  }).then(async ({ patient_fname: o, patient_lname: a, patient_dob: n, drug: d }) => {
    const h = n.replace(/\//g, "-");
    return console.log({ patient_fname: o, patient_lname: a, dobSafe: h, drug: d }), E(c, o, a, d).then((i) => ({ file: i, patient_fname: o, patient_lname: a, patient_dob: n, drug: d }));
  }).then(async ({ file: o, patient_fname: a, patient_lname: n, patient_dob: d, drug: h }) => {
    const l = (await A(d, a, n))[0].id;
    await chrome.scripting.executeScript({
      target: { tabId: e },
      func: async ({ patientId: u, patientLname: f, patientFname: p, drug: w, file: m }) => {
        try {
          const g = await window.uploadPdf({
            patientId: u,
            patientLname: f,
            patientFname: p,
            drug: w,
            file: m
          });
          console.log("upload succeeded:", g);
        } catch (g) {
          console.error("upload failed:", g);
        }
      },
      // pass blob and metadata along
      args: [{
        patientId: l,
        patientLname: n,
        patientFname: a,
        drug: h,
        file: o
      }]
    });
  }).catch((o) => console.error(`PA flow error: ${o}`));
});
