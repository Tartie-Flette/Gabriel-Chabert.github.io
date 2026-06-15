// Les bibliothèques GSAP et ScrollTrigger sont chargées via des balises de script globales dans le HTML.
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

export function initAnimations() {
    if (!gsap || !ScrollTrigger) {
        console.warn("GSAP ou ScrollTrigger n'est pas chargé. Les animations de défilement sont désactivées.");
        return;
    }

    // Enregistrer le plugin ScrollTrigger auprès de GSAP
    gsap.registerPlugin(ScrollTrigger);
    // 1. Animation d'entrée des cartes de compétences (Accueil)
    const skillCards = document.querySelectorAll('.skill-card');
    if (skillCards.length > 0) {
        skillCards.forEach(card => card.style.transition = 'none');
        gsap.from(skillCards, {
            scrollTrigger: {
                trigger: '.skills-grid',
                start: 'top 85%',
                toggleActions: 'play none none none'
            },
            opacity: 0,
            y: 30,
            duration: 0.6,
            stagger: 0.12,
            ease: "power2.out",
            onComplete: () => {
                skillCards.forEach(card => card.style.transition = '');
            }
        });
    }

    // 2. Animation d'entrée des Projets (Page Projets)
    const projectItems = document.querySelectorAll('.project-item');
    if (projectItems.length > 0) {
        projectItems.forEach(item => item.style.transition = 'none');
        gsap.from(projectItems, {
            scrollTrigger: {
                trigger: '.projects-showcase',
                start: 'top 85%',
                toggleActions: 'play none none none'
            },
            opacity: 0,
            y: 40,
            scale: 0.97,
            duration: 0.8,
            stagger: 0.15,
            ease: "power3.out",
            onComplete: () => {
                projectItems.forEach(item => item.style.transition = '');
            }
        });
    }

    // 3. Animation d'entrée de la Timeline (CV / Parcours)
    const timelineItems = document.querySelectorAll('.timeline-item');
    if (timelineItems.length > 0) {
        timelineItems.forEach(item => {
            item.style.transition = 'none';
            gsap.from(item, {
                scrollTrigger: {
                    trigger: item,
                    start: 'top 90%',
                    toggleActions: 'play none none none'
                },
                opacity: 0,
                x: -30,
                duration: 0.6,
                ease: "power2.out",
                onComplete: () => {
                    item.style.transition = '';
                }
            });
        });
    }

    // 4. Animation des titres de page et de section
    const revealTitles = document.querySelectorAll('.page-title, .intro-header h3');
    revealTitles.forEach(title => {
        gsap.from(title, {
            scrollTrigger: {
                trigger: title,
                start: 'top 90%',
                toggleActions: 'play none none none'
            },
            opacity: 0,
            y: 20,
            duration: 0.5,
            ease: "power1.out"
        });
    });

    // 5. Parallaxe ScrollTrigger sur le conteneur visuel du bras 3D (Hero de la page d'accueil)
    const heroVisual = document.querySelector('.hero-visual');
    if (heroVisual) {
        gsap.to(heroVisual, {
            scrollTrigger: {
                trigger: '.hero',
                start: 'top top',
                end: 'bottom top',
                scrub: true
            },
            y: 100,
            opacity: 0.15,
            scale: 0.92,
            ease: "none"
        });
    }

    // 6. Accordéon de la Chronologie (Page resume)
    const toggleButtons = document.querySelectorAll('.btn-timeline-toggle');
    if (toggleButtons.length > 0) {
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const item = this.closest('.timeline-item');
                const details = item.querySelector('.timeline-details');
                const icon = this.querySelector('.toggle-icon');
                const isExpanded = item.classList.contains('is-expanded');

                if (isExpanded) {
                    item.classList.remove('is-expanded');
                    gsap.to(details, {
                        height: 0,
                        opacity: 0,
                        duration: 0.35,
                        ease: "power2.inOut",
                        onComplete: () => {
                            if (window.ScrollTrigger) window.ScrollTrigger.refresh();
                        }
                    });
                    gsap.to(icon, {
                        rotation: 0,
                        duration: 0.3
                    });
                } else {
                    item.classList.add('is-expanded');
                    gsap.to(details, {
                        height: "auto",
                        opacity: 1,
                        duration: 0.45,
                        ease: "power2.out",
                        onComplete: () => {
                            if (window.ScrollTrigger) window.ScrollTrigger.refresh();
                        }
                    });
                    gsap.to(icon, {
                        rotation: 180,
                        duration: 0.3
                    });
                }
            });
        });
    }
}
