function i(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const n of o.sections || [])
    for (const e of n.rows || [])
      for (const t of e.questions || []) {
        const r = t.question_text || t.label || t.name || "";
        if (/date of birth/i.test(r) || /patient_date_of_birth/i.test(r))
          return t.answer_text ?? t.answer ?? null;
      }
  return null;
}
async function c(o) {
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
      patient_dob: i(t),
      drug: t.drug.split(" ")[0]
    };
  } catch (e) {
    throw console.error("Error fetching PA info:", e), e;
  }
}
self.getPatientInfo = c;
async function l(o, n, e, t) {
  return new Promise((r) => {
    const s = `https://dashboard.covermymeds.com/api/requests/${o}/download`;
    console.log("downloadPA called"), chrome.downloads.download({
      url: s,
      filename: `${n}-${e}-${t}.pdf`
    }, (a) => {
      a && (console.log("Download started, id=", a), r(a));
    });
  });
}
function d(o) {
  return new Promise((n, e) => {
    const t = (r) => {
      var s;
      r.id === o && ((s = r.state) == null ? void 0 : s.current) === "complete" && chrome.downloads.search({ id: o }, (a) => {
        a && a.length > 0 ? (n(a[0].filename), chrome.downloads.onChanged.removeListener(t)) : e(new Error("No results for downloadId"));
      });
    };
    chrome.downloads.onChanged.addListener(t);
  });
}
chrome.webRequest.onCompleted.addListener(
  (o) => {
    let e = o.url.split("/")[5];
    e.includes("?") && (e = e.split("?")[0]), console.log("PA ID: ", e), console.log("Details object: ", o), (o.url.includes(`dashboard.covermymeds.com/api/requests/${e}?type=Web%20Socket`) || o.url.includes(`dashboard.covermymeds.com/api/requests/${e}?type=Elapsed%20Time`) || o.url.includes(`covermymeds.com/request/faxconfirmation/${e}`)) && m(e);
  },
  // listen to the responses on those 2 pages for status updates on PAs
  { urls: ["*://dashboard.covermymeds.com/api/requests/*", "*://www.covermymeds.com/request/*"] }
);
function m(o) {
  c(o).then((n) => {
    const e = n.patient_fname, t = n.patient_lname;
    n.patient_dob;
    const r = n.drug;
    console.log(e, t, r), l(o, e, t, r).then((s) => (console.log("Checking the pass of the downloaded pdf file id: ", s), d(s))).then((s) => {
      console.log("PDF path: ", s);
    });
  });
}
