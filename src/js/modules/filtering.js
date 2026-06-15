/**
 * filtering.js - Filtrage dynamique par tags technologiques
 * Permet de filtrer instantanément les projets et expériences au clic sur les compétences.
 */

(function() {
    const initFiltering = () => {
        const tags = document.querySelectorAll('.skill-tag');
        const projectItems = document.querySelectorAll('.project-item');
        const timelineItems = document.querySelectorAll('.timeline-item');

        if (tags.length === 0) return;

        // Déterminer sur quelle page nous sommes et quels conteneurs d'items nous ciblons
        const items = projectItems.length > 0 ? projectItems : timelineItems;
        
        if (items.length === 0) {
            // Page d'accueil (index.html) : rediriger vers projets.html avec le bon tag
            const homepageMapping = {
                'c / c++': 'C',
                'microcontrôleurs': 'Microcontrôleur',
                'uart / can': 'UART',
                'ros 2': 'ROS 2',
                'python': 'Python',
                'matlab/simulink': 'MATLAB/Simulink'
            };

            tags.forEach(tag => {
                const text = tag.textContent.trim().toLowerCase();
                const targetFilter = homepageMapping[text];

                if (targetFilter) {
                    tag.style.cursor = 'pointer';
                    tag.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const targetUrl = `projets.html?filter=${encodeURIComponent(targetFilter)}`;

                        // Transition fluide via le voile noir si disponible
                        const transitionOverlay = document.querySelector('.page-transition');
                        if (transitionOverlay && window.isTransitioning === false) {
                            window.isTransitioning = true;
                            if (window.transitionTimeout1) clearTimeout(window.transitionTimeout1);
                            if (window.transitionTimeout2) clearTimeout(window.transitionTimeout2);
                            transitionOverlay.classList.remove('is-hidden');

                            let transitionFinished = false;
                            const triggerNav = () => {
                                if (transitionFinished) return;
                                transitionFinished = true;

                                const svg = transitionOverlay.querySelector('svg');
                                if (svg) {
                                    svg.style.transition = 'none';
                                    svg.style.transform = 'scale(1.1)';
                                    svg.style.opacity = '1';
                                }
                                transitionOverlay.style.transition = 'none';
                                transitionOverlay.style.opacity = '1';

                                void transitionOverlay.offsetWidth;

                                requestAnimationFrame(() => {
                                    setTimeout(() => {
                                        window.location.href = targetUrl;
                                    }, 20);
                                });
                            };

                            transitionOverlay.addEventListener('transitionend', function handler(event) {
                                if (event.propertyName === 'opacity') {
                                    transitionOverlay.removeEventListener('transitionend', handler);
                                    triggerNav();
                                }
                            });
                            setTimeout(triggerNav, 650);
                        } else {
                            window.location.href = targetUrl;
                        }
                    });
                } else {
                    // Pour les tags inactifs, désactiver complètement les événements souris pour éviter le curseur main et survol
                    tag.style.pointerEvents = 'none';
                    tag.style.cursor = 'default';
                }
            });
            return;
        }

        const container = items[0].parentElement;
        let activeFilter = null;
        let filterIndicator = null;

        // Créer l'indicateur visuel de filtre actif (Barre d'alerte filtrage)
        const createFilterIndicator = () => {
            filterIndicator = document.createElement('div');
            filterIndicator.className = 'active-filter-bar';
            filterIndicator.style.display = 'none';
            
            // Placer l'indicateur juste avant le conteneur des projets/expériences
            container.parentNode.insertBefore(filterIndicator, container);

            filterIndicator.addEventListener('click', (e) => {
                if (e.target.closest('.clear-filter-btn') || e.target.closest('.active-filter-bar')) {
                    clearFilters();
                }
            });
        };

        const updateFilterIndicator = (tagName) => {
            if (!filterIndicator) createFilterIndicator();

            if (tagName) {
                // Récupérer la casse exacte depuis le tag correspondant du DOM
                let formattedName = tagName;
                const matchedTag = Array.from(tags).find(t => t.textContent.trim().toLowerCase() === tagName.trim().toLowerCase());
                if (matchedTag) {
                    formattedName = matchedTag.textContent.trim();
                }

                filterIndicator.innerHTML = `
                    <span>Filtre actif : <strong class="filter-highlight">${formattedName}</strong></span>
                    <button class="clear-filter-btn" aria-label="Effacer le filtre">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;
                filterIndicator.style.display = 'flex';
                // Petite animation GSAP si disponible, sinon fondu CSS
                if (window.gsap) {
                    window.gsap.fromTo(filterIndicator, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.3 });
                }
            } else {
                filterIndicator.style.display = 'none';
            }
        };

        const filterItems = (tagName) => {
            const searchTag = tagName.trim().toLowerCase();

            // Activer le mode filtrage sur le conteneur pour appliquer les transitions CSS
            container.classList.add('is-filtering');

            items.forEach(item => {
                let match = false;
                const itemTags = item.querySelectorAll('.skill-tag');
                
                itemTags.forEach(t => {
                    if (t.textContent.trim().toLowerCase() === searchTag) {
                        match = true;
                    }
                });

                if (match) {
                    item.classList.remove('is-filtered-out');
                } else {
                    item.classList.add('is-filtered-out');
                }
            });

            // Mettre à jour l'état visuel (classe .active) sur tous les tags identiques
            tags.forEach(t => {
                if (t.textContent.trim().toLowerCase() === searchTag) {
                    t.classList.add('active');
                } else {
                    t.classList.remove('active');
                }
            });

            activeFilter = tagName;
            updateFilterIndicator(tagName);

            // Actualiser ScrollTrigger (GSAP) si les éléments bougent pour éviter les décalages de triggers
            if (window.ScrollTrigger) {
                window.ScrollTrigger.refresh();
            }
        };

        const clearFilters = () => {
            items.forEach(item => {
                item.classList.remove('is-filtered-out');
            });

            tags.forEach(t => {
                t.classList.remove('active');
            });

            // Désactiver le mode filtrage pour le conteneur
            container.classList.remove('is-filtering');

            activeFilter = null;
            updateFilterIndicator(null);

            if (window.ScrollTrigger) {
                window.ScrollTrigger.refresh();
            }
        };

        // Gérer le clic sur chaque tag
        tags.forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagName = tag.textContent.trim();

                if (activeFilter && activeFilter.toLowerCase() === tagName.toLowerCase()) {
                    clearFilters();
                } else {
                    filterItems(tagName);
                }
            });
        });

        // Lire le paramètre 'filter' dans l'URL au chargement de la page
        const urlParams = new URLSearchParams(window.location.search);
        const urlFilter = urlParams.get('filter');
        if (urlFilter) {
            // Attendre un court instant pour que l'animation d'entrée se lance
            setTimeout(() => {
                filterItems(decodeURIComponent(urlFilter));
            }, 100);
        }
    };

    // Exécution au chargement du DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFiltering);
    } else {
        initFiltering();
    }
})();
