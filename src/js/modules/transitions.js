/**
 * transitions.js - Gestion des transitions de page (CSS natives)
 * Version standard compatible file:// et http:// avec fixation anti-rollback
 */

(function() {
    const initTransitions = () => {
        const transitionOverlay = document.querySelector('.page-transition');
        if (!transitionOverlay) return;

        const svg = transitionOverlay.querySelector('svg');

        // Nettoyer et masquer l'overlay (utilisé lors du retour arrière / bfcache)
        const handlePageRestore = () => {
            // Réinitialiser le flag de transition
            window.isTransitioning = false;

            // Nettoyage complet des styles inline figés lors de l'ancienne sortie
            transitionOverlay.style.transition = '';
            transitionOverlay.style.opacity = '';
            if (svg) {
                svg.style.transition = '';
                svg.style.transform = '';
                svg.style.opacity = '';
            }

            // Force le reflow pour appliquer la transition CSS d'entrée
            void transitionOverlay.offsetWidth;

            // Masquer l'overlay
            setTimeout(() => {
                transitionOverlay.classList.add('is-hidden');
            }, 50);
        };

        // Gestion de la restauration depuis le cache du navigateur (bouton retour/suivant)
        window.addEventListener('pageshow', (event) => {
            // Si la page est restaurée depuis le cache (bfcache) ou si l'overlay est resté visible/bloqué
            if (event.persisted || !transitionOverlay.classList.contains('is-hidden')) {
                handlePageRestore();
            }
        });

        // Intercepter les clics sur les liens pour animer la transition de sortie
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                const targetUrl = this.href;

                // Ignorer les liens externes, ancres, PDF, etc.
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

                if (window.isTransitioning) {
                    e.preventDefault();
                    return;
                }

                e.preventDefault();
                window.isTransitioning = true;

                // Annuler immédiatement les minuteurs de sécurité de la page courante pour éviter le rollback
                if (window.transitionTimeout1) clearTimeout(window.transitionTimeout1);
                if (window.transitionTimeout2) clearTimeout(window.transitionTimeout2);

                // Faire réapparaître le voile noir et agrandir l'icône
                transitionOverlay.classList.remove('is-hidden');

                let transitionFinished = false;
                const triggerNavigation = () => {
                    if (transitionFinished) return;
                    transitionFinished = true;

                    // Figer les styles inline à la fin de la transition pour éviter tout rollback/saut
                    if (svg) {
                        svg.style.transition = 'none';
                        svg.style.transform = 'scale(1.1)';
                        svg.style.opacity = '1';
                    }
                    transitionOverlay.style.transition = 'none';
                    transitionOverlay.style.opacity = '1';

                    // Forcer le reflow pour appliquer les styles instantanément au niveau du GPU/moteur
                    void transitionOverlay.offsetWidth;

                    // Attendre le prochain frame de rendu (double-frame buffer) avant d'attribuer l'URL
                    // pour s'assurer que l'état figé est bien dessiné à l'écran
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            window.location.href = targetUrl;
                        }, 20);
                    });
                };

                // Écouter la transition d'opacité de l'overlay (prend 0.6s)
                transitionOverlay.addEventListener('transitionend', function handler(event) {
                    if (event.propertyName === 'opacity') {
                        transitionOverlay.removeEventListener('transitionend', handler);
                        triggerNavigation();
                    }
                });

                // Fallback de sécurité (la transition dure 600ms en CSS)
                setTimeout(triggerNavigation, 650);
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
