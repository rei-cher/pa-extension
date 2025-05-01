document.addEventListener('DOMContentLoaded', () => {
    const list = document.getElementById('historyList');

    chrome.storage.local.get(['downloadHistory'], result => {
        const history = result.downloadHistory || [];

        history.slice(0, 10).forEach(entry => {
            const li = document.createElement('li');
            li.textContent = entry;
            list.appendChild(li);
        });

        if (history.length === 0) {
            list.innerHTML = "<li>No recent downloads.</li>";
        }
    });
});
  