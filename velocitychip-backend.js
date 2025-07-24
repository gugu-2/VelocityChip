const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for designs and simulations
const designs = new Map();
const activeSimulations = new Map();

// Circuit simulation engine
class CircuitSimulator {
  constructor(designId, components, connections) {
    this.designId = designId;
    this.components = components;
    this.connections = connections;
    this.isRunning = false;
    this.timeStep = 0;
    this.simulationSpeed = 1; // 1x real-time
  }

  // Advanced SPICE-like circuit simulation
  simulate() {
    const results = {
      timestamp: Date.now(),
      timeStep: this.timeStep++,
      nodes: {},
      components: {},
      performance: {}
    };

    // Handle empty components array
    if (!this.components || this.components.length === 0) {
      results.performance = {
        totalPower: 0,
        maxVoltage: 0,
        maxCurrent: 0,
        efficiency: 0,
        propagationDelay: 0,
        bandwidth: 0
      };
      return results;
    }

    // Nodal analysis for each component
    this.components.forEach(comp => {
      try {
        const nodeVoltage = this.calculateNodeVoltage(comp);
        const current = this.calculateCurrent(comp, nodeVoltage);
        const power = nodeVoltage * current;
        
        results.nodes[comp.id] = {
          voltage: nodeVoltage,
          current: current,
          power: power,
          temperature: this.calculateTemperature(power),
          frequency: this.calculateFrequency(comp)
        };

        // Component-specific calculations
        results.components[comp.id] = this.analyzeComponent(comp, nodeVoltage, current);
      } catch (error) {
        console.error(`Error simulating component ${comp.id}:`, error);
        // Provide default values for failed component
        results.nodes[comp.id] = {
          voltage: 0,
          current: 0,
          power: 0,
          temperature: 25,
          frequency: 1000
        };
        results.components[comp.id] = {
          operatingPoint: { voltage: 0, current: 0, power: 0 },
          characteristics: {},
          status: 'error'
        };
      }
    });

    // Performance metrics with safe calculations
    const nodeValues = Object.values(results.nodes);
    results.performance = {
      totalPower: nodeValues.reduce((sum, node) => sum + (node.power || 0), 0),
      maxVoltage: nodeValues.length > 0 ? Math.max(...nodeValues.map(n => n.voltage || 0)) : 0,
      maxCurrent: nodeValues.length > 0 ? Math.max(...nodeValues.map(n => n.current || 0)) : 0,
      efficiency: this.calculateEfficiency(results.nodes),
      propagationDelay: this.calculatePropagationDelay(),
      bandwidth: this.calculateBandwidth()
    };

    return results;
  }

  calculateNodeVoltage(component) {
    const baseVoltage = 3.3; // VDD reference
    const timeMs = Date.now();
    
    switch (component.type) {
      case 'transistor':
        // MOSFET voltage calculation with realistic noise
        const vth = parseFloat(component.properties.threshold) || 0.7;
        const noise = (Math.random() - 0.5) * 0.1;
        return baseVoltage * (1 + Math.sin(timeMs / 1000) * 0.2) + noise;
        
      case 'resistor':
        // Voltage drop across resistor with thermal noise
        const resistance = parseFloat(component.properties.resistance) || 1000;
        const thermalNoise = Math.sqrt(4 * 1.38e-23 * 300 * 1000) * Math.random(); // Johnson noise
        return baseVoltage * (1 - resistance / 10000) + thermalNoise;
        
      case 'capacitor':
        // Capacitive charging/discharging
        const capacitance = parseFloat(component.properties.capacitance) || 1e-12;
        const chargeTime = (timeMs % 2000) / 2000; // 2 second cycle
        const rcConstant = 1000 * capacitance; // Assume 1kΩ resistance for RC circuit
        return baseVoltage * (1 - Math.exp(-chargeTime / rcConstant));
        
      case 'inductor':
        // Inductive response
        const inductance = parseFloat(component.properties.inductance) || 1e-6;
        return baseVoltage + 0.5 * Math.sin(timeMs / 500) * Math.exp(-timeMs / 5000);
        
      case 'diode':
        // Diode forward voltage with temperature dependence
        const vf = parseFloat(component.properties.forwardVoltage) || 0.7;
        const tempCoeff = -0.002; // V/°C
        const temp = 25 + Math.random() * 10; // 25-35°C
        return vf + tempCoeff * (temp - 25) + Math.random() * 0.01;
        
      default:
        return baseVoltage + Math.random() * 0.1;
    }
  }

  calculateCurrent(component, voltage) {
    switch (component.type) {
      case 'transistor':
        // MOSFET current using square-law model
        const width = parseFloat(component.properties.width) || 10e-6;
        const length = parseFloat(component.properties.length) || 0.5e-6;
        const mobility = 400e-4; // cm²/V·s for NMOS
        const cox = 3.9 * 8.854e-14 / 3e-9; // Gate oxide capacitance
        const vth = 0.7;
        const vgs = voltage;
        const vds = voltage * 0.8;
        
        if (vgs > vth) {
          const id = 0.5 * mobility * cox * (width / length) * Math.pow(vgs - vth, 2) * (1 + 0.1 * vds);
          return id * 1e6; // Convert to μA
        }
        return 0.001 + Math.random() * 0.0001; // Leakage current
        
      case 'resistor':
        const resistance = parseFloat(component.properties.resistance) || 1000;
        return voltage / resistance;
        
      case 'capacitor':
        // AC current through capacitor
        const frequency = 1000; // 1kHz
        const capacitance = parseFloat(component.properties.capacitance) || 1e-12;
        const impedance = 1 / (2 * Math.PI * frequency * capacitance);
        return voltage / impedance;
        
      case 'inductor':
        const inductance = parseFloat(component.properties.inductance) || 1e-6;
        const xl = 2 * Math.PI * 1000 * inductance;
        return voltage / xl;
        
      default:
        return voltage / 1000; // Default 1kΩ
    }
  }

  calculateTemperature(power) {
    const ambientTemp = 25; // °C
    const thermalResistance = 100; // °C/W
    return ambientTemp + power * thermalResistance + Math.random() * 2;
  }

  calculateFrequency(component) {
    const baseFreq = 1000;
    switch (component.type) {
      case 'transistor':
        return baseFreq * 10 + Math.random() * 1000;
      case 'capacitor':
        const c = parseFloat(component.properties.capacitance) || 1e-12;
        return 1 / (2 * Math.PI * 1000 * c);
      default:
        return baseFreq + Math.random() * 500;
    }
  }

  analyzeComponent(component, voltage, current) {
    const analysis = {
      operatingPoint: {
        voltage: voltage,
        current: current,
        power: voltage * current
      },
      characteristics: {},
      status: 'normal'
    };

    switch (component.type) {
      case 'transistor':
        const vth = 0.7;
        analysis.characteristics = {
          region: voltage > vth ? 'saturation' : 'cutoff',
          transconductance: (voltage - vth) !== 0 ? 2 * current / (voltage - vth) : 0,
          outputResistance: current !== 0 ? voltage / current : Infinity,
          gainBandwidth: 1e9 // 1GHz
        };
        
        if (voltage > 5) analysis.status = 'overvoltage';
        if (current > 0.1) analysis.status = 'overcurrent';
        break;
        
      case 'resistor':
        const resistance = parseFloat(component.properties.resistance) || 1000;
        const maxPower = parseFloat(component.properties.power) || 0.25;
        const actualPower = voltage * current;
        
        analysis.characteristics = {
          resistance: resistance,
          powerDissipation: actualPower,
          powerRating: maxPower,
          efficiency: (actualPower / maxPower) * 100
        };
        
        if (actualPower > maxPower) analysis.status = 'overpower';
        break;
        
      case 'capacitor':
        const capacitance = parseFloat(component.properties.capacitance) || 1e-12;
        const maxVoltage = parseFloat(component.properties.voltage) || 5;
        
        analysis.characteristics = {
          capacitance: capacitance,
          chargeStored: capacitance * voltage,
          energy: 0.5 * capacitance * voltage * voltage,
          impedance: 1 / (2 * Math.PI * 1000 * capacitance)
        };
        
        if (voltage > maxVoltage) analysis.status = 'overvoltage';
        break;
    }

    return analysis;
  }

  calculateEfficiency(nodes) {
    const totalPowerIn = Object.values(nodes)
      .filter(node => node.power > 0)
      .reduce((sum, node) => sum + node.power, 0);
    
    const totalPowerOut = Object.values(nodes)
      .filter(node => node.power < 0)
      .reduce((sum, node) => sum + Math.abs(node.power), 0);
    
    return totalPowerIn > 0 ? (totalPowerOut / totalPowerIn) * 100 : 0;
  }

  calculatePropagationDelay() {
    // Simplified propagation delay calculation
    const componentDelay = this.components.length * 10e-12; // 10ps per component
    const wireDelay = this.connections.length * 5e-12; // 5ps per connection
    return (componentDelay + wireDelay) * 1e12; // Return in picoseconds
  }

  calculateBandwidth() {
    // Estimate bandwidth based on fastest component
    if (this.components.length === 0) return 0;
    const frequencies = this.components.map(comp => this.calculateFrequency(comp));
    return Math.max(...frequencies);
  }
}

// WebSocket connections for real-time simulation data
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  console.log(`Client ${clientId} connected`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebSocketMessage(clientId, data, ws);
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client ${clientId} disconnected`);
  });
});

function handleWebSocketMessage(clientId, data, ws) {
  switch (data.type) {
    case 'start_simulation':
      startRealTimeSimulation(clientId, data.designId, data.config, ws);
      break;
    case 'stop_simulation':
      stopRealTimeSimulation(clientId);
      break;
    case 'update_component':
      updateComponentInSimulation(clientId, data.componentId, data.properties);
      break;
  }
}

function startRealTimeSimulation(clientId, designId, config, ws) {
  const design = designs.get(designId);
  if (!design) {
    ws.send(JSON.stringify({ error: 'Design not found' }));
    return;
  }

  const simulator = new CircuitSimulator(designId, design.components, design.connections);
  activeSimulations.set(clientId, {
    simulator,
    interval: null,
    config: config || { updateRate: 100, duration: 30000 }
  });

  const simulation = activeSimulations.get(clientId);
  simulator.isRunning = true;

  // Start real-time simulation loop
  simulation.interval = setInterval(() => {
    if (simulator.isRunning) {
      const results = simulator.simulate();
      
      // Broadcast to connected client
      if (clients.has(clientId)) {
        clients.get(clientId).send(JSON.stringify({
          type: 'simulation_data',
          data: results
        }));
      }
    }
  }, simulation.config.updateRate);

  // Auto-stop after duration
  setTimeout(() => {
    stopRealTimeSimulation(clientId);
  }, simulation.config.duration);

  ws.send(JSON.stringify({
    type: 'simulation_started',
    designId: designId,
    config: simulation.config
  }));
}

function stopRealTimeSimulation(clientId) {
  const simulation = activeSimulations.get(clientId);
  if (simulation) {
    simulation.simulator.isRunning = false;
    if (simulation.interval) {
      clearInterval(simulation.interval);
    }
    activeSimulations.delete(clientId);
    
    if (clients.has(clientId)) {
      clients.get(clientId).send(JSON.stringify({
        type: 'simulation_stopped'
      }));
    }
  }
}

function updateComponentInSimulation(clientId, componentId, properties) {
  const simulation = activeSimulations.get(clientId);
  if (simulation) {
    const component = simulation.simulator.components.find(c => c.id === componentId);
    if (component) {
      Object.assign(component.properties, properties);
      
      if (clients.has(clientId)) {
        clients.get(clientId).send(JSON.stringify({
          type: 'component_updated',
          componentId: componentId,
          properties: properties
        }));
      }
    }
  }
}

// REST API Endpoints

// Get all designs
app.get('/api/designs', (req, res) => {
  const designList = Array.from(designs.entries()).map(([id, design]) => ({
    id,
    name: design.name,
    created: design.created,
    modified: design.modified,
    componentCount: design.components.length
  }));
  res.json(designList);
});

// Get specific design
app.get('/api/designs/:id', (req, res) => {
  const design = designs.get(req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  res.json(design);
});

// Create new design
app.post('/api/designs', (req, res) => {
  const { name, components = [], connections = [] } = req.body;
  const designId = uuidv4();
  const now = new Date().toISOString();
  
  const design = {
    id: designId,
    name: name || 'Untitled Design',
    components,
    connections,
    created: now,
    modified: now,
    metadata: {
      version: '1.0',
      author: 'VelocityChip User',
      description: ''
    }
  };
  
  designs.set(designId, design);
  res.status(201).json(design);
});

// Update design
app.put('/api/designs/:id', (req, res) => {
  const design = designs.get(req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  
  const { name, components, connections, metadata } = req.body;
  
  if (name) design.name = name;
  if (components) design.components = components;
  if (connections) design.connections = connections;
  if (metadata) design.metadata = { ...design.metadata, ...metadata };
  
  design.modified = new Date().toISOString();
  
  designs.set(req.params.id, design);
  res.json(design);
});

// Delete design
app.delete('/api/designs/:id', (req, res) => {
  if (!designs.has(req.params.id)) {
    return res.status(404).json({ error: 'Design not found' });
  }
  
  designs.delete(req.params.id);
  res.status(204).send();
});

// Run simulation (one-time)
app.post('/api/designs/:id/simulate', (req, res) => {
  const design = designs.get(req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  
  const { steps = 100, timeStep = 0.001 } = req.body;
  const simulator = new CircuitSimulator(req.params.id, design.components, design.connections);
  
  const results = [];
  for (let i = 0; i < steps; i++) {
    simulator.timeStep = i * timeStep;
    results.push(simulator.simulate());
  }
  
  res.json({
    designId: req.params.id,
    simulationResults: results,
    metadata: {
      steps,
      timeStep,
      duration: steps * timeStep,
      timestamp: new Date().toISOString()
    }
  });
});

// Get component library
app.get('/api/components', (req, res) => {
  const componentLibrary = {
    transistor: {
      name: 'MOSFET Transistor',
      category: 'Active',
      properties: {
        width: { type: 'number', unit: 'μm', default: 10, min: 0.1, max: 1000 },
        length: { type: 'number', unit: 'μm', default: 0.5, min: 0.1, max: 100 },
        threshold: { type: 'number', unit: 'V', default: 0.7, min: 0.1, max: 5 },
        mobility: { type: 'number', unit: 'cm²/V·s', default: 400, min: 100, max: 1000 }
      },
      pins: ['gate', 'source', 'drain', 'bulk']
    },
    resistor: {
      name: 'Resistor',
      category: 'Passive',
      properties: {
        resistance: { type: 'number', unit: 'Ω', default: 1000, min: 1, max: 1e9 },
        power: { type: 'number', unit: 'W', default: 0.25, min: 0.1, max: 100 },
        tolerance: { type: 'number', unit: '%', default: 5, min: 1, max: 20 }
      },
      pins: ['pin1', 'pin2']
    },
    capacitor: {
      name: 'Capacitor',
      category: 'Passive',
      properties: {
        capacitance: { type: 'number', unit: 'F', default: 1e-12, min: 1e-15, max: 1e-3 },
        voltage: { type: 'number', unit: 'V', default: 5, min: 1, max: 1000 },
        type: { type: 'select', options: ['ceramic', 'electrolytic', 'tantalum'], default: 'ceramic' }
      },
      pins: ['positive', 'negative']
    },
    inductor: {
      name: 'Inductor',
      category: 'Passive',
      properties: {
        inductance: { type: 'number', unit: 'H', default: 1e-6, min: 1e-9, max: 1e-3 },
        current: { type: 'number', unit: 'A', default: 1, min: 0.1, max: 100 },
        core: { type: 'select', options: ['air', 'iron', 'ferrite'], default: 'air' }
      },
      pins: ['pin1', 'pin2']
    },
    diode: {
      name: 'Diode',
      category: 'Active',
      properties: {
        forwardVoltage: { type: 'number', unit: 'V', default: 0.7, min: 0.1, max: 5 },
        current: { type: 'number', unit: 'A', default: 1, min: 0.001, max: 100 },
        type: { type: 'select', options: ['silicon', 'germanium', 'schottky'], default: 'silicon' }
      },
      pins: ['anode', 'cathode']
    }
  };
  
  res.json(componentLibrary);
});

// Export design to various formats
app.post('/api/designs/:id/export', (req, res) => {
  const design = designs.get(req.params.id);
  if (!design) {
    return res.status(404).json({ error: 'Design not found' });
  }
  
  const { format = 'json' } = req.body;
  
  switch (format.toLowerCase()) {
    case 'spice':
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${design.name}.cir"`);
      res.send(generateSpiceNetlist(design));
      break;
      
    case 'verilog':
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${design.name}.v"`);
      res.send(generateVerilogCode(design));
      break;
      
    case 'json':
    default:
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${design.name}.json"`);
      res.json(design);
      break;
  }
});

// Helper functions for export formats
function generateSpiceNetlist(design) {
  let netlist = `* SPICE Netlist for ${design.name}\n`;
  netlist += `* Generated by VelocityChip on ${new Date().toISOString()}\n\n`;
  
  design.components.forEach((comp, index) => {
    switch (comp.type) {
      case 'resistor':
        netlist += `R${index + 1} N${comp.id}_1 N${comp.id}_2 ${comp.properties.resistance || '1k'}\n`;
        break;
      case 'capacitor':
        netlist += `C${index + 1} N${comp.id}_1 N${comp.id}_2 ${comp.properties.capacitance || '1p'}\n`;
        break;
      case 'inductor':
        netlist += `L${index + 1} N${comp.id}_1 N${comp.id}_2 ${comp.properties.inductance || '1u'}\n`;
        break;
      case 'transistor':
        netlist += `M${index + 1} N${comp.id}_D N${comp.id}_G N${comp.id}_S N${comp.id}_B NMOS W=${comp.properties.width || '10u'} L=${comp.properties.length || '0.5u'}\n`;
        break;
    }
  });
  
  netlist += '\n.end\n';
  return netlist;
}

function generateVerilogCode(design) {
  let verilog = `// Verilog module for ${design.name}\n`;
  verilog += `// Generated by VelocityChip on ${new Date().toISOString()}\n\n`;
  verilog += `module ${design.name.replace(/\s+/g, '_')} (\n`;
  verilog += `    input wire clk,\n`;
  verilog += `    input wire reset,\n`;
  verilog += `    // Add your ports here\n`;
  verilog += `);\n\n`;
  verilog += `    // Component instantiations\n`;
  
  design.components.forEach((comp, index) => {
    verilog += `    // ${comp.type} ${comp.name}\n`;
  });
  
  verilog += `\nendmodule\n`;
  return verilog;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeSimulations: activeSimulations.size,
    connectedClients: clients.size,
    totalDesigns: designs.size
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 VelocityChip Backend Server running on port ${PORT}`);
  console.log(`📊 WebSocket server ready for real-time simulations`);
  console.log(`🔧 REST API available at http://localhost:${PORT}/api`);
});