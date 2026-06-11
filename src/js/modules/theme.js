/**
 * theme.js - Module de gestion du thème Jour/Nuit (Dark Mode)
 * Version standard compatible file:// et http://
 */

(function() {
    const initTheme = () => {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;

        // Écouteur de clic sur le bouton de bascule
        themeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateToggleIcon(isDark);
        });

        // Configurer l'icône initiale
        const isDarkNow = document.documentElement.classList.contains('dark-mode');
        updateToggleIcon(isDarkNow);
    };

    /**
     * Met à jour le contenu SVG du bouton pour afficher l'icône appropriée (soleil/lune)
     * @param {boolean} isDark 
     */
    function updateToggleIcon(isDark) {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;

        if (isDark) {
            // Icône de Soleil pour activer le mode clair
            themeToggle.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
            `;
            themeToggle.setAttribute('aria-label', 'Activer le mode clair');
        } else {
            // Icône de Lune pour activer le mode sombre
            themeToggle.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            `;
            themeToggle.setAttribute('aria-label', 'Activer le mode sombre');
        }
    }

    // Exécution
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
})();
