export async function uploadPaToDb(pa_info, souce) {
    console.warn(`[uploadPaToDb] [${souce}] Uploading PA to DB`);
    console.log(`[uploadPaToDb] [pa_info] `,pa_info);
    const {
        pa_id,
        patient_fname,
        patient_lname,
        patient_dob,
        drug,
        submitted_by,
        insurance,
        patientId,
        npi
    } = pa_info;

    fetch('http://127.0.0.1:5000/api/pa_info/insert/', {
        method: 'POST',
        credentials: "include",
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            pa_id : pa_id,
            patient_fname : patient_fname,
            patient_lname : patient_lname,
            patient_dob : patient_dob,
            drug : drug,
            submitted_by : submitted_by,
            insurance : insurance,
            patientId : patientId,
            npi : npi

        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Received data:', data);
        })
        .catch(error => {
            console.error('Error calling API:', error);
        });

}