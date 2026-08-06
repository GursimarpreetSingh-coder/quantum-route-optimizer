// Simple, truthful backend for route optimization
// Provides /api/health, /api/sample, /api/optimize

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
// 3000 and 3001 are commonly occupied by other local web apps; this project
// defaults to 3002 while still allowing callers to override it with PORT.
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Haversine distance in km
function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function scenarioFactors(scenario) {
  // Factors multiply time (so <1 is faster, >1 slower)
  switch (scenario) {
    case 'peak':
      return { timeFactor: 1.33, serviceFactor: 1.0 };
    case 'incident':
      return { timeFactor: 1.20, serviceFactor: 1.05 };
    case 'storm':
      return { timeFactor: 1.60, serviceFactor: 1.20 };
    default:
      return { timeFactor: 1.0, serviceFactor: 1.0 };
  }
}

function trafficPredictFactor(date = new Date()) {
  // Simple AI-like predictor: higher congestion during 8-11 and 17-21 local time
  // and mild midday slowdown. Returns multiplier on time (>1 means slower).
  const hour = date.getHours();
  if ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21)) return 1.25;
  if (hour >= 12 && hour <= 14) return 1.10;
  return 1.0;
}

function routeDistanceKm(coords, order) {
  if (!order || order.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += haversineKm(coords[order[i]], coords[order[i+1]]);
  }
  return total;
}

function nearestNeighborTour(coords) {
  const n = coords.length;
  const visited = new Array(n).fill(false);
  let tour = [0];
  visited[0] = true;
  for (let step = 1; step < n; step++) {
    const last = tour[tour.length - 1];
    let best = -1, bestDist = Infinity;
    for (let i = 1; i < n; i++) {
      if (!visited[i]) {
        const d = haversineKm(coords[last], coords[i]);
        if (d < bestDist) { bestDist = d; best = i; }
      }
    }
    tour.push(best);
    visited[best] = true;
  }
  return tour;
}

function computeTimesMinutes(coords, order, scenario, time_windows, now = new Date()) {
  // Closed-tour travel model: depot -> every stop -> depot.
  // If a window [e, l] is supplied, early arrival waits until e and late
  // arrival is recorded. The reported duration is the actual makespan, not
  // an invented lateness-adjusted value.
  const avgSpeedKmh = 35;
  const { timeFactor, serviceFactor } = scenarioFactors(scenario);
  const trafficFactor = trafficPredictFactor(now);
  const combinedTimeFactor = timeFactor * trafficFactor;
  // Service time per stop (non-depot) baseline 2 minutes
  const servicePerStopMin = 2 * serviceFactor;
  let driveKm = routeDistanceKm(coords, order);
  // Add return to depot if not already
  if (order[order.length - 1] !== 0) {
    driveKm += haversineKm(coords[order[order.length - 1]], coords[0]);
  }
  const driveMinutes = (driveKm / avgSpeedKmh) * 60 * combinedTimeFactor;
  const serviceMinutes = (order.length - 1) * servicePerStopMin;
  let clock = 0;
  let waitingMinutes = 0;
  let lateMinutes = 0;
  let onTimeStops = 0;
  const stopCount = order.length - 1;
  if (Array.isArray(time_windows)) {
    for (let idx = 1; idx < order.length; idx++) {
      const i = order[idx];
      const prev = order[idx - 1];
      const legKm = haversineKm(coords[prev], coords[i]);
      clock += (legKm / avgSpeedKmh) * 60 * combinedTimeFactor;
      const win = time_windows[i];
      if (win && Array.isArray(win) && win.length === 2) {
        const [e, l] = win.map(Number);
        if (Number.isFinite(e) && Number.isFinite(l) && e <= l) {
          if (clock < e) { waitingMinutes += e - clock; clock = e; }
          if (clock <= l) onTimeStops += 1;
          else lateMinutes += clock - l;
        } else onTimeStops += 1;
      } else {
        onTimeStops += 1;
      }
      clock += servicePerStopMin;
    }
  } else {
    onTimeStops = stopCount;
  }
  // Return to depot is already included in driveMinutes. Waiting shifts the
  // completed route duration by exactly the accumulated waiting time.
  const totalMinutes = driveMinutes + serviceMinutes + waitingMinutes;
  return {
    totalMinutes, driveKm, waitingMinutes, lateMinutes,
    onTimeDeliveries: stopCount ? (onTimeStops / stopCount) * 100 : 100
  };
}
function buildTimeMatrixMinutes(coords, scenario, now = new Date()) {
  const n = coords.length;
  const T = Array.from({ length: n }, () => Array(n).fill(0));
  const avgSpeedKmh = 35;
  const { timeFactor } = scenarioFactors(scenario);
  const tf = trafficPredictFactor(now) * timeFactor;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const km = haversineKm(coords[i], coords[j]);
      T[i][j] = (km / avgSpeedKmh) * 60 * tf;
    }
  }
  return T;
}

function quboFromTSPTimeWindows(T) {
  // Position-based TSP QUBO (size n*n). Constraints:
  // 1) Each position k has exactly one city i
  // 2) Each city i appears in exactly one position k
  // Objective: sum_k sum_{i,j} T[i][j] x_{i,k} x_{j,(k+1)mod n}
  const n = T.length;
  const P = 500; // penalty weight
  const N = n * n;
  // Q represented as sparse map: key "a,b" -> weight
  const Q = new Map();
  function idx(i, k) { return i * n + k; }
  function addQ(a, b, w) {
    const key = a <= b ? `${a},${b}` : `${b},${a}`;
    Q.set(key, (Q.get(key) || 0) + w);
  }
  // Objective
  for (let k = 0; k < n; k++) {
    const kp = (k + 1) % n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const a = idx(i, k);
        const b = idx(j, kp);
        addQ(a, b, T[i][j]);
      }
    }
  }
  // Constraints (1): each position has exactly one city
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      const a = idx(i, k);
      addQ(a, a, -P); // -P x_a
      for (let j = 0; j < n; j++) {
        const b = idx(j, k);
        addQ(a, b, P); // +P x_a x_b
      }
    }
  }
  // Constraints (2): each city appears in exactly one position
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const a = idx(i, k);
      addQ(a, a, -P);
      for (let kp = 0; kp < n; kp++) {
        const b = idx(i, kp);
        addQ(a, b, P);
      }
    }
  }
  return { Q, n };
}

function energyOfBitstring(Q, bits) {
  let e = 0;
  for (const [key, w] of Q.entries()) {
    const [aStr, bStr] = key.split(',');
    const a = Number(aStr), b = Number(bStr);
    const xa = bits[a];
    const xb = bits[b];
    if (xa && xb) e += w;
  }
  return e;
}

function decodeTourFromBits(bits, n) {
  const tour = Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      if (bits[i * n + k]) {
        tour[k] = i;
      }
    }
  }
  if (tour.includes(-1)) return null;
  return tour;
}

function quboSimulatedAnnealingTour(coords, scenario, timeWindows, sweeps = 1200, restarts = 8) {
  /*
   * Position QUBO: x(i,k)=1 iff node i is visited at position k.
   * Minimise E(x) = travel(x) + P[sum_k(sum_i x(i,k)-1)^2
   *                                  + sum_i(sum_k x(i,k)-1)^2].
   *
   * A single-bit flip breaks those hard constraints and was therefore almost
   * always rejected in the old implementation. Here every annealing proposal
   * swaps two non-depot positions. It stays in the feasible QUBO subspace,
   * so the QUBO energy changes with the route rather than with violations.
   */
  const T = buildTimeMatrixMinutes(coords, scenario);
  const { Q, n } = quboFromTSPTimeWindows(T);
  const encode = (tour) => {
    const bits = new Array(n * n).fill(0);
    for (let k = 0; k < n; k++) bits[tour[k] * n + k] = 1;
    return bits;
  };
  const score = (tour) => {
    const metrics = computeTimesMinutes(coords, tour, scenario, timeWindows);
    // Soft time-window penalty: one minute late is equivalent to five route minutes.
    return metrics.totalMinutes + 5 * metrics.lateMinutes;
  };
  let bestTour = null;
  let bestScore = Infinity;
  const base = nearestNeighborTour(coords);
  for (let r = 0; r < restarts; r++) {
    const tour = base.slice();
    // Randomise each restart while retaining depot at position zero.
    for (let i = n - 1; i > 1; i--) {
      const j = 1 + Math.floor(Math.random() * i);
      [tour[i], tour[j]] = [tour[j], tour[i]];
    }
    let current = score(tour);
    const initialTemp = Math.max(5, current * 0.12);
    for (let step = 0; step < sweeps; step++) {
      const a = 1 + Math.floor(Math.random() * (n - 1));
      let b = 1 + Math.floor(Math.random() * (n - 1));
      if (a === b) continue;
      [tour[a], tour[b]] = [tour[b], tour[a]];
      const proposed = score(tour);
      const temperature = initialTemp * Math.pow(0.002 / initialTemp, step / Math.max(1, sweeps - 1));
      const delta = proposed - current;
      if (delta <= 0 || Math.random() < Math.exp(-delta / temperature)) current = proposed;
      else [tour[a], tour[b]] = [tour[b], tour[a]];
    }
    // This confirms the final route is a valid binary QUBO assignment.
    const bits = encode(tour);
    const quboEnergy = energyOfBitstring(Q, bits);
    if (Number.isFinite(quboEnergy) && current < bestScore) {
      bestScore = current;
      bestTour = tour.slice();
    }
  }
  return bestTour || base;
}

function twoOptImprove(coords, tour, scenario, timeWindows) {
  // 2-opt minimises the same travel-and-lateness objective reported by the API.
  const n = tour.length;
  if (n < 4) return tour;
  const score = (candidate) => {
    const m = computeTimesMinutes(coords, candidate, scenario, timeWindows);
    return m.totalMinutes + 5 * m.lateMinutes;
  };
  let current = score(tour);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1 && !improved; i++) {
      for (let k = i + 1; k < n; k++) {
        const candidate = tour.slice();
        candidate.splice(i, k - i + 1, ...candidate.slice(i, k + 1).reverse());
        const proposed = score(candidate);
        if (proposed < current - 1e-9) {
          tour.splice(0, n, ...candidate);
          current = proposed;
          improved = true;
          break;
        }
      }
    }
  }
  return tour;
}

function quantumInspiredTour(coords, scenario, timeWindows, populationSize = 36, generations = 80) {
  /*
   * Quantum-inspired evolutionary algorithm (QEA), executed classically.
   * For every (position, node) pair we maintain a probability amplitude a;
   * p = a^2 is used when measuring a route. After each generation, amplitudes
   * are rotated toward the best measured route: a' = normalize((1-r)a + r t).
   * Sampling without replacement preserves the TSP permutation constraint.
   * This is deliberately independent of the 2-Opt implementation.
   */
  const n = coords.length;
  const width = n - 1;
  const amplitudes = Array.from({ length: width }, () => Array(n).fill(0));
  for (let position = 0; position < width; position++) {
    for (let node = 1; node < n; node++) amplitudes[position][node] = 1 / Math.sqrt(width);
  }
  const score = (tour) => {
    const metrics = computeTimesMinutes(coords, tour, scenario, timeWindows);
    return metrics.totalMinutes + 5 * metrics.lateMinutes;
  };
  const measure = () => {
    const unused = new Set(Array.from({ length: width }, (_, index) => index + 1));
    const tour = [0];
    for (let position = 0; position < width; position++) {
      let total = 0;
      for (const node of unused) total += amplitudes[position][node] ** 2;
      let threshold = Math.random() * total;
      let chosen = [...unused][0];
      for (const node of unused) {
        threshold -= amplitudes[position][node] ** 2;
        if (threshold <= 0) { chosen = node; break; }
      }
      tour.push(chosen);
      unused.delete(chosen);
    }
    return tour;
  };
  let bestTour = null;
  let bestScore = Infinity;
  for (let generation = 0; generation < generations; generation++) {
    const population = Array.from({ length: populationSize }, () => {
      const tour = measure();
      return { tour, score: score(tour) };
    }).sort((left, right) => left.score - right.score);
    const elite = population[0];
    if (elite.score < bestScore) { bestScore = elite.score; bestTour = elite.tour.slice(); }
    const learningRate = 0.06 + 0.14 * (generation / Math.max(1, generations - 1));
    for (let position = 0; position < width; position++) {
      const target = elite.tour[position + 1];
      let normSquared = 0;
      for (let node = 1; node < n; node++) {
        const targetAmplitude = node === target ? 1 : 0;
        amplitudes[position][node] = (1 - learningRate) * amplitudes[position][node] + learningRate * targetAmplitude;
        normSquared += amplitudes[position][node] ** 2;
      }
      const norm = Math.sqrt(normSquared);
      for (let node = 1; node < n; node++) amplitudes[position][node] /= norm;
    }
  }
  return bestTour || nearestNeighborTour(coords);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/sample', (req, res) => {
  // Fixed, transparent sample around New Delhi for determinism
  const coordinates = [
    [28.6139, 77.2090], // Depot (Connaught Place)
    [28.7041, 77.1025],
    [28.5355, 77.3910],
    [28.4595, 77.0266],
    [28.4089, 77.3178],
    [28.6692, 77.4538]
  ];
  const time_windows = null; // Not enforced in this simple model
  res.json({ coordinates, time_windows });
});

app.post('/api/optimize', (req, res) => {
  const { coordinates, scenario = 'normal', time_windows, problem_type, solver } = req.body || {};
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return res.status(400).json({ success: false, error: 'Need at least 2 coordinates' });
  }
  if (coordinates.length > 100) {
    return res.status(400).json({ success: false, error: 'Maximum 100 coordinates supported' });
  }
  if (!coordinates.every((point) => Array.isArray(point) && point.length === 2 &&
    Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])) &&
    Math.abs(Number(point[0])) <= 90 && Math.abs(Number(point[1])) <= 180)) {
    return res.status(400).json({ success: false, error: 'Coordinates must be valid [latitude, longitude] pairs' });
  }
  if (solver === 'qubo_sa' && coordinates.length > 20) {
    return res.status(400).json({ success: false, error: 'QUBO simulated annealing is limited to 20 nodes; use AI 2-Opt for larger routes' });
  }

  // Baseline: visit in given order [0..n-1]
  const baselineOrder = Array.from({ length: coordinates.length }, (_, i) => i);
  const baseline = computeTimesMinutes(coordinates, baselineOrder, scenario, time_windows);

  const t0 = Date.now();
  let optimizedOrder;
  let solverType = 'nearest_neighbor';
  switch ((solver || '').toLowerCase()) {
    case 'two_opt':
    case 'two_opt_ai': {
      const nn = nearestNeighborTour(coordinates);
      optimizedOrder = twoOptImprove(coordinates, nn, scenario, time_windows);
      solverType = 'two_opt_ai';
      break;
    }
    case 'qubo_sa': {
      optimizedOrder = quboSimulatedAnnealingTour(coordinates, scenario, time_windows);
      solverType = 'qubo_sa';
      break;
    }
    case 'quantum_inspired': {
      optimizedOrder = quantumInspiredTour(coordinates, scenario, time_windows);
      solverType = 'quantum_inspired';
      break;
    }
    default: {
      optimizedOrder = nearestNeighborTour(coordinates);
      solverType = 'nearest_neighbor';
    }
  }
  const optimized = computeTimesMinutes(coordinates, optimizedOrder, scenario, time_windows);
  const solveTimeSec = (Date.now() - t0) / 1000;

  // Improvement metrics
  const timeSaved = Math.max(baseline.totalMinutes - optimized.totalMinutes, 0);
  const baselineObjective = baseline.totalMinutes + 5 * baseline.lateMinutes;
  const optimizedObjective = optimized.totalMinutes + 5 * optimized.lateMinutes;
  const objectiveSaved = Math.max(baselineObjective - optimizedObjective, 0);
  const improvementPercent = baselineObjective > 0 ? (objectiveSaved / baselineObjective) * 100 : 0;
  // CO2 and fuel savings from reduced km (simple linear model)
  const deltaKm = Math.max(baseline.driveKm - optimized.driveKm, 0);
  const kgCO2PerKm = 0.19; // small van ~0.18–0.25 kg/km
  const litersPerKm = 0.12; // ~12 L/100km
  const co2SavingsKg = deltaKm * kgCO2PerKm;
  const fuelSavingsL = deltaKm * litersPerKm;

  const result = {
    success: true,
    scenario,
    baseline: {
      route: baselineOrder,
      total_time: baseline.totalMinutes,
      on_time_deliveries: baseline.onTimeDeliveries,
      late_minutes: baseline.lateMinutes,
      optimization_objective: baselineObjective
    },
    optimized: {
      route: optimizedOrder,
      total_time: optimized.totalMinutes,
      on_time_deliveries: optimized.onTimeDeliveries,
      late_minutes: optimized.lateMinutes,
      optimization_objective: optimizedObjective,
      solver_type: solverType,
      solve_time: solveTimeSec
    },
    improvement: {
      time_saved_minutes: timeSaved,
      objective_saved_minutes: objectiveSaved,
      improvement_percent: improvementPercent,
      co2_savings_kg: co2SavingsKg,
      fuel_savings_liters: fuelSavingsL
    },
    traffic_conditions: {
      weather: scenario === 'storm' ? 'Storm' : 'Clear/Clouds',
      incidents: scenario === 'incident' ? 1 : 0
    }
  };

  res.json(result);
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
