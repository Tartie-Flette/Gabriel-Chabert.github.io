/**
 * main.js - Point d'entrée de l'application (Version classique IIFE)
 * Gère l'initialisation de l'IHM et des composants interactifs
 */
(function() {
    // Initialisation globale de l'application
    const startApp = () => {
        // 1. Initialiser les Animations de Scroll et Hover (GSAP ScrollTrigger)
        if (typeof window.initAnimations === 'function') {
            window.initAnimations();
        }

        // 2. Initialiser la Scène 3D Interactive (Three.js) dans le Hero
        if (typeof window.initRobot3D === 'function') {
            window.initRobot3D();
        }

        // 3. Initialiser la barre de défilement (Scroll Progress Bar)
        initScrollProgress();

        // 4. Initialiser l'effet de halo interactif (Glow Cards)
        initGlowCards();

        // 5. Initialiser les filtres du CV (Expériences / Formations)
        initTimelineFilters();

        // 6. Initialiser l'animation des jauges de compétences
        initCompetencyJauges();

        // 7. Initialiser la copie d'e-mail en un clic
        initEmailCopy();
    };

    const initScrollProgress = () => {
        const progressBar = document.querySelector('.scroll-progress');
        if (!progressBar) return;

        const updateProgress = () => {
            const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = totalHeight > 0 ? (window.pageYOffset / totalHeight) * 100 : 0;
            progressBar.style.width = `${progress}%`;
        };

        window.addEventListener('scroll', updateProgress, { passive: true });
        window.addEventListener('resize', updateProgress, { passive: true });
        updateProgress();
    };

    const initGlowCards = () => {
        const cards = document.querySelectorAll('.glow-card');
        if (cards.length === 0) return;

        document.addEventListener('mousemove', (e) => {
            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                if (
                    e.clientX < rect.left - 150 ||
                    e.clientX > rect.right + 150 ||
                    e.clientY < rect.top - 150 ||
                    e.clientY > rect.bottom + 150
                ) {
                    return;
                }
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        });
    };

    const initTimelineFilters = () => {
        const filterBtns = document.querySelectorAll('.filter-btn');
        const items = document.querySelectorAll('.timeline-item');
        if (filterBtns.length === 0 || items.length === 0) return;

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.getAttribute('data-filter');
                
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                items.forEach(item => {
                    const category = item.getAttribute('data-category');
                    if (filter === 'all' || category === filter) {
                        item.style.display = 'block';
                        if (window.gsap) {
                            window.gsap.fromTo(item, 
                                { opacity: 0, y: 15 }, 
                                { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform' }
                            );
                        }
                    } else {
                        item.style.display = 'none';
                    }
                });
                
                // Rafraîchir ScrollTrigger
                if (window.ScrollTrigger) {
                    window.ScrollTrigger.refresh();
                }
            });
        });
    };

    const initCompetencyJauges = () => {
        const fills = document.querySelectorAll('.jauge-fill');
        if (fills.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const fill = entry.target;
                    const percent = fill.getAttribute('data-percent');
                    fill.style.width = `${percent}%`;
                    observer.unobserve(fill);
                }
            });
        }, { threshold: 0.1 });

        fills.forEach(fill => observer.observe(fill));
    };

    const initEmailCopy = () => {
        const emailBtn = document.getElementById('email-btn');
        if (!emailBtn) return;

        emailBtn.addEventListener('click', () => {
            const email = 'gabriel.chabert.s@gmail.com';
            navigator.clipboard.writeText(email).then(() => {
                emailBtn.textContent = 'E-mail copié !';
                setTimeout(() => {
                    emailBtn.textContent = 'Me contacter';
                }, 2000);
            }).catch(err => {
                console.error('Erreur lors de la copie : ', err);
            });
        });
    };

    // Éviter le piège de la condition de course si le DOM est déjà prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }
})();
