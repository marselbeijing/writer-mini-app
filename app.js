document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;
    tg.expand(); // Расширяем приложение на весь экран

    const newBookBtn = document.getElementById('new-book-btn');

    if (newBookBtn) {
        newBookBtn.addEventListener('click', () => {
            window.location.href = 'editor.html';
        });
    }
});
