function y(o) {
  return new Promise((n, e) => {
    chrome.cookies.get(
      { url: o, name: "cmm_production_session" },
      (t) => {
        if (chrome.runtime.lastError)
          return console.error("Cookie API error:", chrome.runtime.lastError), e(chrome.runtime.lastError);
        n(t ? t.value : null);
      }
    );
  });
}
function $(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const n of o.sections || [])
    for (const e of n.rows || [])
      for (const t of e.questions || []) {
        const a = t.question_text || t.label || "";
        if (/date of birth/i.test(a))
          return t.answer_text ?? t.answer ?? null;
      }
  return null;
}
async function p(o) {
  console.log(`Getting patient info with ID - ${o}`);
  const n = `https://dashboard.covermymeds.com/api/requests/${o}?`;
  try {
    const e = await fetch(n, {
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
      patient_dob: $(t),
      drug: t.drug.split(" ")[0]
    };
  } catch (e) {
    throw console.error("Error fetching PA info:", e), e;
  }
}
self.getPatientInfo = p;
async function P(o, n, e, t) {
  const a = `https://dashboard.covermymeds.com/api/requests/${o}/download`, s = `*://www.covermymeds.com/request/faxconfirmation/${o}*`, i = (r) => {
    r.statusCode === 200 && r.url.match(s) && r.type === "main_frame" && (chrome.downloads.download({
      url: a,
      filename: `${n}-${e}-${t}.pdf`
    }, (c) => {
      console.log("Download started, id=", c);
    }), chrome.webRequest.onCompleted.removeListener(i));
  };
  chrome.webRequest.onCompleted.addListener(i, {
    urls: [s],
    types: ["main_frame"]
    // Listen for document requests
  });
}
async function A(o, n, e) {
  console.log(`Trying to find the patient in ema: ${n} ${e} ${o}`);
  const t = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const a = {
      term: o,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, s = new URLSearchParams(a).toString(), i = await fetch(`${t}${s}`, {
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
    const c = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], m = n.toLowerCase().split(/\s+|-/).filter((l) => l), d = e.toLowerCase().split(/\s+|-/).filter((l) => l), u = c.filter((l) => {
      const h = [
        l.firstName || "",
        l.lastName || "",
        l.fullName || ""
      ].join(" ").toLowerCase(), w = m.some((f) => h.includes(f)), g = d.some((f) => h.includes(f));
      return w && g;
    });
    return console.log("Matched patients:", u), u;
  } catch (a) {
    throw console.error(`Error fetching user in ema: ${a}`), a;
  }
}
chrome.tabs.onUpdated.addListener(async (o, n, e) => {
  if (n.status !== "complete") return;
  const t = e.url;
  if (!t.includes("/v2/requests/")) return;
  const a = t.split("/").pop();
  y(t).then((s) => {
    if (!s) throw new Error(`No session token for ${t}`);
    return p(a);
  }).then(async ({ patient_fname: s, patient_lname: i, patient_dob: r, drug: c }) => {
    const m = r.replace(/\//g, "-");
    console.log({ patient_fname: s, patient_lname: i, dobSafe: m, drug: c }), P(a, s, i, c);
  }).then(async ({ file: s, patient_fname: i, patient_lname: r, patient_dob: c, drug: m }) => {
    const d = await A(c, i, r);
    if (!d.length) throw new Error("No matching EMA patient found");
    d[0].id;
  }).catch((s) => console.error(`PA flow error: ${s}`));
});
