function S(o) {
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
function I(o) {
  if (o.patient_dob) return o.patient_dob;
  for (const n of o.sections || [])
    for (const e of n.rows || [])
      for (const t of e.questions || []) {
        const s = t.question_text || t.label || "";
        if (/date of birth/i.test(s))
          return t.answer_text ?? t.answer ?? null;
      }
  return null;
}
async function A(o) {
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
      patient_dob: I(t),
      drug: t.drug.split(" ")[0]
    };
  } catch (e) {
    throw console.error("Error fetching PA info:", e), e;
  }
}
self.getPatientInfo = A;
async function q(o, n, e, t) {
  const s = `https://dashboard.covermymeds.com/api/requests/${o}/download`, a = `*://portal-services.covermymeds.com/requests/${o}/redacted*`;
  return new Promise((c, r) => {
    const f = (h) => {
      chrome.webRequest.onCompleted.removeListener(f), fetch(h.url, { credentials: "include" }).then((i) => {
        if (!i.ok) throw new Error(`HTTP ${i.status}`);
        return i.json();
      }).then((i) => {
        i.workflow_status === "Sent to Plan" ? fetch(s, { credentials: "include" }).then((l) => {
          if (!l.ok) throw new Error(`PDF fetch failed ${l.status}`);
          return l.blob();
        }).then((l) => {
          const d = new File(
            [l],
            `${n}-${e}-${t}.pdf`,
            { type: l.type }
          );
          c(d);
        }).catch(r) : r(`Bad status: ${i.workflow_status}`);
      }).catch(r);
    };
    chrome.webRequest.onCompleted.addListener(
      f,
      { urls: [a] }
    );
  });
}
async function v(o, n, e) {
  console.log(`Trying to find the patient in ema: ${n} ${e} ${o}`);
  const t = "https://khasak.ema.md/ema/ws/v3/patients/search?";
  try {
    const s = {
      term: o,
      selector: "lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId",
      "sorting.sortBy": "lastName,firstName",
      "sorting.sortOrder": "asc",
      "paging.pageSize": 25
    }, a = new URLSearchParams(s).toString(), c = await fetch(`${t}${a}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
    if (!c.ok)
      throw new Error(`HTTP ${c.status}`);
    const r = await c.json();
    console.log("EMA patient return data:", r);
    const f = Array.isArray(r) ? r : Array.isArray(r.patients) ? r.patients : [], h = n.toLowerCase().split(/\s+|-/).filter((d) => d), i = e.toLowerCase().split(/\s+|-/).filter((d) => d), l = f.filter((d) => {
      const p = [
        d.firstName || "",
        d.lastName || "",
        d.fullName || ""
      ].join(" ").toLowerCase(), y = h.some((m) => p.includes(m)), $ = i.some((m) => p.includes(m));
      return y && $;
    });
    return console.log("Matched patients:", l), l;
  } catch (s) {
    throw console.error(`Error fetching user in ema: ${s}`), s;
  }
}
const D = (o) => new Promise((n, e) => {
  const t = new FileReader();
  t.onload = () => {
    const s = t.result.split(",")[1];
    n(s);
  }, t.onerror = e, t.readAsDataURL(o);
});
chrome.tabs.onUpdated.addListener(async (o, n, e) => {
  if (n.status !== "complete") return;
  const t = e.url;
  if (!t.includes("/v2/requests/")) return;
  const s = t.split("/").pop();
  S(t).then((a) => {
    if (!a) throw new Error(`No session token for ${t}`);
    return A(s);
  }).then(async ({ patient_fname: a, patient_lname: c, patient_dob: r, drug: f }) => {
    const h = r.replace(/\//g, "-");
    return console.log({ patient_fname: a, patient_lname: c, dobSafe: h, drug: f }), q(s, a, c, f).then((i) => ({ file: i, patient_fname: a, patient_lname: c, patient_dob: r, drug: f }));
  }).then(async ({ file: a, patient_fname: c, patient_lname: r, patient_dob: f, drug: h }) => {
    const i = await v(f, c, r);
    if (!i.length) throw new Error("No matching EMA patient found");
    const l = i[0].id, d = await D(a), p = await chrome.tabs.query({ url: "*://khasak.ema.md/*" });
    if (!p.length) throw new Error("Could not find an open EMA tab");
    const y = p[0].id;
    await chrome.scripting.executeScript({
      target: { tabId: y },
      world: "MAIN",
      func: async ({ id: $, patient_lname: m, patient_fname: P, drug: E, b64: k }) => {
        const N = await (await fetch(`data:application/pdf;base64,${k}`)).blob(), b = new File(
          [N],
          `${P}-${m}-${E}.pdf`,
          { type: "application/pdf" }
        ), T = [{
          patient: {
            id: String($),
            lastName: m,
            firstName: P
          },
          additionalInfo: {
            performedDate: (/* @__PURE__ */ new Date()).toISOString()
          },
          fileName: b.name,
          title: `${E} pa submitted: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`
        }], g = new FormData();
        g.append("dtoList", JSON.stringify(T)), g.append("files", b, b.name);
        for (let [u, w] of g.entries())
          w instanceof Blob ? console.log(u, "→ blob:", await w.text()) : console.log(u, "→", w);
        try {
          const u = await fetch(
            "https://khasak.ema.md/ema/ws/v3/fileAttachment/upload",
            {
              method: "POST",
              credentials: "include",
              body: g
            }
          );
          if (!u.ok) {
            const w = await u.text();
            throw new Error(`Upload failed ${u.status}: ${w}`);
          }
          console.log("Upload succeeded:", await u.json());
        } catch (u) {
          console.error("Upload error:", u);
        }
      },
      args: [{
        id: l,
        patient_lname: r,
        patient_fname: c,
        drug: h,
        b64: d
      }]
    });
  }).catch((a) => console.error(`PA flow error: ${a}`));
});
