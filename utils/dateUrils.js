/**
 * returns current date as "YYYY-MM-DD".
 * used to check if 'sent' includes today's date.
 */
export function getTodayISODate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
