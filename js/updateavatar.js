/* ── Avatar initials ── */
function updateAvatar() {
    const nicknameEl = document.getElementById('user-nickname');
    const avatarEl = document.getElementById('user-avatar');
    if (!nicknameEl || !avatarEl) return;
    const nick = nicknameEl.textContent.trim();
    if (!nick || nick === '--') return;
    const letters = nick.replace(/[^a-zA-Z0-9]/g, '');
    avatarEl.textContent = (letters.slice(0, 2) || nick.slice(0, 2)).toUpperCase();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAvatar);
} else { updateAvatar(); }
const obs = new MutationObserver(updateAvatar);
function watchNickname() {
    const t = document.getElementById('user-nickname');
    if (t) obs.observe(t, { childList: true, characterData: true, subtree: true });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchNickname);
} else { watchNickname(); }

/* ── Khởi động BlackHole sau khi DOM + scripts sẵn sàng ── */
document.addEventListener('DOMContentLoaded', () => {
    if (typeof BlackHole !== 'undefined') BlackHole.init();
});