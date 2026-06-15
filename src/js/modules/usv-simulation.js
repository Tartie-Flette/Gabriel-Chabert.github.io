/**
 * usv-simulation.js - Simulateur de Télémétrie USV BlueBoat & Buffers Asynchrones
 * Modélise la liaison réseau série-ethernet et démontre l'utilité d'une FIFO circulaire.
 */

(function() {
    let telemetryInterval = null;
    let isRunning = false;
    let logCount = 0;
    
    // Variables de simulation
    let simState = {
        bufferLoad: 0,
        latency: 20,
        lossRate: 0,
        heading: 185.3,
        speed: 4.3,
        battery: 12.6
    };

    // Configuration utilisateur
    let config = {
        network: 'good', // 'good', 'jitter', 'congested'
        fifo: 'enabled'  // 'enabled', 'disabled'
    };

    // Références DOM
    let terminal = null;
    let startBtn = null;
    let bufferBar = null;
    let statBuffer = null;
    let statLatency = null;
    let statLoss = null;
    let netSelect = null;
    let fifoSelect = null;

    const initUSVSimulator = () => {
        terminal = document.getElementById('usv-terminal');
        startBtn = document.getElementById('btn-run-usv');
        bufferBar = document.getElementById('buffer-bar');
        statBuffer = document.getElementById('usv-stat-buffer');
        statLatency = document.getElementById('usv-stat-latency');
        statLoss = document.getElementById('usv-stat-loss');
        netSelect = document.getElementById('usv-network');
        fifoSelect = document.getElementById('usv-fifo');

        if (!startBtn) return;

        // Configuration listeners
        if (netSelect) {
            netSelect.value = config.network;
            netSelect.addEventListener('change', (e) => {
                config.network = e.target.value;
                addLog('system', `[SYSTEM] État réseau modifié : ${netSelect.options[netSelect.selectedIndex].text}`);
            });
        }

        if (fifoSelect) {
            fifoSelect.value = config.fifo;
            fifoSelect.addEventListener('change', (e) => {
                config.fifo = e.target.value;
                addLog('system', `[SYSTEM] Buffer circulaire : ${config.fifo === 'enabled' ? 'ACTIVÉ' : 'DESACTIVÉ'}`);
            });
        }

        startBtn.addEventListener('click', () => {
            if (isRunning) {
                stopTelemetry();
            } else {
                startTelemetry();
            }
        });

        resetSimState();
    };

    const resetSimState = () => {
        simState.bufferLoad = 0;
        simState.latency = 20;
        simState.lossRate = 0;
        simState.heading = 185.3;
        simState.speed = 4.3;
        simState.battery = 12.6;
        logCount = 0;

        if (terminal) {
            terminal.innerHTML = '[SYSTEM] Console prête. Cliquez sur "Lancer la télémétrie"...';
        }
        updateStats();
    };

    const startTelemetry = () => {
        resetSimState();
        isRunning = true;
        
        if (startBtn) {
            startBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Arrêter';
            startBtn.classList.add('running');
        }

        addLog('system', '[SYSTEM] Connexion réseau établie avec l\'USV BlueBoat...');
        addLog('system', '[SYSTEM] En écoute sur le port 5005 (TCP Serie-to-Ethernet)...');

        // Lancer la boucle asynchrone (Simulation de réception de phrases NMEA 0183)
        telemetryInterval = setInterval(generateTelemetryPacket, 250);
    };

    const stopTelemetry = () => {
        isRunning = false;
        if (telemetryInterval) {
            clearInterval(telemetryInterval);
            telemetryInterval = null;
        }

        if (startBtn) {
            startBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Lancer la télémétrie';
            startBtn.classList.remove('running');
        }

        addLog('system', '[SYSTEM] Télémétrie arrêtée par l\'opérateur.');
    };

    // Génère des phrases NMEA de navigation réalistes et simule l'impact réseau/buffer
    const generateTelemetryPacket = () => {
        if (!isRunning) return;

        // Faire varier légèrement les paramètres physiques
        simState.heading += (Math.random() * 0.4 - 0.2);
        if (simState.heading > 360) simState.heading -= 360;
        if (simState.heading < 0) simState.heading += 360;
        
        simState.speed += (Math.random() * 0.1 - 0.05);
        simState.speed = Math.max(2.0, Math.min(6.5, simState.speed));

        simState.battery -= 0.001; // Légère décharge
        if (simState.battery < 11.5) simState.battery = 12.6;

        const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
        const nmeaSentence = `$GPRMC,${timestamp}.00,A,4307.3821,N,00555.2018,E,${simState.speed.toFixed(1)},${simState.heading.toFixed(1)},150626,,,A*${Math.floor(Math.random() * 80 + 10)}`;

        logCount++;

        // Simulation de la couche de transport (Réseau + FIFO)
        if (config.network === 'good') {
            simState.lossRate = 0;
            simState.latency = Math.floor(Math.random() * 10 + 15); // 15-25ms
            
            if (config.fifo === 'enabled') {
                simState.bufferLoad = Math.max(0, Math.floor(Math.random() * 4)); // 0-3%
                addLog('info', `[INFO] [FIFO_FIFO] Packet #${logCount} pushed and pop immediately.`);
            } else {
                simState.bufferLoad = 0;
                addLog('info', `[INFO] [DIRECT] Packet #${logCount} processed directly.`);
            }
            addLog('nmea', `   Telemetry: ${nmeaSentence}`);
        }
        else if (config.network === 'jitter') {
            // Gigue importante : retards aléatoires
            const jitterChance = Math.random();
            
            if (config.fifo === 'enabled') {
                simState.lossRate = 0;
                // Le buffer amortit, mais la latence augmente lors des bursts
                if (jitterChance > 0.7) {
                    simState.bufferLoad = Math.min(100, simState.bufferLoad + Math.floor(Math.random() * 15 + 10));
                    simState.latency = Math.floor(simState.bufferLoad * 4 + 30);
                    addLog('warning', `[WARN] [FIFO_QUEUE] Jitter burst detected. Queuing frame #${logCount}. FIFO Load: ${simState.bufferLoad}%`);
                } else {
                    simState.bufferLoad = Math.max(0, simState.bufferLoad - Math.floor(Math.random() * 8));
                    simState.latency = Math.floor(simState.bufferLoad * 4 + 30);
                    addLog('info', `[INFO] [FIFO_POP] Processed queued frame #${logCount}. FIFO Load: ${simState.bufferLoad}%`);
                    addLog('nmea', `   Telemetry (buffered): ${nmeaSentence}`);
                }
            } else {
                // Sans buffer, la gigue provoque des collisions et des rejets directs de paquets
                simState.bufferLoad = 0;
                if (jitterChance > 0.7) {
                    simState.lossRate = Math.min(15, simState.lossRate + 2);
                    simState.latency = Math.floor(Math.random() * 200 + 150);
                    addLog('error', `[ERROR] [NMEA_PARSER] Packet #${logCount} arrived out-of-order. CRC check failed, discarding!`);
                } else {
                    simState.latency = Math.floor(Math.random() * 100 + 40);
                    addLog('warning', `[WARN] [DIRECT] Packet #${logCount} processed with delay.`);
                    addLog('nmea', `   Telemetry: ${nmeaSentence}`);
                }
            }
        }
        else if (config.network === 'congested') {
            // Congestion sévère : perte de paquets élevée sans FIFO
            const congestionChance = Math.random();
            
            if (config.fifo === 'enabled') {
                simState.lossRate = 0; // Pas de perte de trames grâce à la FIFO !
                // Le buffer se remplit fortement car les threads du récepteur TCP se heurtent à la lenteur d'IHM
                simState.bufferLoad = Math.min(100, simState.bufferLoad + Math.floor(Math.random() * 8 + 3));
                simState.latency = Math.floor(simState.bufferLoad * 6 + 100);
                
                if (simState.bufferLoad > 80) {
                    addLog('warning', `[WARN] [FIFO_CRITICAL] Buffer near saturation! Load: ${simState.bufferLoad}%, Latency: ${simState.latency}ms`);
                } else {
                    addLog('info', `[INFO] [FIFO_LOAD] Network congested. Buffering active. FIFO Load: ${simState.bufferLoad}%`);
                }
                if (congestionChance > 0.3) {
                    addLog('nmea', `   Telemetry (delayed): ${nmeaSentence}`);
                }
            } else {
                // Sans buffer, la liaison TCP/IP sature et rejette 30-50% des paquets en continu
                simState.bufferLoad = 0;
                simState.latency = Math.floor(Math.random() * 800 + 600);
                
                if (congestionChance > 0.5) {
                    simState.lossRate = Math.min(50, simState.lossRate + 5);
                    addLog('error', `[ERROR] [SOCKET_OVERFLOW] TCP/IP frame buffer full. Connection dropped on packet #${logCount}!`);
                } else {
                    addLog('warning', `[WARN] [STALE_DATA] Frame #${logCount} delayed. Telemetry lag > ${simState.latency}ms`);
                    addLog('nmea', `   Telemetry (stale): ${nmeaSentence}`);
                }
            }
        }

        updateStats();
    };

    const addLog = (type, message) => {
        if (!terminal) return;

        let cssClass = 'log-info';
        if (type === 'error') cssClass = 'log-error';
        if (type === 'warning') cssClass = 'log-warning';
        if (type === 'system') cssClass = 'log-system';

        const line = document.createElement('div');
        line.className = cssClass;
        line.textContent = message;
        terminal.appendChild(line);

        // Limiter le nombre de lignes dans le terminal pour éviter de saturer la RAM
        if (terminal.childNodes.length > 50) {
            terminal.removeChild(terminal.firstChild);
        }

        // Défiler automatiquement vers le bas
        terminal.scrollTop = terminal.scrollHeight;
    };

    const updateStats = () => {
        // Mettre à jour les indicateurs du DOM
        if (statBuffer) statBuffer.textContent = simState.bufferLoad + '%';
        if (statLatency) statLatency.textContent = simState.latency + ' ms';
        if (statLoss) statLoss.textContent = simState.lossRate.toFixed(0) + '%';

        if (bufferBar) {
            bufferBar.style.width = simState.bufferLoad + '%';
            if (simState.bufferLoad > 80) {
                bufferBar.style.backgroundColor = '#ff5f56'; // Rouge
            } else if (simState.bufferLoad > 50) {
                bufferBar.style.backgroundColor = '#ffbd2e'; // Orange
            } else {
                bufferBar.style.backgroundColor = 'var(--accent-color)'; // Terracotta
            }
        }
    };

    // Exposer les fonctions de cycle de vie du modal à la fenêtre globale
    window.openUSVConsoleCallback = () => {
        initUSVSimulator();
        resetSimState();
    };

    window.closeUSVConsoleCallback = () => {
        stopTelemetry();
    };

    // Chargement automatique au démarrage s'il y a le conteneur usv
    window.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('usv-terminal')) {
            initUSVSimulator();
        }
    });
})();
