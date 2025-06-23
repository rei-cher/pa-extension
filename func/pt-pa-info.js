// in json look for 'Date of Birth' to extract patient's dob
function extractPatientDOB(data) {
    if (data.patient_dob) return data.patient_dob;

    for (const section of data.sections || []) {
        for (const row of section.rows || []) {
            for (const q of row.questions || []) {
                const prompt = q.question_text || q.label || q.name || '';
                // console.log(prompt);
                if (/date of birth/i.test(prompt) || /patient_date_of_birth/i.test(prompt)) {
                    return q.answer_text ?? q.answer ?? null;
                }
            }
        }
    }
    return null;
}

function findProviderNpiAnswer(obj) {
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const result = findProviderNpiAnswer(item);
            if (result) return result;
        }
    }
    else if (typeof obj === 'object' && obj !== null) {
        if (obj.name === "provider_npi" && "answer_text" in obj) {
            return obj.answer_text;
        }
        for (const key in obj) {
            const result = findProviderNpiAnswer(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

function findExtraInformation(obj) {
    if (Array.isArray(obj)) {
        for (const item of obj) {
            const result = findExtraInformation(item);
            if (result) return result;
        }
    }
    else if (typeof obj === "object" && obj !== null) {
        if (obj.name === "information" && "description" in obj) {
            return obj.description;
        }
        for (const key in obj) {
            const result = findExtraInformation(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

export async function getPAInfo(pa_id, source) {
    console.log(`[Source ${source}] Getting patient info with ID - ${pa_id}`)
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

        }

        const data = await resp.json();
        console.log('PA data:', data);

        // return drug, patient fname, lname, and dob
        return {
            patient_fname: data.patient_fname,
            patient_lname: data.patient_lname,
            patient_dob: extractPatientDOB(data),
            drug: data.drug.split(' ')[0],
            full_drug_name: data.drug,
            submitted_by: data.submitted_by,
            epa_status: data.ePA_Status,
            epa_status_description: data.ePA_Status_description,
            workflow_status: data.workflow_status,
            submitted_by_user_category: data.submitted_by_user_category,
            completed: data.completed,
            insurance: data.form_description.split(" ")[0],
            status_dialog_sending: data.status_dialog_sending?.text ? data.status_dialog_sending.text : null,
            status_dialog_loading: data.status_dialog_loading?.text ? data.status_dialog_loading.text : null,
            sent: data?.sent ? data.sent : null,
            npi: findProviderNpiAnswer(data),
            request_outcome: data?.request_outcome ? data.request_outcome : null,
            extra_info: findExtraInformation(data)
        };

    }
    catch (error) {
        console.log('Error fetching PA info:', error);
        return;
    }
}