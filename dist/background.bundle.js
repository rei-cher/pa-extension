function S(o) {
  return new Promise((r, e) => {
    chrome.cookies.get(
      { url: o, name: "cmm_production_session" },
      (t) => {
        if (chrome.runtime.lastError)
          return console.error("Cookie API error:", chrome.runtime.lastError), e(chrome.runtime.lastError);
        r(t ? t.value : null);
      }
    );
  });
}
function T(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const r of o.sections || [])
    for (const e of r.rows || [])
      for (const t of e.questions || []) {
        const s = t.question_text || t.label || "";
        if (/date of birth/i.test(s))
          return t.answer_text ?? t.answer ?? null;
      }
  return null;
}
async function E(o) {
  console.log(`Getting patient info with ID - ${o}`);
  const r = `https://dashboard.covermymeds.com/api/requests/${o}?`;
  try {
    const e = await fetch(r, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!e.ok)
      throw new Error(`HTTP ${e.status}`);
    const t = await e.json();
    return console.log("PA data:", t), {
      patient_fname: t.patient_fname,
      patient_lname: t.patient_lname,
      patient_dob: T(t),
      drug: t.drug.split(" ")[0]
    };
  } catch (e) {
    throw console.error("Error fetching PA info:", e), e;
  }
}
self.getPatientInfo = E;
async function q(o, r, e, t) {
  const s = `https://dashboard.covermymeds.com/api/requests/${o}/download`, n = `*://www.covermymeds.com/request/faxconfirmation/${o}*`, i = (a) => {
    a.statusCode === 200 && a.url.match(n) && (chrome.downloads.download({
      url: s,
      filename: `${r}-${e}-${t}.pdf`
    }, (c) => {
      console.log("Download started, id=", c);
    }), chrome.webRequest.onCompleted.removeListener(i));
  };
  chrome.webRequest.onCompleted.addListener(i, { urls: [n] });
}
async function C(o, r, e) {
  console.log(`Trying to find the patient in ema: ${r} ${e} ${o}`);
  const t = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const s = {
      term: o,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, n = new URLSearchParams(s).toString(), i = await fetch(`${t}${n}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!i.ok)
      throw new Error(`HTTP ${i.status}`);
    const a = await i.json();
    console.log("EMA patient return data:", a);
    const c = Array.isArray(a) ? a : Array.isArray(a.patients) ? a.patients : [], u = r.toLowerCase().split(/\s+|-/).filter((l) => l), f = e.toLowerCase().split(/\s+|-/).filter((l) => l), w = c.filter((l) => {
      const p = [
        l.firstName || "",
        l.lastName || "",
        l.fullName || ""
      ].join(" ").toLowerCase(), b = u.some((m) => p.includes(m)), y = f.some((m) => p.includes(m));
      return b && y;
    });
    return console.log("Matched patients:", w), w;
  } catch (s) {
    throw console.error(`Error fetching user in ema: ${s}`), s;
  }
}
const D = (o) => new Promise((r, e) => {
  const t = new FileReader();
  t.onload = () => {
    const s = t.result.split(",")[1];
    r(s);
  }, t.onerror = e, t.readAsDataURL(o);
});
chrome.tabs.onUpdated.addListener(async (o, r, e) => {
  if (r.status !== "complete") return;
  const t = e.url;
  if (!t.includes("/v2/requests/")) return;
  const s = t.split("/").pop();
  S(t).then((n) => {
    if (!n) throw new Error(`No session token for ${t}`);
    return E(s);
  }).then(async ({ patient_fname: n, patient_lname: i, patient_dob: a, drug: c }) => {
    const u = a.replace(/\//g, "-");
    return console.log({ patient_fname: n, patient_lname: i, dobSafe: u, drug: c }), q(s, n, i, c).then((f) => ({ file: f, patient_fname: n, patient_lname: i, patient_dob: a, drug: c }));
  }).then(async ({ file: n, patient_fname: i, patient_lname: a, patient_dob: c, drug: u }) => {
    const f = await C(c, i, a);
    if (!f.length) throw new Error("No matching EMA patient found");
    const w = f[0].id, l = await D(n), p = await chrome.tabs.query({ url: "*://khasak.ema.md/*" });
    if (!p.length) throw new Error("Could not find an open EMA tab");
    const b = p[0].id;
    await chrome.scripting.executeScript({
      target: { tabId: b },
      world: "MAIN",
      func: async ({ id: y, patient_lname: m, patient_fname: A, drug: P, b64: N }) => {
        const k = await (await fetch(`data:application/pdf;base64,${N}`)).blob(), $ = new File(
          [k],
          `${A}-${m}-${P}.pdf`,
          { type: "application/pdf" }
        ), I = [{
          patient: {
            id: String(y),
            lastName: m,
            firstName: A
          },
          additionalInfo: {
            performedDate: (/* @__PURE__ */ new Date()).toISOString()
          },
          fileName: $.name,
          title: `${P} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
        }], g = new FormData();
        g.append("dtoList", JSON.stringify(I)), g.append("files", $, $.name);
        for (let [d, h] of g.entries())
          h instanceof Blob ? console.log(d, "→ blob:", await h.text()) : console.log(d, "→", h);
        try {
          const d = await fetch(
            "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
            {
              method: "POST",
              credentials: "include",
              body: g
            }
          );
          if (!d.ok) {
            const h = await d.text();
            throw new Error(`Upload failed ${d.status}: ${h}`);
          }
          console.log("Upload succeeded:", await d.json());
        } catch (d) {
          console.error("Upload error:", d);
        }
      },
      args: [{
        id: w,
        patient_lname: a,
        patient_fname: i,
        drug: u,
        b64: l
      }]
    });
  }).catch((n) => console.error(`PA flow error: ${n}`));
});
