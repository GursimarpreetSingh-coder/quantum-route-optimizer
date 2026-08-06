// Quantum-Enhanced AI Logistics Engine - Advanced Frontend Application

class QuantumLogisticsApp {
    constructor() {
        this.map = null;
        this.markers = [];
        this.routes = [];
        this.coordinates = [];
        this.timeWindows = [];
        this.currentScenario = 'normal';
        this.isOptimizing = false;
        this.charts = {};
        this.animationFrames = [];
        this.theme = localStorage.getItem('theme') || 'dark';
        this.lastOptimizationResult = null;
        this.performanceMode = false;
        this.animationsEnabled = true;
        this.showTrafficOverlay = true;
        this.isBackendOnline = false;
        
        // Performance monitoring
        this.performanceMetrics = {
            loadTime: performance.now(),
            optimizationCount: 0,
            averageOptimizationTime: 0
        };
        
        this.init();
    }
    
    async fetchWithRetry(url, options = {}, retries = 3, backoffMs = 700) {
        const apiBase = window.API_BASE_URL || '';
        const fullUrl = url.startsWith('http') ? url : apiBase + url;
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const res = await fetch(fullUrl, options);
                if (!res.ok) {
                    let details = '';
                    try { const err = await res.json(); details = err.error || JSON.stringify(err); } catch {}
                    throw new Error(`HTTP ${res.status} ${res.statusText}${details ? ` - ${details}` : ''}`);
                }
                return res;
            } catch (e) {
                if (attempt === retries) throw e;
                await new Promise(r => setTimeout(r, backoffMs * attempt));
            }
        }
    }
    
    async init() {
        try {
            this.showLoadingScreen();
            await this.initializeComponents();
            this.bindEvents();
            this.initTheme();
            this.hideLoadingScreen();
            
            // Show welcome message
            setTimeout(() => {
                this.showToast('🚀 Quantum Logistics Engine initialized!', 'success');
            }, 500);
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showToast('⚠️ Some features may not work properly.', 'error');
            this.hideLoadingScreen();
        }
    }
    
    async initializeComponents() {
        await this.initMap();
        this.initCharts();
        this.lazyLoad();
        await this.checkBackendHealth();
        this.startPerformanceMonitoring();
        this.updateStatus('Ready for optimization', 'success');
        this.updateQuickStats();
    }
    
    initMap() {
        return new Promise((resolve) => {
            try {
                // Initialize Leaflet map with enhanced options
                this.map = L.map('map', {
                    zoomControl: false,
                    attributionControl: false,
                    preferCanvas: true,
                    maxZoom: 18,
                    minZoom: 3,
                    worldCopyJump: true
                }).setView([28.6139, 77.2090], 11);
                
                // Add custom zoom control
                L.control.zoom({
                    position: 'bottomright'
                }).addTo(this.map);
                
                // Add multiple tile layers
                const tileLayers = {
                    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors',
                        maxZoom: 18
                    }),
                    'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                        attribution: 'Esri, DigitalGlobe, GeoEye',
                        maxZoom: 18
                    })
                };
                
                // Set default layer
                tileLayers['OpenStreetMap'].addTo(this.map);
                
                // Add layer control
                L.control.layers(tileLayers, {}, {
                    position: 'topright',
                    collapsed: true
                }).addTo(this.map);
                
                // Add click handler for adding nodes with enhanced feedback
                this.map.on('click', (e) => {
                    if (!this.isOptimizing) {
                        this.addNode(e.latlng);
                        this.createRippleEffect(e.containerPoint);
                    }
                });
                
                resolve();
            } catch (error) {
                console.error('Map initialization error:', error);
                resolve();
            }
        });
    }

    async checkBackendHealth() {
        try {
            const res = await this.fetchWithRetry('/api/health', {}, 1, 200);
            const ok = !!(res && res.ok);
            this.updateBackendStatus(ok);
        } catch (e) {
            this.updateBackendStatus(false);
        }
    }

    updateBackendStatus(isOnline) {
        const status = document.getElementById('connectionStatus');
        if (!status) return;
        this.isBackendOnline = !!isOnline;
        const dot = status.querySelector('.status-dot');
        const text = status.querySelector('span');
        if (dot) {
            dot.classList.toggle('online', isOnline);
            dot.classList.toggle('offline', !isOnline);
        }
        if (text) text.textContent = isOnline ? 'System Online' : 'Backend Offline (Demo Mode)';
        if (!isOnline) {
            this.showToast('Backend not reachable. Running in demo mode.', 'warning');
        }
    }
    
    bindEvents() {
        // Scenario selection
        document.querySelectorAll('.scenario-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectScenario(card.dataset.scenario);
            });
        });
        
        // Action buttons
        document.getElementById('loadSample')?.addEventListener('click', () => {
            this.loadSampleData();
        });
        
        document.getElementById('clearMap')?.addEventListener('click', () => {
            this.clearMap();
        });
        
        document.getElementById('optimizeRoute')?.addEventListener('click', () => {
            this.optimizeRoute();
        });
        
        // Map controls
        document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
            this.toggleFullscreen();
        });
        
        // Navbar dropdown menu
        const menuBtn = document.getElementById('navMenuBtn');
        const menu = document.getElementById('navMenu');
        if (menuBtn && menu) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = menu.classList.toggle('show');
                menuBtn.setAttribute('aria-expanded', String(isOpen));
            });
            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target) && e.target !== menuBtn) {
                    if (menu.classList.contains('show')) {
                        menu.classList.remove('show');
                        menuBtn.setAttribute('aria-expanded', 'false');
                    }
                }
            });
            // Close on ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && menu.classList.contains('show')) {
                    menu.classList.remove('show');
                    menuBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }
        
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('change', (e) => {
            this.toggleTheme(e.target.checked);
        });
        
        // Export results
        document.getElementById('exportResults')?.addEventListener('click', () => {
            this.exportResults();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    addNode(latlng) {
        const nodeIndex = this.coordinates.length;
        this.coordinates.push([latlng.lat, latlng.lng]);
        
        // Create marker
        const marker = L.circleMarker(latlng, {
            radius: nodeIndex === 0 ? 12 : 8,
            fillColor: nodeIndex === 0 ? '#dc3545' : '#667eea',
            color: 'white',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.map);
        
        // Add popup
        const label = nodeIndex === 0 ? 'Depot' : `Node ${nodeIndex}`;
        marker.bindPopup(`<b>${label}</b><br>Lat: ${latlng.lat.toFixed(4)}<br>Lng: ${latlng.lng.toFixed(4)}`);
        
        this.markers.push(marker);
        
        console.log(`Added node ${nodeIndex}:`, latlng);
        this.updateQuickStats();
    }
    
    loadSampleData() {
        this.clearMap();
        
        // Load sample data from API (with retry)
        this.fetchWithRetry('/api/sample')
            .then(response => response.json())
            .then(data => {
                this.coordinates = data.coordinates;
                this.timeWindows = data.time_windows;
                
                // Add markers to map
                this.coordinates.forEach((coord, index) => {
                    const latlng = L.latLng(coord[0], coord[1]);
                    this.addNode(latlng);
                });
                
                // Fit map to show all markers
                if (this.markers.length > 0) {
                    const group = new L.featureGroup(this.markers);
                    this.map.fitBounds(group.getBounds().pad(0.1));
                }
                
                this.updateStatus(`Loaded ${this.coordinates.length} sample nodes`);
            })
            .catch(error => {
                console.error('Error loading sample data:', error);
                this.updateStatus('Sample load failed. Please retry.', 'error');
            });
    }
    
    clearMap() {
        // Remove all markers
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
        
        // Remove all routes
        this.routes.forEach(route => {
            this.map.removeLayer(route);
        });
        this.routes = [];
        
        this.coordinates = [];
        this.updateStatus('Map cleared');
        this.updateQuickStats();
    }
    
    async optimizeRoute() {
        if (this.coordinates.length < 2) {
            this.updateStatus('Please add at least 2 nodes', 'error');
            return;
        }
        
        if (this.isOptimizing) {
            return;
        }
        
        this.isOptimizing = true;
        this.updateStatus('Optimizing route...', 'optimizing');
        this.showLoading(true);
        this.setButtonsDisabled(true);
        
        try {
            const solver = document.getElementById('solverSelect')?.value || 'nearest_neighbor';
            const response = await this.fetchWithRetry('/api/optimize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    coordinates: this.coordinates,
                    scenario: this.currentScenario,
                    time_windows: this.timeWindows,
                    problem_type: 'tsp',
                    solver
                })
            }, 3, 800);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this.lastOptimizationResult = result;
            this.displayResults(result);
            
        } catch (error) {
            console.error('Optimization error:', error);
            const hint = `${error?.message || error}`;
            this.updateStatus(`Optimization failed. ${hint.includes('404') ? 'Endpoint missing. Refresh and try again.' : 'Please try again.'}`, 'error');
            this.toast('Optimization failed', 'error');
        } finally {
            this.isOptimizing = false;
            this.showLoading(false);
            this.setButtonsDisabled(false);
        }
    }
    
    displayResults(result) {
        if (!result.success) {
            this.updateStatus('Optimization failed', 'error');
            return;
        }
        
        // Update status
        this.updateStatus(`Optimization complete! ${result.improvement.improvement_percent.toFixed(1)}% improvement`);
        
        // Display routes
        this.displayRoutes(result);
        
        // Update metrics
        this.updateMetrics(result);
        this.updateHeroStats(result);
        
        // Display detailed results
        this.displayDetailedResults(result);
    }

    updateHeroStats(result) {
        const timeSaved = document.getElementById('heroTimeSaved');
        const co2 = document.getElementById('heroCO2');
        const accuracy = document.getElementById('heroAccuracy');
        if (timeSaved) {
            timeSaved.textContent = `${result.improvement.improvement_percent.toFixed(1)}%`;
        }
        if (co2) {
            co2.textContent = `${(
                (result.improvement.co2_savings_kg / Math.max(result.baseline.total_time, 1)) * 100
            ).toFixed(1)}%`;
        }
        if (accuracy) {
            accuracy.textContent = `${result.optimized.on_time_deliveries.toFixed(1)}%`;
        }
    }
    
    displayRoutes(result) {
        // Clear existing routes
        this.routes.forEach(route => {
            this.map.removeLayer(route);
        });
        this.routes = [];
        
        // Display baseline route
        if (result.baseline.route) {
            this.drawRoute(result.baseline.route, '#dc3545', 'Baseline Route', true, result.baseline.total_time);
        }
        
        // Display optimized route
        if (result.optimized.route) {
            this.drawRoute(result.optimized.route, '#28a745', 'Optimized Route', false, result.optimized.total_time);
        }
    }
    
    drawRoute(route, color, label, isDashed, totalTimeMinutes) {
        if (route.length < 2) return;
        
        const routeCoords = route.map(nodeIndex => {
            const coord = this.coordinates[nodeIndex];
            return [coord[0], coord[1]];
        });
        
        // Add return to depot if needed
        if (route[route.length - 1] !== 0) {
            routeCoords.push([this.coordinates[0][0], this.coordinates[0][1]]);
        }
        
        const polyline = L.polyline(routeCoords, {
            color: color,
            weight: isDashed ? 4 : 5,
            opacity: 0.8,
            dashArray: isDashed ? '10, 10' : null
        }).addTo(this.map);
        
        const timeStr = typeof totalTimeMinutes === 'number' ? totalTimeMinutes.toFixed(1) : 'N/A';
        polyline.bindPopup(`<b>${label}</b><br>Total time: ${timeStr} minutes`);
        
        this.routes.push(polyline);
    }
    
    updateMetrics(result) {
        document.getElementById('timeImprovement').textContent = 
            `${result.improvement.improvement_percent.toFixed(1)}%`;
        
        document.getElementById('co2Savings').textContent = 
            `${result.improvement.co2_savings_kg.toFixed(2)} kg`;
        
        document.getElementById('fuelSavings').textContent = 
            `${result.improvement.fuel_savings_liters.toFixed(2)} L`;
        
        document.getElementById('onTimeRate').textContent = 
            `${result.optimized.on_time_deliveries.toFixed(1)}%`;
    }
    
    displayDetailedResults(result) {
        const resultsDiv = document.getElementById('results');
        
        resultsDiv.innerHTML = `
            <div class="route-info">
                <h4>🚚 Baseline Route</h4>
                <p><strong>Route:</strong> ${result.baseline.route.join(' → ')}</p>
                <p><strong>Total Time:</strong> ${result.baseline.total_time.toFixed(2)} minutes</p>
                <p><strong>On-Time Deliveries:</strong> ${result.baseline.on_time_deliveries.toFixed(1)}%</p>
                <p><strong>Late Minutes:</strong> ${(result.baseline.late_minutes || 0).toFixed(2)}</p>
            </div>
            
            <div class="route-info">
                <h4>⚛️ Optimized Route</h4>
                <p><strong>Route:</strong> ${result.optimized.route.join(' → ')}</p>
                <p><strong>Total Time:</strong> ${result.optimized.total_time.toFixed(2)} minutes</p>
                <p><strong>On-Time Deliveries:</strong> ${result.optimized.on_time_deliveries.toFixed(1)}%</p>
                <p><strong>Late Minutes:</strong> ${(result.optimized.late_minutes || 0).toFixed(2)}</p>
                <p><strong>Solver:</strong> ${result.optimized.solver_type}</p>
                <p><strong>Solve Time:</strong> ${result.optimized.solve_time.toFixed(3)} seconds</p>
            </div>
            
            <div class="route-info">
                <h4>📊 Improvement Metrics</h4>
                <p><strong>Time Saved:</strong> ${result.improvement.time_saved_minutes.toFixed(2)} minutes</p>
                <p><strong>Improvement:</strong> ${result.improvement.improvement_percent.toFixed(1)}%</p>
                <p><strong>CO₂ Savings:</strong> ${result.improvement.co2_savings_kg.toFixed(2)} kg</p>
                <p><strong>Fuel Savings:</strong> ${result.improvement.fuel_savings_liters.toFixed(2)} liters</p>
            </div>
            
            <div class="route-info">
                <h4>🌦️ Traffic Conditions</h4>
                <p><strong>Scenario:</strong> ${this.getScenarioDisplayName(result.scenario)}</p>
                <p><strong>Weather:</strong> ${result.traffic_conditions.weather}</p>
                <p><strong>Active Incidents:</strong> ${result.traffic_conditions.incidents}</p>
            </div>
        `;
    }

    clearDisplayedResults() {
        // remove rendered routes
        this.routes.forEach(route => {
            this.map.removeLayer(route);
        });
        this.routes = [];
        // reset results panel
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" aria-hidden="true">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="empty-title">Ready for Optimization</div>
                    <div class="empty-description">
                        Add delivery points and click "Optimize Route" to see detailed results
                    </div>
                </div>
            `;
        }
        // reset hero highlights
        const timeSaved = document.getElementById('heroTimeSaved');
        const co2 = document.getElementById('heroCO2');
        const accuracy = document.getElementById('heroAccuracy');
        if (timeSaved) timeSaved.textContent = '--';
        if (co2) co2.textContent = '--';
        if (accuracy) accuracy.textContent = '--';
        this.lastOptimizationResult = null;
    }
    
    updateStatus(message, type = 'normal') {
        const indicator = document.getElementById('statusIndicator');
        const textNode = document.getElementById('statusText');
        if (textNode) textNode.textContent = message;
        if (indicator) {
            indicator.classList.remove('optimizing','error','success');
            if (type !== 'normal') indicator.classList.add(type);
        }
        
        console.log(`Status: ${message}`);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        overlay.classList.toggle('hidden', !show);
    }

    setButtonsDisabled(disabled) {
        ['loadSample','clearMap','optimizeRoute'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = disabled;
        });
    }

    toast(message, variant = 'success') {
        const container = document.getElementById('toasts');
        if (!container) return;
        const node = document.createElement('div');
        node.className = `toast ${variant}`;
        node.textContent = message;
        container.appendChild(node);
        setTimeout(() => container.removeChild(node), 3500);
    }
    
    // Enhanced UI Methods
    initCharts() {
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                point: { radius: 0 },
                line: { tension: 0.4, borderWidth: 2 }
            }
        };
        
        // Initialize mini charts for metrics if Chart.js is available
        if (typeof Chart !== 'undefined') {
            const chartIds = ['timeChart', 'co2Chart', 'fuelChart', 'deliveryChart'];
            const colors = ['#667eea', '#10b981', '#f59e0b', '#4facfe'];
            
            chartIds.forEach((id, index) => {
                const ctx = document.getElementById(id);
                if (ctx) {
                    this.charts[id] = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: Array.from({length: 10}, (_, i) => i),
                            datasets: [{
                                data: this.generateRandomData(10, 20, 80),
                                borderColor: colors[index],
                                backgroundColor: colors[index] + '20',
                                fill: true
                            }]
                        },
                        options: chartOptions
                    });
                }
            });
        }
    }
    
    generateRandomData(count, min, max) {
        return Array.from({length: count}, () => 
            Math.floor(Math.random() * (max - min + 1)) + min
        );
    }
    
    selectScenario(scenario) {
        // Remove active class from all cards
        document.querySelectorAll('.scenario-card').forEach(card => {
            card.classList.remove('active');
        });
        
        // Add active class to selected card
        const selectedCard = document.querySelector(`[data-scenario="${scenario}"]`);
        if (selectedCard) {
            selectedCard.classList.add('active');
            this.animateScenarioSelection(selectedCard);
        }
        
        this.currentScenario = scenario;
        if (!this.isBackendOnline) {
            this.showToast('Scenario set, but backend is offline. No effect on results.', 'warning');
            this.updateStatus(`Scenario: ${this.getScenarioDisplayName(scenario)} (demo mode)`, 'normal');
        } else {
            this.updateStatus(`Scenario set: ${this.getScenarioDisplayName(scenario)}. Applies to next optimization.`, 'success');
        }
        this.clearDisplayedResults();
    }
    
    getScenarioDisplayName(scenario) {
        const names = {
            'normal': 'Normal Traffic',
            'peak': 'Peak Hours',
            'incident': 'Traffic Incident',
            'storm': 'Storm Conditions'
        };
        return names[scenario] || scenario;
    }
    
    animateScenarioSelection(card) {
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
            card.style.transform = 'scale(1)';
        }, 150);
    }
    
    showToast(message, type = 'success', duration = 4000) {
        const toastsContainer = document.getElementById('toasts');
        if (!toastsContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastsContainer.appendChild(toast);
        
        // Auto remove toast
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.transform = 'translateX(100%)';
                toast.style.opacity = '0';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toastsContainer.removeChild(toast);
                    }
                }, 300);
            }
        }, duration);
    }
    
    showLoadingScreen() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    }
    
    hideLoadingScreen() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
    
    updateQuickStats() {
        const nodeCountElement = document.getElementById('nodeCount');
        if (nodeCountElement) {
            nodeCountElement.textContent = this.coordinates.length;
        }
        
        const routeDistanceElement = document.getElementById('routeDistance');
        if (routeDistanceElement && this.coordinates.length > 1) {
            const totalDistance = this.calculateTotalDistance();
            routeDistanceElement.textContent = totalDistance.toFixed(1) + ' km';
        } else if (routeDistanceElement) {
            routeDistanceElement.textContent = '--';
        }
    }
    
    calculateTotalDistance() {
        if (this.coordinates.length < 2) return 0;
        
        let distance = 0;
        for (let i = 0; i < this.coordinates.length - 1; i++) {
            distance += this.getDistanceBetweenPoints(this.coordinates[i], this.coordinates[i + 1]);
        }
        return distance;
    }
    
    getDistanceBetweenPoints(point1, point2) {
        const R = 6371; // Earth's radius in km
        const dLat = (point2[0] - point1[0]) * Math.PI / 180;
        const dLon = (point2[1] - point1[1]) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Theme Management
    initTheme() {
        const isDark = this.theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.checked = isDark;
        }
    }
    
    toggleTheme(isDark) {
        this.theme = isDark ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', this.theme);
        
        const message = isDark ? '🌙 Dark mode enabled' : '☀️ Light mode enabled';
        this.showToast(message, 'success');
    }
    
    // Animation Methods
    startAnimations() {
        this.animateCounters();
    }
    
    animateCounters() {
        const counters = document.querySelectorAll('[data-count]');
        counters.forEach(counter => {
            const target = parseFloat(counter.dataset.count);
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;
            
            const updateCounter = () => {
                current += increment;
                if (current < target) {
                    counter.textContent = Math.floor(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target;
                }
            };
            
            // Start animation after a delay
            setTimeout(updateCounter, 1000);
        });
    }
    
    createRippleEffect(point) {
        const ripple = document.createElement('div');
        ripple.className = 'map-ripple';
        ripple.style.cssText = `
            position: absolute;
            left: ${point.x}px;
            top: ${point.y}px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: rgba(79, 172, 254, 0.6);
            transform: translate(-50%, -50%);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;
        
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.appendChild(ripple);
            
            setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        }
    }
    
    // Additional utility methods
    toggleFullscreen() {
        const mapContainer = document.querySelector('.map-container');
        if (!mapContainer) return;
        
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen().then(() => {
                mapContainer.classList.add('fullscreen');
                this.showToast('Fullscreen mode enabled', 'info');
                setTimeout(() => this.map.invalidateSize(), 100);
            }).catch(err => {
                this.showToast('Fullscreen not supported', 'warning');
            });
        } else {
            document.exitFullscreen().then(() => {
                mapContainer.classList.remove('fullscreen');
                this.showToast('Fullscreen mode disabled', 'info');
                setTimeout(() => this.map.invalidateSize(), 100);
            });
        }
    }
    
    exportResults() {
        if (!this.lastOptimizationResult) {
            this.showToast('No results to export', 'warning');
            return;
        }
        
        const exportData = {
            timestamp: new Date().toISOString(),
            coordinates: this.coordinates,
            scenario: this.currentScenario,
            results: this.lastOptimizationResult
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `optimization-results-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.showToast('Results exported successfully', 'success');
    }
    
    handleKeyboardShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'l':
                    event.preventDefault();
                    this.loadSampleData();
                    break;
                case 'k':
                    event.preventDefault();
                    this.clearMap();
                    break;
                case 'enter':
                    event.preventDefault();
                    this.optimizeRoute();
                    break;
            }
        }
    }
    
    handleResize() {
        if (this.map) {
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        }
    }
    
    // Performance Optimization Methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Lazy loading for images and resources
    lazyLoad() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
    
    // Memory cleanup
    destroy() {
        // Clean up event listeners
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        window.removeEventListener('resize', this.handleResize);
        
        // Clean up animation frames
        this.animationFrames.forEach(id => {
            cancelAnimationFrame(id);
        });
        
        // Clean up charts
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        
        // Clean up map
        if (this.map) {
            this.map.remove();
        }
        
        // Clear intervals and timeouts
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
        }
    }
    
    // Accessibility announcements
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('live-region');
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }
    
    // Performance monitoring
    startPerformanceMonitoring() {
        this.performanceInterval = setInterval(() => {
            const memory = performance.memory;
            if (memory) {
                const memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;
                if (memoryUsage > 0.9) {
                    console.warn('High memory usage detected:', memoryUsage);
                    this.optimizeMemoryUsage();
                }
            }
        }, 5000);
    }
    
    optimizeMemoryUsage() {
        // Clear old chart data
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.data.datasets[0].data.length > 20) {
                chart.data.datasets[0].data = chart.data.datasets[0].data.slice(-10);
                chart.update('none');
            }
        });
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }
}

// Initialize the application when the page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new QuantumLogisticsApp();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (app && app.destroy) {
        app.destroy();
    }
});

// Export for global access
window.QuantumLogisticsApp = QuantumLogisticsApp;
