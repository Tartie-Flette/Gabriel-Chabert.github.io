import { initAnimations } from "./modules/animations.js";
import { initRobot3D } from "./modules/robot3d.js";

// Initialisation globale de l'application
const startApp = () => {
    // 1. Initialiser les Animations de Scroll et Hover (GSAP ScrollTrigger)
    initAnimations();

    // 2. Initialiser la Scène 3D Interactive (Three.js) dans le Hero
    initRobot3D();
};

// Éviter le piège de la condition de course si le DOM est déjà prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
