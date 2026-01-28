// version.js
// Shows a simple numeric version that updates on every push.
// We derive the version from the latest commit timestamp on GitHub main.

(function () {
    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function toNumericVersionFromISO(iso) {
        // YYYYMMDDHHmm (local time) -> numeric-ish string
        const d = new Date(iso);
        if (!Number.isFinite(d.getTime())) return '';
        const yyyy = d.getFullYear();
        const mm = pad2(d.getMonth() + 1);
        const dd = pad2(d.getDate());
        const hh = pad2(d.getHours());
        const min = pad2(d.getMinutes());
        return `${yyyy}${mm}${dd}${hh}${min}`;
    }

    function setText(text, { title } = {}) {
        const el = document.getElementById('appVersion');
        if (!el) return;
        el.textContent = text;
        if (title) el.title = title;
    }

    document.addEventListener('DOMContentLoaded', function () {
        // If this element doesn't exist on a page, do nothing.
        const el = document.getElementById('appVersion');
        if (!el) return;

        setText('Version: …');

        const repo = 'amaBridge/hancock-county-food-pantry';
        const url = `https://api.github.com/repos/${repo}/commits/main`;

        fetch(url, { cache: 'no-store' })
            .then(r => (r && r.ok ? r.json() : Promise.reject(new Error('version fetch failed'))))
            .then(data => {
                const sha = String(data?.sha || '');
                const iso = data?.commit?.committer?.date || data?.commit?.author?.date || '';
                const version = toNumericVersionFromISO(iso);
                if (!version) throw new Error('bad version');
                setText(`Version: ${version}`, { title: sha || undefined });
            })
            .catch(() => {
                // If offline or blocked, keep a stable placeholder.
                setText('Version: 0');
            });
    });
})();
