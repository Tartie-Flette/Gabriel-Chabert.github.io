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
            ease: "power2.out"
        });
    }

    // 2. Animation d'entrée des Projets (Page Projets)
    const projectItems = document.querySelectorAll('.project-item');
    if (projectItems.length > 0) {
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
            ease: "power3.out"
        });
    }

    // 3. Animation d'entrée de la Timeline (CV / Parcours)
    const timelineItems = document.querySelectorAll('.timeline-item');
    if (timelineItems.length > 0) {
        timelineItems.forEach(item => {
            gsap.from(item, {
                scrollTrigger: {
                    trigger: item,
                    start: 'top 90%',
                    toggleActions: 'play none none none'
                },
                opacity: 0,
                x: -30,
                duration: 0.6,
                ease: "power2.out"
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
}
