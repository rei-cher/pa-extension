// in json look for 'Date of Birth' to extract patient's dob
function extractPatientDOB(data) {
  if (data.patient_dob) return data.patient_dob;

  for (const section of data.sections || []) {
    for (const row of section.rows || []) {
      for (const q of row.questions || []) {
        const prompt = q.question_text || q.label || '';
        if (/date of birth/i.test(prompt)) {
          return q.answer_text ?? q.answer ?? null;
        }
      }
    }
  }
  return null;
}

export async function getPatientInfo(pa_id) {
    console.log(`Getting patient info with ID - ${pa_id}`)
    const url = `https://dashboard.covermymeds.com/api/requests/${pa_id}?`;
  
    try {
      const resp = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
  
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
  
      const data = await resp.json();
      console.log('PA data:', data);

      // return drug, patient fname, lname, and dob
      return {
        patient_fname: data.patient_fname,
        patient_lname: data.patient_lname,
        patient_dob: extractPatientDOB(data),
        drug: data.drug
      };
      
    } 
    catch (error) {
      console.error('Error fetching PA info:', error);
      throw error;
    }
}

self.getPatientInfo = getPatientInfo;