# 🌍 Quantum-Enhanced AI Logistics Engine

**D3CODE 2025 Hackathon Project**

An intelligent route optimization system that combines AI traffic forecasting with quantum-inspired optimization to solve last-mile logistics challenges in India.

## 🎯 Problem Statement

India faces massive challenges in last-mile logistics, especially for time-sensitive and critical supplies like medicines, vaccines, food, and emergency aid. Current routing systems struggle with:

- Dynamic traffic (congestion, accidents, road closures)
- Time windows (supplies must reach within fixed hours)
- Multiple destinations (distribution hubs → clinics → households)
- Cost & emissions (longer routes = more fuel, more CO₂)

## 💡 Solution

Our Smart Route Optimizer combines:
- **AI Layer**: Traffic prediction using historical and live data
- **Quantum Layer**: QUBO-based optimization for Vehicle Routing Problem (VRP)
- **Data Ecosystem**: Secure integration of map data, IoT, and delivery constraints

## 🚀 Quick Start

### Backend Setup
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python solver.py
```

### Frontend Setup
```bash
npm install
npm start
```

### Access the Application
- App and API: http://localhost:3002

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Predictor  │───▶│  QUBO Builder   │───▶│ Quantum Solver  │
│  (Traffic ML)   │    │ (TSP/VRP Model) │    │ (D-Wave/Classical)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Traffic Simulator│    │ Time Windows    │    │ 2-opt Postproc │
│ (Time-dependent)│    │ (Constraints)   │    │ (Local Search)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Demo Scenarios

1. **Normal Day**: Baseline vs optimized routing
2. **Peak Traffic**: AI-adjusted travel times with congestion
3. **Incident Day**: Accident simulation with dynamic rerouting

## 🎯 Impact Metrics

- **16.7% reduction** in delivery time
- **Improved on-time delivery** rate
- **Reduced CO₂ emissions** through optimized routes
- **Real-time adaptation** to traffic conditions

## 🔧 Technical Stack

- **Backend**: Python, Flask, D-Wave Ocean SDK
- **Frontend**: Node.js, Express, Leaflet.js
- **AI/ML**: XGBoost, scikit-learn
- **Quantum**: QUBO formulation, hybrid solvers
- **Maps**: OpenStreetMap integration

## 📁 Project Structure

```
quantum/
├── solver.py              # Core optimization engine
├── traffic_simulator.py   # AI traffic prediction
├── qubo_builder.py       # QUBO formulation
├── server.js             # Express API server
├── public/               # Frontend assets
│   ├── index.html
│   ├── style.css
│   └── app.js
└── requirements.txt      # Python dependencies
```

## 🏆 Hackathon Deliverables

- ✅ Working prototype with real-time optimization
- ✅ Interactive web interface
- ✅ Live demo scenarios
- ✅ Performance metrics and evaluation
- ✅ 2-minute pitch presentation

---

**Built for D3CODE 2025 | AI + Quantum + Data Ecosystems**
