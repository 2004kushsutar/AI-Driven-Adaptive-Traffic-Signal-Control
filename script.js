// ================================================
// ENHANCED TRAFFIC SIGNAL SYSTEM - FRONTEND
// Predictive Snapshot Mode with Vehicle Type-Based Timing
// ================================================

document.addEventListener("DOMContentLoaded", () => {
  // ============================================
  // 1. CONFIGURATION
  // ============================================
  const CONFIG = {
    SOCKET_URL: `${window.location.protocol}//${window.location.hostname}:5000`,
    YELLOW_TIME: 3000,
    ALL_RED_TIME: 2000,
    CYCLE_ORDER: ["north", "east", "south", "west"],
    MAX_CAPACITY: 25,
    RECONNECT_INTERVAL: 3000,
    SNAPSHOT_BEFORE_END: 3000, // Take snapshot 3s before green ends
    EMERGENCY_GREEN_TIME: 30000, // 30s for emergency vehicles
    DEFAULT_FIRST_GREEN: 15000 // 15s default for first cycle
  };

  // ============================================
  // 2. STATE MANAGEMENT
  // ============================================
  const state = {
    realCarCounts: { north: 0, south: 0, east: 0, west: 0 },
    currentLights: { north: "red", south: "red", east: "red", west: "red" },
    phase: "initializing",
    currentCycleIndex: -1,
    cycleStartTime: Date.now(),
    phaseDuration: 0,
    cycleCount: 0,
    startTime: Date.now(),
    emergencyMode: false,
    emergencyDirection: null,
    totalCyclesCompleted: 0,
    snapshotTaken: false,
    nextDirectionCount: 0,
    nextDirectionGreenTime: 0, // Store calculated green time from backend
    waitingForSnapshot: false,
    isFirstCycle: true
  };

  // ============================================
  // 3. SOCKET CONNECTION
  // ============================================
  let socket;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;

  function connectSocket() {
    socket = io(CONFIG.SOCKET_URL, {
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionDelay: CONFIG.RECONNECT_INTERVAL,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS
    });

    socket.on("connect", () => {
      console.log("✅ Connected to Python CCTV System!");
      reconnectAttempts = 0;
      updateConnectionStatus(true);
      addLog("Connected to traffic control server", "success");
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", reason);
      updateConnectionStatus(false);
      addLog(`Disconnected: ${reason}`, "error");
    });

    socket.on("connect_error", (error) => {
      reconnectAttempts++;
      console.error("Connection Error:", error);
      updateConnectionStatus(false);

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        addLog("Failed to connect after multiple attempts. Check if server is running.", "error");
      } else {
        addLog(`Connection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`, "warning");
      }
    });

    socket.on("traffic_update", (data = {}) => {
      const safe = {
        north: Number(data.north || 0),
        south: Number(data.south || 0),
        east: Number(data.east || 0),
        west: Number(data.west || 0)
      };

      console.log("📸 Traffic Update:", safe);
      state.realCarCounts = safe;
      updateInterface();
      addLog(`Traffic update: N:${safe.north} S:${safe.south} E:${safe.east} W:${safe.west}`, "info");
    });

    socket.on("snapshot_result", (data) => {
      const direction = data.direction;
      const count = data.count;
      const greenTimeMs = data.green_time_ms || calculateSmartTime(count);
      
      console.log(`📸 Snapshot Result: ${direction} = ${count} vehicles, ${greenTimeMs/1000}s green time`);
      
      // Update the count and calculated green time for this direction
      state.realCarCounts[direction] = count;
      state.nextDirectionCount = count;
      state.nextDirectionGreenTime = greenTimeMs;
      state.waitingForSnapshot = false;
      
      updateInterface();
      addLog(`Snapshot complete: ${direction.toUpperCase()} has ${count} vehicles`, "success");
      addLog(`Calculated green time: ${(greenTimeMs/1000).toFixed(1)}s (vehicle type-based)`, "info");
    });
  }

  // ============================================
  // 4. DOM ELEMENTS
  // ============================================
  const elements = {
    lights: {
      north: document.querySelectorAll("#north-light .light"),
      south: document.querySelectorAll("#south-light .light"),
      east: document.querySelectorAll("#east-light .light"),
      west: document.querySelectorAll("#west-light .light")
    },
    sliders: {
      north: document.getElementById("north-slider"),
      south: document.getElementById("south-slider"),
      east: document.getElementById("east-slider"),
      west: document.getElementById("west-slider")
    },
    valueDisplays: {
      north: document.getElementById("north-value"),
      south: document.getElementById("south-value"),
      east: document.getElementById("east-value"),
      west: document.getElementById("west-value")
    },
    timerDisplays: {
      north: document.getElementById("north-timer"),
      south: document.getElementById("south-timer"),
      east: document.getElementById("east-timer"),
      west: document.getElementById("west-timer")
    },
    roadCountDisplays: {
      north: document.getElementById("north-road-count"),
      south: document.getElementById("south-road-count"),
      east: document.getElementById("east-road-count"),
      west: document.getElementById("west-road-count")
    },
    waitTimeDisplays: {
      north: document.getElementById("north-wait"),
      south: document.getElementById("south-wait"),
      east: document.getElementById("east-wait"),
      west: document.getElementById("west-wait")
    },
    connectionStatus: document.getElementById("connection-status"),
    currentPhase: document.getElementById("current-phase"),
    totalVehicles: document.getElementById("total-vehicles"),
    cycleCount: document.getElementById("cycle-count"),
    uptime: document.getElementById("uptime"),
    systemLogs: document.getElementById("system-logs")
  };

  // ============================================
  // 5. HELPER FUNCTIONS
  // ============================================
  function setLight(direction, color) {
    const nodeList = elements.lights[direction];
    if (!nodeList || nodeList.length === 0) return;

    nodeList.forEach((lightEl) => {
      const elColor = lightEl.dataset && lightEl.dataset.color
        ? lightEl.dataset.color
        : (lightEl.classList.contains("red") ? "red" :
           lightEl.classList.contains("yellow") ? "yellow" :
           lightEl.classList.contains("green") ? "green" : null);

      if (!elColor) {
        lightEl.classList.remove("active");
        return;
      }

      if (elColor === color) {
        lightEl.classList.add("active");
      } else {
        lightEl.classList.remove("active");
      }
    });

    state.currentLights[direction] = color;
  }

  function updateConnectionStatus(connected) {
    if (!elements.connectionStatus) return;
    if (connected) {
      elements.connectionStatus.classList.remove("disconnected");
      elements.connectionStatus.classList.add("connected");
      elements.connectionStatus.textContent = "Connected";
    } else {
      elements.connectionStatus.classList.remove("connected");
      elements.connectionStatus.classList.add("disconnected");
      elements.connectionStatus.textContent = "Disconnected";
    }
  }

  function updateInterface() {
    let totalVehicles = 0;

    for (const dir in state.realCarCounts) {
      const count = Number(state.realCarCounts[dir] || 0);
      totalVehicles += count;

      if (elements.valueDisplays[dir]) elements.valueDisplays[dir].textContent = count;
      if (elements.roadCountDisplays[dir]) elements.roadCountDisplays[dir].textContent = `${count} 🚗`;

      const slider = elements.sliders[dir];
      if (slider) {
        let percentage = (count / CONFIG.MAX_CAPACITY) * 100;
        if (percentage > 100) percentage = 100;
        slider.value = percentage;

        slider.classList.remove("low", "medium", "high");
        if (percentage < 33) {
          slider.classList.add("low");
        } else if (percentage < 66) {
          slider.classList.add("medium");
        } else {
          slider.classList.add("high");
        }
      }

      const waitTime = calculateSmartTime(count);
      if (elements.waitTimeDisplays[dir]) {
        elements.waitTimeDisplays[dir].textContent = `${Math.round(waitTime / 1000)}s`;
      }
    }

    if (elements.totalVehicles) elements.totalVehicles.textContent = totalVehicles;
    if (elements.cycleCount) elements.cycleCount.textContent = state.totalCyclesCompleted;
  }

  function calculateSmartTime(carCount) {
    // Fallback calculation if backend doesn't provide timing
    const STARTUP_TIME = 5000;
    const TIME_PER_CAR = 3000;

    let time = STARTUP_TIME + (carCount * TIME_PER_CAR);

    if (time < 10000) time = 10000;
    if (time > 60000) time = 60000;

    return time;
  }

  function showCountdown(directions, remainingMs) {
    const seconds = Math.ceil(remainingMs / 1000);

    for (const dir in elements.timerDisplays) {
      const el = elements.timerDisplays[dir];
      if (el) el.style.display = "none";
    }

    // Show countdown for active directions (green/yellow)
    directions.forEach((dir) => {
      const el = elements.timerDisplays[dir];
      if (!el) return;
      el.style.display = "block";
      el.textContent = seconds > 0 ? seconds : 0;
    });

    // Show countdown for next direction (red)
    const nextDir = getNextDirection();
    const nextEl = elements.timerDisplays[nextDir];
    if (nextEl) {
      let totalWaitSeconds = 0;
      
      if (state.phase === "green") {
        // During green: show remaining green + yellow + all red
        totalWaitSeconds = Math.ceil((remainingMs + CONFIG.YELLOW_TIME + CONFIG.ALL_RED_TIME) / 1000);
      } else if (state.phase === "yellow") {
        // During yellow: show remaining yellow + all red
        totalWaitSeconds = Math.ceil((remainingMs + CONFIG.ALL_RED_TIME) / 1000);
      } else if (state.phase === "red") {
        // During all-red: show remaining all red
        totalWaitSeconds = Math.ceil(remainingMs / 1000);
      }
      
      if (totalWaitSeconds > 0) {
        nextEl.style.display = "block";
        nextEl.textContent = totalWaitSeconds;
      }
    }
  }

  function getActiveDirections() {
    if (state.emergencyMode && state.emergencyDirection) {
      return [state.emergencyDirection];
    }
    if (state.currentCycleIndex === -1) {
      return ["north"];
    }
    return [CONFIG.CYCLE_ORDER[state.currentCycleIndex]];
  }

  function getNextDirection() {
    const nextIndex = (state.currentCycleIndex + 1) % CONFIG.CYCLE_ORDER.length;
    return CONFIG.CYCLE_ORDER[nextIndex];
  }

  function requestSnapshotForNextDirection() {
    if (state.waitingForSnapshot) return;
    
    const nextDir = getNextDirection();
    
    addLog(`🎯 Requesting predictive snapshot for ${nextDir.toUpperCase()}`, "info");
    
    state.waitingForSnapshot = true;
    
    // Send snapshot request to backend
    socket.emit('request_snapshot', { direction: nextDir });
  }

  function switchCycle() {
    state.currentCycleIndex = (state.currentCycleIndex + 1) % CONFIG.CYCLE_ORDER.length;

    if (state.currentCycleIndex === 0) {
      state.totalCyclesCompleted++;
      if (elements.cycleCount) elements.cycleCount.textContent = state.totalCyclesCompleted;
    }

    state.phase = "green";
    state.snapshotTaken = false;
    const activeDirs = getActiveDirections();
    const activeDir = activeDirs[0];

    let carCount;
    let greenTime;
    
    if (state.isFirstCycle) {
      // First cycle: use default time
      greenTime = CONFIG.DEFAULT_FIRST_GREEN;
      carCount = state.realCarCounts[activeDir] || 0;
      state.isFirstCycle = false;
      addLog(`First cycle: Using default ${CONFIG.DEFAULT_FIRST_GREEN/1000}s for ${activeDir.toUpperCase()}`, "info");
    } else if (state.emergencyMode) {
      // Emergency mode: use fixed time
      greenTime = CONFIG.EMERGENCY_GREEN_TIME;
      carCount = state.realCarCounts[activeDir] || 0;
      addLog(`Emergency mode: ${CONFIG.EMERGENCY_GREEN_TIME/1000}s for ${activeDir.toUpperCase()}`, "warning");
    } else {
      // Normal mode: use backend-calculated green time
      carCount = state.nextDirectionCount;
      greenTime = state.nextDirectionGreenTime || calculateSmartTime(carCount);
      addLog(`Using predictive count: ${carCount} vehicles for ${activeDir.toUpperCase()}`, "success");
      addLog(`Backend calculated green time: ${(greenTime/1000).toFixed(1)}s`, "info");
    }

    state.phaseDuration = greenTime;
    state.cycleStartTime = Date.now();

    if (elements.currentPhase) {
      elements.currentPhase.textContent = `${activeDir.toUpperCase()} - GREEN`;
      elements.currentPhase.className = "px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium";
    }

    addLog(`🟢 Green signal for ${activeDir.toUpperCase()} (${carCount} vehicles, ${Math.round(greenTime/1000)}s)`, "success");

    updateLights();
  }

  function updateLights() {
    const active = getActiveDirections();
    const allDirs = ["north", "south", "east", "west"];
    const inactive = allDirs.filter((d) => !active.includes(d));

    if (state.phase === "green") {
      active.forEach((d) => setLight(d, "green"));
      inactive.forEach((d) => setLight(d, "red"));
    } else if (state.phase === "yellow") {
      active.forEach((d) => setLight(d, "yellow"));
      inactive.forEach((d) => setLight(d, "red"));

      if (elements.currentPhase) {
        elements.currentPhase.textContent = `${active[0].toUpperCase()} - YELLOW`;
        elements.currentPhase.className = "px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium";
      }
    } else if (state.phase === "red") {
      allDirs.forEach((d) => setLight(d, "red"));

      if (elements.currentPhase) {
        elements.currentPhase.textContent = "ALL RED";
        elements.currentPhase.className = "px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium";
      }
    }
  }

  // ============================================
  // 6. MAIN LOOP
  // ============================================
  function mainLoop() {
    const now = Date.now();
    const elapsed = now - state.cycleStartTime;
    const activeDirs = getActiveDirections();

    // Check if we should take predictive snapshot
    if (state.phase === "green" && !state.snapshotTaken && !state.emergencyMode) {
      const timeUntilEnd = state.phaseDuration - elapsed;
      
      if (timeUntilEnd <= CONFIG.SNAPSHOT_BEFORE_END && timeUntilEnd > 0) {
        state.snapshotTaken = true;
        requestSnapshotForNextDirection();
      }
    }

    if (state.phase === "green" && elapsed >= state.phaseDuration) {
      state.phase = "yellow";
      state.phaseDuration = CONFIG.YELLOW_TIME;
      state.cycleStartTime = now;
      addLog(`🟡 Yellow signal for ${activeDirs[0].toUpperCase()}`, "warning");
      updateLights();
    } else if (state.phase === "yellow" && elapsed >= state.phaseDuration) {
      state.phase = "red";
      state.phaseDuration = CONFIG.ALL_RED_TIME;
      state.cycleStartTime = now;
      addLog(`🔴 All red clearance phase`, "info");
      updateLights();
    } else if (state.phase === "red" && elapsed >= state.phaseDuration) {
      if (state.emergencyMode) {
        state.emergencyMode = false;
        state.emergencyDirection = null;
        addLog("Emergency override completed", "success");
      }
      switchCycle();
    }

    const remaining = Math.max(0, state.phaseDuration - elapsed);
    showCountdown(activeDirs, remaining);

    updateUptime();

    requestAnimationFrame(mainLoop);
  }

  // ============================================
  // 7. STATISTICS & LOGGING
  // ============================================
  function updateUptime() {
    const elapsed = Date.now() - state.startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    if (elements.uptime) {
      elements.uptime.textContent =
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  function addLog(message, type = "info") {
    if (!elements.systemLogs) return;
    const logEntry = document.createElement("div");
    const timestamp = new Date().toLocaleTimeString();

    let colorClass = "text-gray-400";
    let icon = "ℹ️";

    switch(type) {
      case "success":
        colorClass = "text-green-400";
        icon = "✅";
        break;
      case "error":
        colorClass = "text-red-400";
        icon = "❌";
        break;
      case "warning":
        colorClass = "text-yellow-400";
        icon = "⚠️";
        break;
      case "info":
      default:
        colorClass = "text-blue-400";
        icon = "ℹ️";
        break;
    }

    logEntry.className = colorClass;
    logEntry.textContent = `[${timestamp}] ${icon} ${message}`;

    elements.systemLogs.appendChild(logEntry);
    elements.systemLogs.scrollTop = elements.systemLogs.scrollHeight;

    while (elements.systemLogs.children.length > 50) {
      elements.systemLogs.removeChild(elements.systemLogs.firstChild);
    }
  }

  // ============================================
  // 8. EMERGENCY CONTROLS
  // ============================================
  window.emergencyOverride = function(direction) {
    if (!["north", "south", "east", "west"].includes(direction)) {
      addLog("Invalid direction for emergency override", "error");
      return;
    }

    state.emergencyMode = true;
    state.emergencyDirection = direction;
    state.phase = "yellow";
    state.phaseDuration = CONFIG.YELLOW_TIME;
    state.cycleStartTime = Date.now();

    addLog(`🚨 EMERGENCY OVERRIDE: ${direction.toUpperCase()} direction`, "error");

    updateLights();
  };

  window.resetSystem = function() {
    if (confirm("Are you sure you want to reset the system?")) {
      state.emergencyMode = false;
      state.emergencyDirection = null;
      state.totalCyclesCompleted = 0;
      state.currentCycleIndex = -1;
      state.cycleCount = 0;
      state.snapshotTaken = false;
      state.isFirstCycle = true;

      addLog("System reset initiated", "warning");
      
      // Request initial snapshot for first direction
      setTimeout(() => {
        requestSnapshotForNextDirection();
        setTimeout(() => {
          switchCycle();
        }, 1000);
      }, 500);
    }
  };

  window.clearLogs = function() {
    if (!elements.systemLogs) return;
    elements.systemLogs.innerHTML = '<div class="text-green-400">[SYSTEM] Logs cleared</div>';
  };

  // ============================================
  // 9. INITIALIZATION
  // ============================================
  function initialize() {
    for (const dir in elements.sliders) {
      const s = elements.sliders[dir];
      if (s) s.disabled = true;
    }

    connectSocket();

    addLog("Initializing traffic control system...", "info");
    addLog("Mode: Predictive Snapshot with Vehicle Type-Based Timing", "success");
    
    setTimeout(() => {
      updateInterface();
      state.phase = "initializing";
      
      // Request initial snapshot for first direction (North)
      addLog("Taking initial snapshot for first cycle...", "info");
      socket.emit('request_snapshot', { direction: 'north' });
      state.waitingForSnapshot = true;
      
      // Wait for snapshot, then start
      setTimeout(() => {
        if (state.nextDirectionCount === 0) {
          state.nextDirectionCount = state.realCarCounts['north'] || 0;
        }
        if (state.nextDirectionGreenTime === 0) {
          state.nextDirectionGreenTime = CONFIG.DEFAULT_FIRST_GREEN;
        }
        switchCycle();
        mainLoop();
        addLog("Traffic system operational", "success");
      }, 2000);
    }, 1000);
  }

  window.addEventListener("beforeunload", () => {
    try {
      if (socket && socket.connected) socket.disconnect();
    } catch (e) { /* ignore */ }
  });

  initialize();
});