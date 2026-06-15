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
    let baseGroup, arm1Group, arm2Group, toolGroup;
    let polarHelper;
    let projectionLine, targetRing;
    let toolLight;
    let hudElement;
    let animationFrameId;
    let isVisible = false;
    let isLooping = false;
    
    // Contrôle manuel
    let controlMode = 'auto';
    let sliderBase, sliderShoulder, sliderElbow;
    let valBase, valShoulder, valElbow;

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
            42, 
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

        // 5. Créer l'affichage de coordonnées HUD dynamique
        createHUD();

        // Rendu initial immédiat de sécurité
        renderer.render(scene, camera);

        // 6. Configurer les écouteurs d'événements
        setupManualControls();
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('mousemove', onMouseMove);

        // Démarrer la boucle d'animation uniquement si le conteneur est visible (performance idle)
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    isVisible = entry.isIntersecting;
                    if (isVisible && !isLooping) {
                        isLooping = true;
                        animate();
                    } else if (!isVisible) {
                        isLooping = false;
                        if (animationFrameId) {
                            cancelAnimationFrame(animationFrameId);
                            animationFrameId = null;
                        }
                    }
                });
            }, { threshold: 0.05 });
            observer.observe(container);
        } else {
            isVisible = true;
            isLooping = true;
            animate();
        }
    }

    // Modélisation géométrique hiérarchique du bras articulé
    function buildRobot() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        const metalColor = isDark ? 0xFF5A36 : 0xC84B31;
        const glowColor = isDark ? 0xFF9E80 : 0xE27D60;

        // 1. Matériaux haut de gamme
        // Résine de verre satiné (Glassmorphic)
        const glassMat = new THREE.MeshPhysicalMaterial({
            color: isDark ? 0xFFFFFF : 0xFDFBF7,
            roughness: 0.15,
            metalness: 0.1,
            transmission: 0.65, // Transparence du verre
            thickness: 0.8,     // Épaisseur de la réfraction
            transparent: true,
            opacity: 0.9,
            clearcoat: 1.0,
            clearcoatRoughness: 0.15
        });

        // Structure métallique interne / Articulations
        const metalMat = new THREE.MeshStandardMaterial({
            color: isDark ? 0x24242B : 0xDDD9CF,
            roughness: 0.35,
            metalness: 0.95
        });

        // Noyau d'énergie émissif (Terracotta lumineuse)
        const glowMat = new THREE.MeshStandardMaterial({
            color: metalColor,
            emissive: glowColor,
            emissiveIntensity: isDark ? 1.5 : 0.8,
            roughness: 0.2,
            metalness: 0.5
        });

        // --- HIERARCHIE DU BRAS ---
        
        // 1. Socle (Base métallique robuste)
        const baseGeom = new THREE.CylinderGeometry(0.8, 0.9, 0.3, 32);
        const baseMesh = new THREE.Mesh(baseGeom, metalMat);
        baseMesh.position.y = 0.15;
        scene.add(baseMesh);

        // Groupe de rotation de la base (Pivot Y)
        baseGroup = new THREE.Group();
        baseGroup.position.y = 0.3; // Placé au-dessus du socle
        scene.add(baseGroup);

        // 2. Premier Segment (Bras inférieur)
        arm1Group = new THREE.Group();
        baseGroup.add(arm1Group);

        // Articulation de l'épaule (Rotule métallique)
        const shoulderJointGeom = new THREE.SphereGeometry(0.24, 24, 24);
        const shoulderJoint = new THREE.Mesh(shoulderJointGeom, metalMat);
        arm1Group.add(shoulderJoint);

        // Corps du bras 1 (Double couche : Noyau émissif interne + Tube en verre extérieur)
        const inner1Geom = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 16);
        const inner1Mesh = new THREE.Mesh(inner1Geom, glowMat);
        inner1Mesh.position.y = 0.7;
        arm1Group.add(inner1Mesh);

        const outer1Geom = new THREE.CylinderGeometry(0.12, 0.12, 1.35, 24);
        const outer1Mesh = new THREE.Mesh(outer1Geom, glassMat);
        outer1Mesh.position.y = 0.7;
        arm1Group.add(outer1Mesh);

        // 3. Deuxième Segment (Bras supérieur)
        arm2Group = new THREE.Group();
        arm2Group.position.y = 1.4; // Placé au bout du bras 1
        arm1Group.add(arm2Group);

        // Articulation du coude (Rotule métallique)
        const elbowJointGeom = new THREE.SphereGeometry(0.19, 24, 24);
        const elbowJoint = new THREE.Mesh(elbowJointGeom, metalMat);
        arm2Group.add(elbowJoint);

        // Corps du bras 2 (Double couche : Noyau émissif + Verre)
        const inner2Geom = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 16);
        const inner2Mesh = new THREE.Mesh(inner2Geom, glowMat);
        inner2Mesh.position.y = 0.6;
        arm2Group.add(inner2Mesh);

        const outer2Geom = new THREE.CylinderGeometry(0.08, 0.08, 1.15, 24);
        const outer2Mesh = new THREE.Mesh(outer2Geom, glassMat);
        outer2Mesh.position.y = 0.6;
        arm2Group.add(outer2Mesh);

        // 4. Outil Terminal (Wrist & Pince / Capteur)
        toolGroup = new THREE.Group();
        toolGroup.position.y = 1.2;
        arm2Group.add(toolGroup);

        const wristGeom = new THREE.SphereGeometry(0.1, 24, 24);
        const wrist = new THREE.Mesh(wristGeom, metalMat);
        toolGroup.add(wrist);

        // Effecteur en anneau lumineux
        const effectorGeom = new THREE.TorusGeometry(0.14, 0.03, 12, 32);
        const effectorMat = new THREE.MeshBasicMaterial({
            color: glowColor,
            transparent: true,
            opacity: 0.95
        });
        const effector = new THREE.Mesh(effectorGeom, effectorMat);
        effector.rotation.x = Math.PI / 2;
        effector.position.y = 0.12;
        toolGroup.add(effector);
    }

    function buildGrids() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        const radarColor = isDark ? 0x1F1F26 : 0xEAE5D9;
        const accentColor = isDark ? 0xFF5A36 : 0xC84B31;

        // Grille polaire représentant l'enveloppe de travail (radar épuré)
        polarHelper = new THREE.PolarGridHelper(3.5, 8, 6, 64, radarColor, radarColor);
        polarHelper.position.y = 0.005;
        scene.add(polarHelper);

        // Ligne de projection verticale pointillés (télémètre laser)
        const lineMaterial = new THREE.LineDashedMaterial({
            color: accentColor,
            dashSize: 0.08,
            gapSize: 0.08,
            transparent: true,
            opacity: 0.5
        });
        const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
        projectionLine = new THREE.Line(lineGeom, lineMaterial);
        projectionLine.computeLineDistances();
        scene.add(projectionLine);

        // Anneau cible au sol
        const targetGeom = new THREE.RingGeometry(0.06, 0.08, 32);
        const targetMat = new THREE.MeshBasicMaterial({
            color: accentColor,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        targetRing = new THREE.Mesh(targetGeom, targetMat);
        targetRing.rotation.x = Math.PI / 2;
        targetRing.position.y = 0.01;
        scene.add(targetRing);
    }

    function setupLights() {
        const ambient = new THREE.AmbientLight(0xFFFFFF, 0.45);
        scene.add(ambient);

        // Lumière principale (Terracotta chaude)
        const dirLight = new THREE.DirectionalLight(0xFFF1EB, 1.3);
        dirLight.position.set(5, 8, 5);
        scene.add(dirLight);

        // Lumière de remplissage technique (Cyan/bleue pour contraste de reflets)
        const fillLight = new THREE.DirectionalLight(0xD8F0FF, 0.6);
        fillLight.position.set(-5, 2, -5);
        scene.add(fillLight);

        // PointLight au niveau de l'effecteur (glow local interactif)
        const isDark = document.documentElement.classList.contains('dark-mode');
        toolLight = new THREE.PointLight(isDark ? 0xFF5A36 : 0xC84B31, 1.8, 3.5);
        scene.add(toolLight);
    }

    function createHUD() {
        // Supprimer l'ancien HUD s'il existe pour éviter la duplication
        const oldHud = container.parentElement.querySelector('.robot-hud-coords');
        if (oldHud) oldHud.remove();

        hudElement = document.createElement('div');
        hudElement.className = 'robot-hud-coords';
        
        // Appliquer un style minimaliste correspondant au Design System
        Object.assign(hudElement.style, {
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            fontFamily: '"Space Grotesk", monospace',
            fontSize: '0.75rem',
            letterSpacing: '1px',
            color: 'var(--accent-color)',
            backgroundColor: 'rgba(var(--bg-rgb), 0.75)',
            border: 'var(--border-width) solid var(--border-color)',
            padding: '6px 12px',
            borderRadius: 'var(--border-radius-sm)',
            pointerEvents: 'none',
            zIndex: '5',
            transition: 'background-color var(--transition-normal), border-color var(--transition-normal), color var(--transition-normal)'
        });
        
        hudElement.innerHTML = 'COORD // X: 0.00 | Y: 0.00 | Z: 0.00';
        container.parentElement.appendChild(hudElement);
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
                createHUD();
                renderer.render(scene, camera);
            }, 80); // Petit délai pour laisser la classe CSS s'appliquer
        });
    }

    function setupManualControls() {
        const modeBtn = document.getElementById('btn-robot-mode');
        const slidersContainer = container.parentElement.querySelector('.robot-sliders');
        
        sliderBase = document.getElementById('slider-base');
        sliderShoulder = document.getElementById('slider-shoulder');
        sliderElbow = document.getElementById('slider-elbow');
        
        valBase = document.getElementById('val-base');
        valShoulder = document.getElementById('val-shoulder');
        valElbow = document.getElementById('val-elbow');

        if (!modeBtn || !slidersContainer) return;

        modeBtn.addEventListener('click', () => {
            if (controlMode === 'auto') {
                controlMode = 'manual';
                modeBtn.innerHTML = '<span>Mode : Manuel</span>';
                modeBtn.style.background = 'var(--accent-color)';
                modeBtn.style.color = '#FFFFFF';
                slidersContainer.style.display = 'flex';
                updateManualTargets();
            } else {
                controlMode = 'auto';
                modeBtn.innerHTML = '<span>Mode : Auto</span>';
                modeBtn.style.background = 'var(--accent-glow)';
                modeBtn.style.color = 'var(--text-main)';
                slidersContainer.style.display = 'none';
            }
        });

        const onSliderInput = () => {
            if (controlMode === 'manual') {
                updateManualTargets();
            }
        };

        if (sliderBase) sliderBase.addEventListener('input', onSliderInput);
        if (sliderShoulder) sliderShoulder.addEventListener('input', onSliderInput);
        if (sliderElbow) sliderElbow.addEventListener('input', onSliderInput);
    }

    function updateManualTargets() {
        if (!sliderBase || !sliderShoulder || !sliderElbow) return;

        const degBase = parseFloat(sliderBase.value);
        const degShoulder = parseFloat(sliderShoulder.value);
        const degElbow = parseFloat(sliderElbow.value);

        if (valBase) valBase.textContent = degBase + '°';
        if (valShoulder) valShoulder.textContent = degShoulder + '°';
        if (valElbow) valElbow.textContent = degElbow + '°';

        target.baseRotY = degBase * Math.PI / 180;
        target.shoulderRotZ = degShoulder * Math.PI / 180;
        target.elbowRotZ = degElbow * Math.PI / 180;
    }

    function onMouseMove(event) {
        if (controlMode === 'manual') return;

        const rect = container.getBoundingClientRect();
        const width = container.clientWidth || rect.width || window.innerWidth * 0.4;
        const height = container.clientHeight || rect.height || 400;

        const mouseX = ((event.clientX - rect.left) / width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / height) * 2 + 1;

        // Inversion des angles de suivi pour un comportement direct et intuitif
        target.baseRotY = -mouseX * Math.PI * 0.45;
        target.shoulderRotZ = -0.2 - (mouseY * Math.PI * 0.15);
        target.elbowRotZ = 0.5 - (mouseY * Math.PI * 0.25);
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
        if (!isVisible) {
            isLooping = false;
            return;
        }
        animationFrameId = requestAnimationFrame(animate);

        // 1. Respiration harmonique lente (Idle)
        const time = Date.now() * 0.001;
        const idleSpeed = 1.2;
        const idleScale = 0.04;
        const idleX = Math.sin(time * idleSpeed) * idleScale;
        const idleY = Math.cos(time * idleSpeed * 0.85) * idleScale;

        // Combinaison des angles cible souris + respiration idle
        const finalTargetBaseRotY = target.baseRotY + (controlMode === 'auto' ? idleX : 0);
        const finalTargetShoulderRotZ = target.shoulderRotZ + (controlMode === 'auto' ? idleY : 0);
        const finalTargetElbowRotZ = target.elbowRotZ - (controlMode === 'auto' ? idleY * 0.5 : 0);

        // Interpolation linéaire (lerp) pour un mouvement fluide
        const lerpFactor = 0.08;
        current.baseRotY += (finalTargetBaseRotY - current.baseRotY) * lerpFactor;
        current.shoulderRotZ += (finalTargetShoulderRotZ - current.shoulderRotZ) * lerpFactor;
        current.elbowRotZ += (finalTargetElbowRotZ - current.elbowRotZ) * lerpFactor;

        // Appliquer les rotations au squelette du robot
        if (baseGroup) baseGroup.rotation.y = current.baseRotY;
        if (arm1Group) arm1Group.rotation.z = current.shoulderRotZ;
        if (arm2Group) arm2Group.rotation.z = current.elbowRotZ;

        // Faire pivoter lentement la grille radar
        if (polarHelper) {
            polarHelper.rotation.y = time * 0.015;
        }

        // 2. Mettre à jour la ligne de projection et le marqueur au sol
        if (toolGroup && projectionLine && targetRing) {
            const toolWorldPos = new THREE.Vector3();
            toolGroup.getWorldPosition(toolWorldPos);

            // Mettre à jour les segments de la ligne verticale [X, Y, Z] -> [X, 0, Z]
            const positionAttr = projectionLine.geometry.attributes.position;
            positionAttr.setXYZ(0, toolWorldPos.x, toolWorldPos.y, toolWorldPos.z);
            positionAttr.setXYZ(1, toolWorldPos.x, 0, toolWorldPos.z);
            positionAttr.needsUpdate = true;
            projectionLine.computeLineDistances();

            // Mettre à jour la cible au sol
            targetRing.position.set(toolWorldPos.x, 0.008, toolWorldPos.z);

            // Déplacer la lumière sur l'effecteur
            if (toolLight) {
                toolLight.position.set(toolWorldPos.x, toolWorldPos.y + 0.15, toolWorldPos.z);
            }

            // Mettre à jour le HUD textuel
            if (hudElement) {
                hudElement.innerHTML = `COORD // X: ${toolWorldPos.x.toFixed(2)} | Y: ${toolWorldPos.y.toFixed(2)} | Z: ${toolWorldPos.z.toFixed(2)}`;
            }
        }

        // On effectue toujours le rendu de la scène pour éviter tout écran vide
        renderer.render(scene, camera);
    }

    // Démarrer
    init();
}
