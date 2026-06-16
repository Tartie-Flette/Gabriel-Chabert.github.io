/**
 * abs-simulation.js - Simulateur Physique d'Asservissement de Freinage ABS
 * Modélisation d'un quart de véhicule avec adhésion pneu-route dynamique.
 */

(function() {
    // Structure de données de simulation
    let simData = {
        time: [],
        vVehicle: [],
        vWheel: [],
        slip: [],
        torque: [],
        distance: [],
        activeABS: []
    };

    let animationFrameId = null;
    let isRunning = false;
    
    // Paramètres physiques par défaut
    const m = 350;        // Masse quart-de-véhicule (kg)
    const g = 9.81;       // Gravité (m/s^2)
    const R = 0.3;        // Rayon de la roue (m)
    const J = 1.2;        // Inertie de la roue (kg*m^2)
    const v0 = 27.78;     // Vitesse initiale (100 km/h en m/s)
    const dt = 0.002;     // Pas de temps simulation (2 ms)
    const simMaxTime = 4.0; // Durée max (s)

    // Variables d'état courantes de la simulation physique
    let state = {
        v: v0,
        vw: v0,
        s: 0, // distance parcourue
        t: 0, // temps écoulé
        integralError: 0,
        prevError: 0
    };

    // Configuration utilisateur
    let config = {
        road: 'dry',       // 'dry', 'wet', 'ice'
        controller: 'pi',  // 'none', 'bangbang', 'pi'
        kp: 4000,
        ki: 1500,
        kd: 80
    };

    // Références DOM
    let canvas = null;
    let ctx = null;
    let animCanvas = null;
    let animCtx = null;

    // Récupérer le coefficient d'adhérence pneu-route selon le glissement (Modèle simplifié de Pacejka)
    function getMu(slip, roadCondition) {
        let muMax = 0.9;
        let muSlide = 0.6;

        if (roadCondition === 'wet') {
            muMax = 0.55;
            muSlide = 0.35;
        } else if (roadCondition === 'ice') {
            muMax = 0.15;
            muSlide = 0.07;
        }

        // Pic d'adhérence à slip = 0.18
        if (slip < 0.18) {
            let t = slip / 0.18;
            return muMax * (2 * t - t * t); // Courbe quadratique montante
        } else {
            let t = (slip - 0.18) / 0.82;
            return muMax - (muMax - muSlide) * t; // Chute linéaire vers le glissement bloqué
        }
    }

    // Initialiser les écouteurs de contrôles dans l'interface utilisateur
    const initSimulatorControls = () => {
        canvas = document.getElementById('abs-chart');
        if (!canvas) return;
        ctx = canvas.getContext('2d');

        animCanvas = document.getElementById('abs-animation');
        if (animCanvas) animCtx = animCanvas.getContext('2d');

        // Sélecteurs
        const roadSelect = document.getElementById('sim-road');
        const ctrlSelect = document.getElementById('sim-controller');
        const kpSlider = document.getElementById('sim-kp');
        const kiSlider = document.getElementById('sim-ki');
        const kdSlider = document.getElementById('sim-kd');
        const kpVal = document.getElementById('sim-kp-val');
        const kiVal = document.getElementById('sim-ki-val');
        const kdVal = document.getElementById('sim-kd-val');
        const piParams = document.getElementById('pi-params');
        const startBtn = document.getElementById('btn-run-sim');

        if (roadSelect) {
            roadSelect.value = config.road;
            roadSelect.addEventListener('change', (e) => {
                config.road = e.target.value;
                resetSimulation();
            });
        }

        if (ctrlSelect) {
            ctrlSelect.value = config.controller;
            ctrlSelect.addEventListener('change', (e) => {
                config.controller = e.target.value;
                if (config.controller === 'pi') {
                    if (piParams) piParams.style.display = 'block';
                } else {
                    if (piParams) piParams.style.display = 'none';
                }
                resetSimulation();
            });
        }

        if (kpSlider && kpVal) {
            kpSlider.value = config.kp;
            kpVal.textContent = config.kp;
            kpSlider.addEventListener('input', (e) => {
                config.kp = parseInt(e.target.value);
                kpVal.textContent = config.kp;
            });
        }

        if (kiSlider && kiVal) {
            kiSlider.value = config.ki;
            kiVal.textContent = config.ki;
            kiSlider.addEventListener('input', (e) => {
                config.ki = parseInt(e.target.value);
                kiVal.textContent = config.ki;
            });
        }

        if (kdSlider && kdVal) {
            kdSlider.value = config.kd;
            kdVal.textContent = config.kd;
            kdSlider.addEventListener('input', (e) => {
                config.kd = parseInt(e.target.value);
                kdVal.textContent = config.kd;
            });
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (isRunning) {
                    stopSimulation();
                } else {
                    runFullSimulation();
                }
            });
        }

        // Écouteur de changement de thème global pour rafraîchir les graphiques
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            // Remplacer l'ancien écouteur pour éviter les doublons
            themeToggle.removeEventListener('click', handleThemeClick);
            themeToggle.addEventListener('click', handleThemeClick);
        }

        resetSimulation();
    };

    function handleThemeClick() {
        setTimeout(() => {
            drawChart();
            if (!isRunning) {
                drawWheelAnimation(0, 0, false);
            }
        }, 50);
    }

    // Arrêter l'animation et réinitialiser l'état
    const resetSimulation = () => {
        stopSimulation();
        state.v = v0;
        state.vw = v0;
        state.s = 0;
        state.t = 0;
        state.integralError = 0;
        state.prevError = 0;

        simData = {
            time: [],
            vVehicle: [],
            vWheel: [],
            slip: [],
            torque: [],
            distance: [],
            activeABS: []
        };

        // Remplir avec les données initiales
        simData.time.push(0);
        simData.vVehicle.push(v0);
        simData.vWheel.push(v0);
        simData.slip.push(0);
        simData.torque.push(0);
        simData.distance.push(0);
        simData.activeABS.push(0);

        updateStats(0, 0, 0);
        drawChart();
        drawWheelAnimation(0, 0, false);
    };

    const stopSimulation = () => {
        isRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        const startBtn = document.getElementById('btn-run-sim');
        if (startBtn) {
            startBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Lancer la Simulation';
            startBtn.classList.remove('running');
        }
    };

    // Lance le calcul dynamique pas à pas avec animation fluide
    const runFullSimulation = () => {
        resetSimulation();
        isRunning = true;
        
        const startBtn = document.getElementById('btn-run-sim');
        if (startBtn) {
            startBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Arrêter';
            startBtn.classList.add('running');
        }

        const loop = (now) => {
            if (!isRunning) return;

            // Simuler en temps réel accéléré (on calcule plusieurs pas de physique par frame d'affichage)
            const stepsPerFrame = 5; 
            for (let i = 0; i < stepsPerFrame; i++) {
                if (state.v <= 0.05) {
                    state.v = 0;
                    state.vw = 0;
                    stopSimulation();
                    updateStats(state.s, state.t, getAverageDecel(state.v, state.t));
                    drawChart();
                    drawWheelAnimation(0, 0, false);
                    return;
                }
                
                physicsStep();
            }

            drawChart();
            
            // Calculer la vitesse angulaire réelle pour animer la roue
            let angularVelocity = state.vw / R;
            let slipRatio = (state.v - state.vw) / Math.max(state.v, 0.01);
            let absActive = (config.controller !== 'none' && Math.abs(state.v - state.vw) > 0.1 && (simData.torque[simData.torque.length - 1] < 1200));

            drawWheelAnimation(angularVelocity, slipRatio, absActive);
            updateStats(state.s, state.t, getAverageDecel(state.v, state.t));

            animationFrameId = requestAnimationFrame(loop);
        };

        animationFrameId = requestAnimationFrame(loop);
    };

    // Un pas d'intégration d'Euler de la physique
    function physicsStep() {
        let v = state.v;
        let vw = state.vw;

        // 1. Calcul du taux de glissement (slip ratio)
        let slip = (v - vw) / Math.max(v, 0.01);
        slip = Math.max(0, Math.min(1, slip)); // Saturation entre 0 et 1

        // 2. Récupérer l'adhérence du pneu
        let mu = getMu(slip, config.road);

        // 3. Calcul du couple de freinage demandé par le contrôleur (ABS)
        let Tb = 0;
        let maxTb = 1300; // Couple max applicable (N.m)
        let absActive = 0;

        if (config.controller === 'none') {
            // Pas d'ABS : Couple maximum appliqué instantanément
            Tb = maxTb;
        } else if (config.controller === 'bangbang') {
            // Régulation Bang-Bang (Seuil de glissement à 18%)
            if (slip > 0.18) {
                Tb = 0; // On relâche la pression pour ré-adhérer
                absActive = 1;
            } else {
                Tb = maxTb; // On freine à fond
            }
        } else if (config.controller === 'pi') {
            // Correcteur PID discret pour réguler le glissement
            let targetSlip = 0.18;
            let error = slip - targetSlip; // Correction de signe : erreur positive = glissement trop grand
            
            // Intégrale de l'erreur avec anti-windup
            state.integralError += error * dt;
            state.integralError = Math.max(-0.5, Math.min(0.5, state.integralError));

            // Dérivée de l'erreur
            let derivative = (error - state.prevError) / dt;
            state.prevError = error;

            // Calcul de la commande PID
            let P = config.kp * error;
            let I = config.ki * state.integralError;
            let D = config.kd * derivative;

            let controlOutput = P + I + D;

            // Commande : si le glissement est trop élevé (error > 0),
            // controlOutput est positif, ce qui REDUIT le couple de freinage.
            Tb = maxTb - controlOutput; 
            Tb = Math.max(0, Math.min(maxTb, Tb)); // Saturation physique

            if (slip > 0.12 && Tb < maxTb * 0.9) {
                absActive = 1;
            }
        }

        // 4. Forces physiques
        let Fb = mu * m * g; // Force de freinage longitudinale (N)

        // 5. Équations différentielles (Dynamique quart-de-véhicule)
        let vDot = -Fb / m;

        // Vitesse linéaire de la roue : vw_dot = R * omega_dot = (Fb * R - Tb) * R / J
        let vwDot = (Fb * R - Tb) * R / J;

        // 6. Intégration d'Euler numérique
        state.v += vDot * dt;
        state.vw += vwDot * dt;
        state.t += dt;
        state.s += state.v * dt;

        // Protections physiques
        if (state.v < 0.01) {
            state.v = 0;
            state.vw = 0;
        }
        if (state.vw < 0) {
            state.vw = 0;
        }
        if (state.vw > state.v) {
            state.vw = state.v; // La roue ne peut pas tourner plus vite que la voiture
        }

        // Enregistrer les données
        simData.time.push(state.t);
        simData.vVehicle.push(state.v);
        simData.vWheel.push(state.vw);
        simData.slip.push(slip);
        simData.torque.push(Tb);
        simData.distance.push(state.s);
        simData.activeABS.push(absActive);
    }

    // Calculer la décélération moyenne globale
    function getAverageDecel(finalV, t) {
        if (t <= 0) return 0;
        return (v0 - finalV) / t;
    }

    // Mettre à jour l'affichage des métriques
    function updateStats(dist, time, decel) {
        const distEl = document.getElementById('sim-stat-dist');
        const timeEl = document.getElementById('sim-stat-time');
        const decelEl = document.getElementById('sim-stat-decel');

        if (distEl) distEl.textContent = dist.toFixed(1) + ' m';
        if (timeEl) timeEl.textContent = time.toFixed(2) + ' s';
        if (decelEl) decelEl.textContent = (decel / 9.81).toFixed(2) + ' G';
    }

    // Dessine le graphique temps-réel (Vitesse véhicule et roue)
    function drawChart() {
        if (!canvas || !ctx) return;

        // Détecter le mode sombre pour adapter le style
        const isDark = document.documentElement.classList.contains('dark-mode');
        const colorGrid = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(17, 17, 17, 0.08)';
        const colorText = isDark ? '#a0a0a0' : '#4a4a4a';
        const colorBg = isDark ? '#141418' : '#fcfcfc';

        // Redimensionner dynamiquement le canvas selon son conteneur parent
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const w = rect.width;
        const h = rect.height;
        const padding = { top: 25, right: 20, bottom: 35, left: 45 };

        // Effacer le fond
        ctx.fillStyle = colorBg;
        ctx.fillRect(0, 0, w, h);

        // Dessiner la grille
        const xTicks = 5;
        const yTicks = 4;
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = colorGrid;
        ctx.fillStyle = colorText;
        ctx.font = '10px "Outfit", system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Axe Y (Vitesse 0 à 100 km/h)
        for (let i = 0; i <= yTicks; i++) {
            let valKmh = (yTicks - i) * 25; // 100, 75, 50, 25, 0 km/h
            let y = padding.top + (i / yTicks) * (h - padding.top - padding.bottom);
            
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            ctx.fillText(valKmh + ' km/h', padding.left - 8, y);
        }

        // Axe X (Temps 0 à 4 s)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= xTicks; i++) {
            let val = i * 0.8; // Echelle max 4 s
            let x = padding.left + (i / xTicks) * (w - padding.left - padding.right);

            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, h - padding.bottom);
            ctx.stroke();

            ctx.fillText(val.toFixed(1) + ' s', x, h - padding.bottom + 8);
        }

        // Si pas de données, s'arrêter là
        if (simData.time.length === 0) return;

        // Echelle Y : vMax = 27.78 m/s (100 km/h)
        const vMax = 27.78;
        const getX = (t) => padding.left + (t / simMaxTime) * (w - padding.left - padding.right);
        const getY = (v) => padding.top + (1 - v / vMax) * (h - padding.top - padding.bottom);

        // Dessiner la courbe de vitesse véhicule (Terracotta)
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#C84B31';
        ctx.beginPath();
        ctx.moveTo(getX(simData.time[0]), getY(simData.vVehicle[0]));
        for (let i = 1; i < simData.time.length; i++) {
            ctx.lineTo(getX(simData.time[i]), getY(simData.vVehicle[i]));
        }
        ctx.stroke();

        // Dessiner la courbe de vitesse roue (Vert turquoise / Menthe)
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#2a9d8f';
        ctx.beginPath();
        ctx.moveTo(getX(simData.time[0]), getY(simData.vWheel[0]));
        for (let i = 1; i < simData.time.length; i++) {
            ctx.lineTo(getX(simData.time[i]), getY(simData.vWheel[i]));
        }
        ctx.stroke();

        // Dessiner la courbe de Glissement en arrière-plan (Orange, échelle 0-1)
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isDark ? 'rgba(232, 168, 124, 0.45)' : 'rgba(232, 168, 124, 0.6)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        const getYSlip = (s) => padding.top + (1 - s) * (h - padding.top - padding.bottom);
        ctx.moveTo(getX(simData.time[0]), getYSlip(simData.slip[0]));
        for (let i = 1; i < simData.time.length; i++) {
            ctx.lineTo(getX(simData.time[i]), getYSlip(simData.slip[i]));
        }
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Légende en haut à droite
        ctx.font = '10px "Outfit", sans-serif';
        ctx.textAlign = 'left';
        
        // Vitesse Véhicule
        ctx.fillStyle = '#C84B31';
        ctx.fillRect(w - 230, padding.top - 15, 12, 6);
        ctx.fillStyle = colorText;
        ctx.fillText('Vitesse Véhicule', w - 212, padding.top - 13);

        // Vitesse Roue
        ctx.fillStyle = '#2a9d8f';
        ctx.fillRect(w - 135, padding.top - 15, 12, 6);
        ctx.fillStyle = colorText;
        ctx.fillText('Vitesse Roue', w - 117, padding.top - 13);

        // Taux de glissement (pointillés)
        ctx.strokeStyle = isDark ? 'rgba(232, 168, 124, 0.7)' : 'rgba(232, 168, 124, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(w - 55, padding.top - 12);
        ctx.lineTo(w - 43, padding.top - 12);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colorText;
        ctx.fillText('Glissement', w - 38, padding.top - 13);
    }

    // Variable d'angle de rotation cumulative pour le dessin de la roue
    let wheelAngle = 0;

    // Dessine la roue animée et les étincelles/fumée selon le glissement
    function drawWheelAnimation(angularVelocity, slip, absActive) {
        if (!animCanvas || !animCtx) return;

        const w = animCanvas.width;
        const h = animCanvas.height;
        const cx = w / 2;
        const cy = h / 2 - 10;
        const r = 55; // rayon visuel

        // Incrémenter l'angle de rotation de la roue selon la vitesse angulaire réelle
        wheelAngle += angularVelocity * 0.05; // facteur visuel

        animCtx.clearRect(0, 0, w, h);

        const isDark = document.documentElement.classList.contains('dark-mode');
        const colorText = isDark ? '#a0a0a0' : '#4a4a4a';

        // 1. Dessiner le sol
        animCtx.strokeStyle = isDark ? '#444' : '#ccc';
        animCtx.lineWidth = 3;
        animCtx.beginPath();
        animCtx.moveTo(10, cy + r);
        animCtx.lineTo(w - 10, cy + r);
        animCtx.stroke();

        // Trace de pneus si glissement élevé (freinage brusque)
        if (slip > 0.35) {
            animCtx.fillStyle = 'rgba(17, 17, 17, 0.75)';
            animCtx.fillRect(cx - 30, cy + r - 1, 60, 3);
        }

        // Effets visuels de blocage (fumée / étincelles)
        if (slip > 0.4) {
            animCtx.fillStyle = isDark ? 'rgba(255, 90, 54, 0.3)' : 'rgba(170, 170, 170, 0.4)';
            for (let i = 0; i < 6; i++) {
                let pSize = Math.random() * 8 + 3;
                let px = cx - r + Math.random() * 20 - 15;
                let py = cy + r - Math.random() * 15;
                animCtx.beginPath();
                animCtx.arc(px, py, pSize, 0, Math.PI * 2);
                animCtx.fill();
            }
        }

        // 2. Dessiner le pneu (cercle extérieur épais)
        animCtx.strokeStyle = isDark ? '#2b2b2b' : '#333333';
        animCtx.lineWidth = 14;
        animCtx.beginPath();
        animCtx.arc(cx, cy, r - 7, 0, Math.PI * 2);
        animCtx.stroke();

        // 3. Dessiner la jante métallique
        animCtx.fillStyle = isDark ? '#555555' : '#cccccc';
        animCtx.beginPath();
        animCtx.arc(cx, cy, r - 14, 0, Math.PI * 2);
        animCtx.fill();

        // Rayons de la jante (qui tournent !)
        animCtx.save();
        animCtx.translate(cx, cy);
        animCtx.rotate(wheelAngle);
        animCtx.strokeStyle = isDark ? '#888' : '#777';
        animCtx.lineWidth = 4;
        for (let i = 0; i < 5; i++) {
            animCtx.rotate((2 * Math.PI) / 5);
            animCtx.beginPath();
            animCtx.moveTo(0, 0);
            animCtx.lineTo(0, r - 14);
            animCtx.stroke();
        }
        animCtx.restore();

        // 4. Écrou central
        animCtx.fillStyle = '#C84B31';
        animCtx.beginPath();
        animCtx.arc(cx, cy, 6, 0, Math.PI * 2);
        animCtx.fill();

        // 5. Étrier de frein (fixe, ne tourne pas)
        animCtx.save();
        animCtx.translate(cx, cy);
        animCtx.rotate(-Math.PI / 4);
        
        if (absActive) {
            let pulse = Math.sin(performance.now() * 0.04) > 0;
            animCtx.fillStyle = pulse ? '#ff3b30' : '#8e8e93';
        } else {
            animCtx.fillStyle = (config.controller !== 'none' && state.v > 0) ? '#ff3b30' : '#8e8e93';
        }

        animCtx.beginPath();
        animCtx.arc(0, 0, r - 10, -0.4, 0.4);
        animCtx.lineTo(r - 18, 0.4);
        animCtx.arc(0, 0, r - 18, 0.4, -0.4, true);
        animCtx.closePath();
        animCtx.fill();
        animCtx.restore();

        // 6. Indicateur textuel d'état
        animCtx.fillStyle = colorText;
        animCtx.font = 'bold 11px "Outfit", sans-serif';
        animCtx.textAlign = 'center';
        
        if (state.v <= 0) {
            animCtx.fillStyle = '#2d6a4f';
            animCtx.fillText('ARRÊT COMPLET', cx, cy - r - 12);
        } else if (slip > 0.8) {
            animCtx.fillStyle = '#b7094c';
            animCtx.fillText('ROUE BLOQUÉE !', cx, cy - r - 12);
        } else if (absActive) {
            animCtx.fillStyle = '#ff8800';
            animCtx.fillText('RÉGULATION ABS ACTIVE', cx, cy - r - 12);
        } else {
            animCtx.fillText('FREINAGE STANDARD', cx, cy - r - 12);
        }
    }

    // Exposer l'initialisation au chargement global
    window.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('abs-chart')) {
            initSimulatorControls();
        }
    });

    // Raccourcis globaux pour le modal
    window.openSimulation = () => {
        const modal = document.getElementById('abs-modal');
        if (modal) {
            modal.classList.add('active');
            setTimeout(() => {
                initSimulatorControls();
                resetSimulation();
            }, 100);
        }
    };

    window.closeSimulation = () => {
        const modal = document.getElementById('abs-modal');
        if (modal) {
            modal.classList.remove('active');
            stopSimulation();
        }
    };

    // Fermer le modal en cliquant en dehors
    window.addEventListener('click', (event) => {
        const absModal = document.getElementById('abs-modal');
        if (event.target === absModal) {
            window.closeSimulation();
        }
    });
})();
