// La bibliothèque Three.js est chargée via une balise script CDN globale dans le HTML.
const THREE = window.THREE;

export function initRobot3D() {
    if (!THREE) {
        console.warn("Three.js n'est pas chargé. La simulation 3D du bras robotique est désactivée.");
        return;
    }

    const container = document.getElementById('robot-canvas-container');
    if (!container) return;

    let scene, camera, renderer;
    let baseGroup, arm1Group, arm2Group;
    let gridHelper, polarHelper;
    let animationFrameId;
    let isHeroVisible = true; // Flag d'intersection pour suspendre le rendu hors écran

    // Cibles d'angles pour l'interpolation fluide (lerping)
    const target = {
        baseRotY: 0,
        shoulderRotZ: -0.2,
        elbowRotZ: 0.5,
        mouseX: 0,
        mouseY: 0
    };

    // États courants pour le lerping
    const current = {
        baseRotY: 0,
        shoulderRotZ: -0.2,
        elbowRotZ: 0.5
    };

    // 1. Initialiser la Scène, la Caméra et le Rendu
    function init() {
        scene = new THREE.Scene();

        // Récupérer les dimensions du conteneur avec un repli robuste sur le parent
        let width = container.clientWidth;
        let height = container.clientHeight;

        if (width === 0 || height === 0) {
            const parent = container.parentElement;
            width = parent ? parent.clientWidth : window.innerWidth * 0.4;
            height = parent ? parent.clientHeight : 400;
        }

        // Caméra Perspective
        camera = new THREE.PerspectiveCamera(
            45, 
            width / height, 
            0.1, 
            100
        );
        camera.position.set(3.5, 2.5, 5); // Caméra reculée pour bien voir le robot
        camera.lookAt(0, 1.2, 0); // Vise le centre de gravité du bras robotique

        // Rendu WebGL avec canal alpha (transparence)
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Vider le conteneur pour éviter les doublons de canvas
        container.innerHTML = '';
        container.appendChild(renderer.domElement);

        // 2. Créer le Bras Robotique (Modélisation par primitives)
        buildRobot();

        // 3. Ajouter les grilles techniques (Aide visuelle type CAD)
        buildGrids();

        // 4. Configurer les lumières
        setupLights();

        // Rendu initial immédiat de sécurité
        renderer.render(scene, camera);

        // 5. Configurer les écouteurs d'événements
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('mousemove', onMouseMove);

        // Démarrer la boucle d'animation
        animate();

        // Activer la détection d'intersection pour économiser le GPU
        setupPerformanceOptimization();
    }

    // Modélisation géométrique hiérarchique du bras articulé
    function buildRobot() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        const metalColor = isDark ? 0xFF5A36 : 0xC84B31;

        // Matériau solide semi-transparent
        const solidMat = new THREE.MeshStandardMaterial({
            color: metalColor,
            roughness: 0.4,
            metalness: 0.8,
            transparent: true,
            opacity: 0.85
        });

        // Matériau fil de fer (Wireframe) pour l'effet technologique
        const wireMat = new THREE.MeshBasicMaterial({
            color: isDark ? 0xFFB380 : 0xE8A87C,
            wireframe: true,
            transparent: true,
            opacity: 0.25
        });

        // --- HIERARCHIE DU BRAS ---
        
        // 1. Socle (Base)
        const baseGeom = new THREE.CylinderGeometry(0.8, 0.9, 0.3, 32);
        const baseMesh = new THREE.Mesh(baseGeom, solidMat);
        const baseWire = new THREE.Mesh(baseGeom, wireMat);
        baseMesh.add(baseWire);
        baseMesh.position.y = 0.15;
        scene.add(baseMesh);

        // Groupe de rotation de la base (Pivot Y)
        baseGroup = new THREE.Group();
        baseGroup.position.y = 0.3; // Placé au-dessus du socle
        scene.add(baseGroup);

        // 2. Premier Segment (Bras inférieur)
        arm1Group = new THREE.Group();
        baseGroup.add(arm1Group);

        // Articulation de l'épaule
        const shoulderJointGeom = new THREE.SphereGeometry(0.25, 16, 16);
        const shoulderJoint = new THREE.Mesh(shoulderJointGeom, solidMat);
        arm1Group.add(shoulderJoint);

        // Corps du bras 1 (décalé vers le haut pour pivoter par rapport à l'épaule)
        const segment1Geom = new THREE.CylinderGeometry(0.12, 0.15, 1.4, 16);
        const segment1 = new THREE.Mesh(segment1Geom, solidMat);
        const segment1Wire = new THREE.Mesh(segment1Geom, wireMat);
        segment1.add(segment1Wire);
        segment1.position.y = 0.7; // Mi-hauteur
        arm1Group.add(segment1);

        // 3. Deuxième Segment (Bras supérieur)
        arm2Group = new THREE.Group();
        arm2Group.position.y = 1.4; // Placé au bout du bras 1
        arm1Group.add(arm2Group);

        // Articulation du coude
        const elbowJointGeom = new THREE.SphereGeometry(0.2, 16, 16);
        const elbowJoint = new THREE.Mesh(elbowJointGeom, solidMat);
        arm2Group.add(elbowJoint);

        // Corps du bras 2 (décalé pour pivoter par rapport au coude)
        const segment2Geom = new THREE.CylinderGeometry(0.08, 0.12, 1.2, 16);
        const segment2 = new THREE.Mesh(segment2Geom, solidMat);
        const segment2Wire = new THREE.Mesh(segment2Geom, wireMat);
        segment2.add(segment2Wire);
        segment2.position.y = 0.6;
        arm2Group.add(segment2);

        // 4. Outil Terminal (Pince / Capteur)
        const toolGroup = new THREE.Group();
        toolGroup.position.y = 1.2;
        arm2Group.add(toolGroup);

        const wristGeom = new THREE.SphereGeometry(0.12, 16, 16);
        const wrist = new THREE.Mesh(wristGeom, solidMat);
        toolGroup.add(wrist);

        // Effecteur en anneau lumineux
        const effectorGeom = new THREE.TorusGeometry(0.16, 0.04, 8, 24);
        const effectorMat = new THREE.MeshBasicMaterial({
            color: isDark ? 0xFF9E80 : 0xE27D60,
            transparent: true,
            opacity: 0.9
        });
        const effector = new THREE.Mesh(effectorGeom, effectorMat);
        effector.rotation.x = Math.PI / 2;
        effector.position.y = 0.15;
        toolGroup.add(effector);
    }

    function buildGrids() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        const gridColor = isDark ? 0x2D2D35 : 0xEAE5D9;

        // Grille plane cartésienne
        gridHelper = new THREE.GridHelper(8, 20, 0xC84B31, gridColor);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        // Grille polaire représentant l'enveloppe de travail
        polarHelper = new THREE.PolarGridHelper(3.5, 8, 8, 64, gridColor, gridColor);
        polarHelper.position.y = 0.01;
        scene.add(polarHelper);
    }

    function setupLights() {
        const ambient = new THREE.AmbientLight(0xFFFFFF, 0.4);
        scene.add(ambient);

        // Lumière principale (Terracotta chaude)
        const dirLight = new THREE.DirectionalLight(0xFFF1EB, 1.2);
        dirLight.position.set(5, 8, 5);
        scene.add(dirLight);

        // Lumière de remplissage technique (Cyan/bleue pour contraste)
        const fillLight = new THREE.DirectionalLight(0xD8F0FF, 0.6);
        fillLight.position.set(-5, 2, -5);
        scene.add(fillLight);
    }

    // Écouter les changements de thème pour mettre à jour les couleurs de la scène 3D
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            setTimeout(() => {
                scene.clear();
                buildRobot();
                buildGrids();
                setupLights();
                renderer.render(scene, camera);
            }, 80); // Petit délai pour laisser la classe CSS s'appliquer
        });
    }

    function onMouseMove(event) {
        const rect = container.getBoundingClientRect();
        const width = container.clientWidth || rect.width || window.innerWidth * 0.4;
        const height = container.clientHeight || rect.height || 400;

        const mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / height) * 2 + 1;

        target.baseRotY = mouseX * Math.PI * 0.4;
        target.shoulderRotZ = -0.2 + (mouseY * Math.PI * 0.15);
        target.elbowRotZ = 0.5 + (mouseY * Math.PI * 0.25);
    }

    function onWindowResize() {
        if (!container || !renderer) return;

        let width = container.clientWidth;
        let height = container.clientHeight;

        if (width === 0 || height === 0) {
            const parent = container.parentElement;
            width = parent ? parent.clientWidth : window.innerWidth * 0.4;
            height = parent ? parent.clientHeight : 400;
        }

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // Boucle d'animation fiabilisée
    function animate() {
        animationFrameId = requestAnimationFrame(animate);

        // Interpolation linéaire (lerp) pour un mouvement fluide
        const lerpFactor = 0.08;
        current.baseRotY += (target.baseRotY - current.baseRotY) * lerpFactor;
        current.shoulderRotZ += (target.shoulderRotZ - current.shoulderRotZ) * lerpFactor;
        current.elbowRotZ += (target.elbowRotZ - current.elbowRotZ) * lerpFactor;

        // Appliquer les rotations au squelette du robot
        if (baseGroup) baseGroup.rotation.y = current.baseRotY;
        if (arm1Group) arm1Group.rotation.z = current.shoulderRotZ;
        if (arm2Group) arm2Group.rotation.z = current.elbowRotZ;

        // Faire osciller doucement la grille polaire
        const time = Date.now() * 0.001;
        if (polarHelper) {
            polarHelper.rotation.y = time * 0.02;
        }

        // On effectue toujours le rendu de la scène pour éviter tout écran vide
        renderer.render(scene, camera);
    }

    // Optimisation : suspendre le rendu lorsque la section Hero sort de l'écran
    function setupPerformanceOptimization() {
        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                isHeroVisible = entry.isIntersecting;
            });
        }, { threshold: 0.05 });

        const heroSection = document.querySelector('.hero');
        if (heroSection) {
            observer.observe(heroSection);
        }
    }

    // Démarrer
    init();
}
