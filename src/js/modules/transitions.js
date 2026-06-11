/**
 * transitions.js - Gestion des transitions de page (CSS natives)
 * Version standard compatible file:// et http://
 */

(function() {
    const initTransitions = () => {
        const transitionOverlay = document.querySelector('.page-transition');
        if (!transitionOverlay) return;

        // 1. Transition d'entrée (au chargement de la page et navigation historique bfcache)
        const handlePageShow = () => {
            setTimeout(() => {
                transitionOverlay.classList.add('is-hidden');
            }, 50);
        };

        // Lancement de la transition d'entrée au chargement initial
        handlePageShow();

        // Gestion de la restauration depuis le cache du navigateur (bouton retour/suivant)
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                handlePageShow();
            }
        });

        // 2. Intercepter les liens pour animer la transition de sortie
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                const targetUrl = this.href;

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

                // On fait réapparaître le voile noir et l'icône grandit (elle est en scale(1.1) par défaut dans layout.css)
                transitionOverlay.classList.remove('is-hidden');

                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 600); // Durée de la transition CSS (0.6s)
            });
        });
    };

    // Exécution
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTransitions);
    } else {
        initTransitions();
    }
})();
