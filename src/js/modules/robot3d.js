// La bibliothèque Three.js est chargée via une balise script CDN globale dans le HTML.
(function() {
    const THREE = window.THREE;

    const initRobot3D = () => {
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
        let currentPreset = 'terracotta';
        let sliderBase, sliderShoulder, sliderElbow;
        let valBase, valShoulder, valElbow;
        
        // Sillage/Trail
        let trailLine;
        const maxTrailPoints = 60;
        const trailPoints = [];

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
                width = (parent && parent.clientWidth > 0) ? parent.clientWidth : window.innerWidth * 0.4;
                height = (parent && parent.clientHeight > 0) ? parent.clientHeight : 400;
            }

            // Caméra Perspective
            camera = new THREE.PerspectiveCamera(
                42, 
                width / height, 
                0.1, 
                100
            );
            camera.position.set(3.5, 2.5, 5); // Caméra reculée pour bien voir le robot
            
            // Cible caméra centrée sur le bras robotique
            camera.lookAt(0, 1.2, 0);

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
            
            // Utiliser un ResizeObserver pour gérer le redimensionnement de manière robuste et réactive
            if ('ResizeObserver' in window) {
                const resizeObserver = new ResizeObserver((entries) => {
                    for (let entry of entries) {
                        const w = entry.contentRect.width || container.clientWidth;
                        const h = entry.contentRect.height || container.clientHeight;
                        if (w > 0 && h > 0) {
                            camera.aspect = w / h;
                            camera.updateProjectionMatrix();
                            renderer.setSize(w, h);
                            
                            // Cible caméra centrée sur le bras robotique
                            camera.lookAt(0, 1.2, 0);
                            renderer.render(scene, camera);
                        }
                    }
                });
                resizeObserver.observe(container);
            } else {
                window.addEventListener('resize', onWindowResize);
            }

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

        function buildRobot() {
            const isDark = document.documentElement.classList.contains('dark-mode');
            
            let metalColor = isDark ? 0xFF5A36 : 0xC84B31;
            let glowColor = isDark ? 0xFF9E80 : 0xE27D60;
            let metalMatColor = isDark ? 0x24242B : 0xDDD9CF;
            let metalMatRoughness = 0.35;
            let metalMatMetalness = 0.95;

            if (currentPreset === 'steel') {
                // Preset Acier : Noyau bleu électrique et structure en chrome poli ultra-brillant
                metalColor = 0x00E5FF;
                glowColor = 0x80DEEA;
                metalMatColor = isDark ? 0x78909C : 0xECEFF1;
                metalMatRoughness = 0.08;
                metalMatMetalness = 1.0;
            } else if (currentPreset === 'carbon') {
                // Preset Carbone : Noyau jaune/orange rétro-éclairé et structure en carbone mat foncé
                metalColor = 0xFF9100;
                glowColor = 0xFFD54F;
                metalMatColor = isDark ? 0x141416 : 0x3E3E42;
                metalMatRoughness = 0.75;
                metalMatMetalness = 0.35;
            }

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
                color: metalMatColor,
                roughness: metalMatRoughness,
                metalness: metalMatMetalness
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

            // Collerettes métalliques de renfort (frettes mécaniques) aux extrémités du segment 1
            const collar1Geom = new THREE.CylinderGeometry(0.125, 0.125, 0.06, 24);
            const collar1Bottom = new THREE.Mesh(collar1Geom, metalMat);
            collar1Bottom.position.y = 0.06;
            arm1Group.add(collar1Bottom);
            
            const collar1Top = new THREE.Mesh(collar1Geom, metalMat);
            collar1Top.position.y = 1.34;
            arm1Group.add(collar1Top);

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

            // Collerettes métalliques de renfort aux extrémités du segment 2
            const collar2Geom = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 24);
            const collar2Bottom = new THREE.Mesh(collar2Geom, metalMat);
            collar2Bottom.position.y = 0.05;
            arm2Group.add(collar2Bottom);
            
            const collar2Top = new THREE.Mesh(collar2Geom, metalMat);
            collar2Top.position.y = 1.15;
            arm2Group.add(collar2Top);

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

            // Petit pointeur technique central (buse d'impression / télémètre)
            const nozzleGeom = new THREE.CylinderGeometry(0.025, 0.01, 0.14, 16);
            const nozzle = new THREE.Mesh(nozzleGeom, metalMat);
            nozzle.position.y = 0.07;
            toolGroup.add(nozzle);
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

            // 3. Créer le sillage dynamique (Proposition S)
            trailPoints.length = 0;
            let trailColor = isDark ? 0xFF5A36 : 0xC84B31;
            if (currentPreset === 'steel') {
                trailColor = 0x00B0FF;
            } else if (currentPreset === 'carbon') {
                trailColor = 0xFFB300;
            }

            const trailGeom = new THREE.BufferGeometry();
            const trailPositions = new Float32Array(maxTrailPoints * 3);
            trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
            const trailMaterial = new THREE.LineBasicMaterial({
                color: trailColor,
                transparent: true,
                opacity: 0.85,
                linewidth: 2
            });
            trailLine = new THREE.Line(trailGeom, trailMaterial);
            scene.add(trailLine);
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
            
            // Nouveau design : structure modulaire de télémétrie
            hudElement.innerHTML = `
                <div class="hud-header">
                    <span class="hud-status-dot"></span>
                    <span class="hud-title">TELEMETRY // ACTIVE</span>
                </div>
                <div class="hud-val-container">
                    <div class="hud-coord-card">
                        <span class="hud-axis">X</span>
                        <span class="hud-val" id="hud-x">0.00</span>
                        <span class="hud-unit">m</span>
                    </div>
                    <div class="hud-coord-card">
                        <span class="hud-axis">Y</span>
                        <span class="hud-val" id="hud-y">0.00</span>
                        <span class="hud-unit">m</span>
                    </div>
                    <div class="hud-coord-card">
                        <span class="hud-axis">Z</span>
                        <span class="hud-val" id="hud-z">0.00</span>
                        <span class="hud-unit">m</span>
                    </div>
                </div>
            `;
            container.parentElement.insertBefore(hudElement, container);
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
            const modeSelector = container.parentElement.querySelector('.mode-selector');
            const btnAuto = document.getElementById('btn-mode-auto');
            const btnTrajectory = document.getElementById('btn-mode-trajectory');
            const btnManual = document.getElementById('btn-mode-manual');
            const slidersContainer = container.parentElement.querySelector('.robot-sliders');
            
            sliderBase = document.getElementById('slider-base');
            sliderShoulder = document.getElementById('slider-shoulder');
            sliderElbow = document.getElementById('slider-elbow');
            
            valBase = document.getElementById('val-base');
            valShoulder = document.getElementById('val-shoulder');
            valElbow = document.getElementById('val-elbow');

            if (!modeSelector || !btnAuto || !btnManual || !slidersContainer) return;

            const setMode = (mode) => {
                btnAuto.classList.remove('active');
                if (btnTrajectory) btnTrajectory.classList.remove('active');
                btnManual.classList.remove('active');
                
                modeSelector.classList.remove('is-auto', 'is-trajectory', 'is-manual');
                
                if (mode === 'manual') {
                    controlMode = 'manual';
                    btnManual.classList.add('active');
                    modeSelector.classList.add('is-manual');
                    slidersContainer.style.display = 'flex';
                    updateManualTargets();
                } else if (mode === 'trajectory') {
                    controlMode = 'trajectory';
                    if (btnTrajectory) btnTrajectory.classList.add('active');
                    modeSelector.classList.add('is-trajectory');
                    slidersContainer.style.display = 'none';
                } else {
                    controlMode = 'auto';
                    btnAuto.classList.add('active');
                    modeSelector.classList.add('is-auto');
                    slidersContainer.style.display = 'none';
                }
            };

            btnAuto.addEventListener('click', () => setMode('auto'));
            if (btnTrajectory) btnTrajectory.addEventListener('click', () => setMode('trajectory'));
            btnManual.addEventListener('click', () => setMode('manual'));

            const onSliderInput = () => {
                if (controlMode === 'manual') {
                    updateManualTargets();
                }
            };

            if (sliderBase) sliderBase.addEventListener('input', onSliderInput);
            if (sliderShoulder) sliderShoulder.addEventListener('input', onSliderInput);
            if (sliderElbow) sliderElbow.addEventListener('input', onSliderInput);

            // Presets de matériaux (Proposition P)
            const presetBtns = container.parentElement.querySelectorAll('.preset-btn');
            presetBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const preset = btn.getAttribute('data-preset');
                    if (preset === currentPreset) return;
                    currentPreset = preset;
                    presetBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Reconstruire le robot avec les nouvelles couleurs
                    scene.clear();
                    buildRobot();
                    buildGrids();
                    setupLights();
                    createHUD();
                    renderer.render(scene, camera);
                });
            });
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
            const w = container.clientWidth || rect.width || window.innerWidth * 0.4;
            const h = container.clientHeight || rect.height || 400;

            const mouseX = ((event.clientX - rect.left) / w) * 2 - 1;
            const mouseY = -((event.clientY - rect.top) / h) * 2 + 1;

            // Inversion des angles de suivi pour un comportement direct et intuitif
            target.baseRotY = -mouseX * Math.PI * 0.45;
            target.shoulderRotZ = -0.2 - (mouseY * Math.PI * 0.15);
            target.elbowRotZ = 0.5 - (mouseY * Math.PI * 0.25);
        }

        function onWindowResize() {
            if (!container || !renderer) return;

            let w = container.clientWidth;
            let h = container.clientHeight;

            if (w === 0 || h === 0) {
                const parent = container.parentElement;
                w = (parent && parent.clientWidth > 0) ? parent.clientWidth : window.innerWidth * 0.4;
                h = (parent && parent.clientHeight > 0) ? parent.clientHeight : 400;
            }

            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            
            // Cible caméra centrée sur le bras robotique
            camera.lookAt(0, 1.2, 0);
        }

        // Boucle d'animation fiabilisée
        function animate() {
            if (!isVisible) {
                isLooping = false;
                return;
            }
            animationFrameId = requestAnimationFrame(animate);

            // 1. Respiration harmonique lente (Idle) ou calcul de trajectoire (Proposition S)
            const time = Date.now() * 0.001;

            if (controlMode === 'trajectory') {
                target.baseRotY = Math.sin(time * 0.8) * 0.7;
                target.shoulderRotZ = -0.15 + Math.cos(time * 1.2) * 0.18;
                target.elbowRotZ = 0.4 + Math.sin(time * 1.6) * 0.25;
            }

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

                // Mettre à jour le HUD textuel avec la nouvelle structure HTML
                if (hudElement) {
                    const hudX = hudElement.querySelector('#hud-x');
                    const hudY = hudElement.querySelector('#hud-y');
                    const hudZ = hudElement.querySelector('#hud-z');
                    if (hudX && hudY && hudZ) {
                        hudX.textContent = toolWorldPos.x.toFixed(2);
                        hudY.textContent = toolWorldPos.y.toFixed(2);
                        hudZ.textContent = toolWorldPos.z.toFixed(2);
                    } else {
                        createHUD();
                    }
                }
            }

            // 3. Mettre à jour la traînée lumineuse (trail) (Proposition S)
            if (trailLine) {
                const toolWorldPos = new THREE.Vector3();
                if (toolGroup) {
                    toolGroup.getWorldPosition(toolWorldPos);
                }
                
                if (controlMode === 'trajectory') {
                    trailLine.visible = true;
                    trailPoints.push(toolWorldPos.clone());
                    if (trailPoints.length > maxTrailPoints) {
                        trailPoints.shift();
                    }
                } else {
                    if (trailPoints.length > 0) {
                        trailPoints.shift();
                    } else {
                        trailLine.visible = false;
                    }
                }

                const positionAttr = trailLine.geometry.attributes.position;
                for (let i = 0; i < maxTrailPoints; i++) {
                    const pt = trailPoints[i] || (trailPoints[0] || toolWorldPos);
                    positionAttr.setXYZ(i, pt.x, pt.y, pt.z);
                }
                positionAttr.needsUpdate = true;
            }

            // On effectue toujours le rendu de la scène pour éviter tout écran vide
            renderer.render(scene, camera);
        }

        // Démarrer
        init();
    };

    window.initRobot3D = initRobot3D;
})();
