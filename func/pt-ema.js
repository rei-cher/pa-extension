export async function findEmaPatient(dob, pt_fname, pt_lname) {
    console.log(`Trying to find the patient in ema: ${pt_fname} ${pt_lname} ${dob}`);
    const url = "https://khasak.ema.md/ema/ws/v3/patients/search?";

    try {
        const payload = {
            term: dob,
            selector: 'lastName,firstName,fullName,mrn,pmsId,dateOfBirth,encryptedId',
            'sorting.sortBy': 'lastName,firstName',
            'sorting.sortOrder': 'asc',
            'paging.pageSize': 25
        };

        // Convert the payload to a query string
        const queryString = new URLSearchParams(payload).toString();

        const resp = await fetch(`${url}${queryString}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        const data = await resp.json();
        console.log('EMA patient return data:', data);

        // array of patients
        const patients = Array.isArray(data) ? data : (Array.isArray(data.patients) ? data.patients : []);

        // split the names into parts
        const firstParts = pt_fname.toLowerCase().split(/\s+|-/).filter(s => s);
        const lastParts = pt_lname.toLowerCase().split(/\s+|-/).filter(s => s);

        // filter for at least one part of each in the patient
        const matches = patients.filter(p => {
            // build a single searchable string per patient
            const haystack = [
                p.firstName || '',
                p.lastName  || '',
                p.fullName || ''
            ].join(' ').toLowerCase();

            // require at least one match from firstParts AND one from lastParts
            // needed for compound names
            const firstMatch = firstParts.some(fp => haystack.includes(fp));
            const lastMatch  = lastParts .some(lp => haystack.includes(lp));
            return firstMatch && lastMatch;
        });

        console.log('Matched patients:', matches);
    }
    catch (error) {
        console.error(`Error fetching user in ema: ${error}`);
        throw error;
    }
}