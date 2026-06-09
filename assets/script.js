/**
 * script.js - Gestion globale des transitions et du mode sombre
 * Gabriel Chabert | Portfolio
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Transition de sortie de page
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            const targetUrl = this.href;
            
            // Ignorer les liens externes, les ancres, les e-mails, et les liens de téléchargement de fichiers
            if (
                this.target === '_blank' || 
                !href || 
                href.startsWith('#') || 
                href.startsWith('mailto:') || 
                href.startsWith('javascript:') ||
                href.endsWith('.pdf')
            ) {
                return; 
            }

            e.preventDefault();
            const transition = document.querySelector('.page-transition');
            if (transition) {
                transition.classList.remove('is-hidden');
            }
            
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 600);
        });
    });

    // 2. Bouton de bascule du Mode Sombre
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateToggleIcon(isDark);
        });

        // Configurer l'icône initiale selon la présence de la classe dark-mode
        const isDarkNow = document.documentElement.classList.contains('dark-mode');
        updateToggleIcon(isDarkNow);
    }
});

/**
 * Met à jour l'icône SVG du bouton de bascule du thème
 * @param {boolean} isDark 
 */
function updateToggleIcon(isDark) {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    
    if (isDark) {
        // Icône de Soleil pour repasser en mode clair
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

// 3. Transition d'entrée de page (s'exécute le plus vite possible)
window.addEventListener('pageshow', function(event) {
    const transition = document.querySelector('.page-transition');
    if (transition) {
        setTimeout(() => {
            transition.classList.add('is-hidden');
        }, 50);
    }
});
