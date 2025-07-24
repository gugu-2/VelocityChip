import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Zap, Cpu, CircuitBoard, BarChart3, Settings, Save, Upload, Download } from 'lucide-react';

const VelocityChip = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [simulationData, setSimulationData] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [designName, setDesignName] = useState('Untitled Design');
  const canvasRef = useRef(null);
  const [components, setComponents] = useState([
    { id: 1, type: 'transistor', x: 100, y: 100, name: 'NMOS_1', properties: { width: '10μm', length: '0.5μm' } },
    { id: 2, type: 'resistor', x: 250, y: 150, name: 'R1', properties: { resistance: '1kΩ', power: '0.25W' } },
    { id: 3, type: 'capacitor', x: 400, y: 120, name: 'C1', properties: { capacitance: '1pF', voltage: '5V' } }
  ]);

  const [connections, setConnections] = useState([
    { from: 1, to: 2, signal: 'VDD' },
    { from: 2, to: 3, signal: 'OUT' }
  ]);

  const componentTypes = {
    transistor: { color: '#3b82f6', icon: '⚡' },
    resistor: { color: '#ef4444', icon: '⟐' },
    capacitor: { color: '#10b981', icon: '||' },
    inductor: { color: '#f59e0b', icon: '〜' },
    diode: { color: '#8b5cf6', icon: '▷|' }
  };

  useEffect(() => {
    drawCanvas();
  }, [components, connections, selectedComponent]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw connections
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    connections.forEach(conn => {
      const fromComp = components.find(c => c.id === conn.from);
      const toComp = components.find(c => c.id === conn.to);
      if (fromComp && toComp) {
        ctx.beginPath();
        ctx.moveTo(fromComp.x + 25, fromComp.y + 25);
        ctx.lineTo(toComp.x + 25, toComp.y + 25);
        ctx.stroke();
      }
    });

    // Draw components
    components.forEach(comp => {
      const type = componentTypes[comp.type];
      const isSelected = selectedComponent?.id === comp.id;
      
      // Component body
      ctx.fillStyle = isSelected ? type.color : type.color + '80';
      ctx.strokeStyle = isSelected ? '#fbbf24' : type.color;
      ctx.lineWidth = isSelected ? 3 : 2;
      
      ctx.fillRect(comp.x, comp.y, 50, 50);
      ctx.strokeRect(comp.x, comp.y, 50, 50);
      
      // Component icon
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(type.icon, comp.x + 25, comp.y + 32);
      
      // Component name
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '12px monospace';
      ctx.fillText(comp.name, comp.x + 25, comp.y + 65);
    });
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedComponent = components.find(comp => 
      x >= comp.x && x <= comp.x + 50 && y >= comp.y && y <= comp.y + 50
    );
    
    setSelectedComponent(clickedComponent || null);
  };

  const startSimulation = async () => {
    setIsRunning(true);
    
    // Simulate real-time data generation
    const interval = setInterval(() => {
      const newDataPoint = {
        time: Date.now(),
        voltage: 3.3 + Math.sin(Date.now() / 1000) * 1.2 + Math.random() * 0.2,
        current: 0.5 + Math.cos(Date.now() / 800) * 0.3 + Math.random() * 0.1,
        power: 0,
        frequency: 1000 + Math.random() * 200
      };
      newDataPoint.power = newDataPoint.voltage * newDataPoint.current;
      
      setSimulationData(prev => [...prev.slice(-99), newDataPoint]);
    }, 100);

    // Store interval for cleanup
    setTimeout(() => {
      clearInterval(interval);
      setIsRunning(false);
    }, 10000);
  };

  const stopSimulation = () => {
    setIsRunning(false);
    setSimulationData([]);
  };

  const addComponent = (type) => {
    const newComponent = {
      id: Date.now(),
      type,
      x: 200 + Math.random() * 300,
      y: 100 + Math.random() * 200,
      name: `${type.toUpperCase()}_${components.length + 1}`,
      properties: getDefaultProperties(type)
    };
    setComponents([...components, newComponent]);
  };

  const getDefaultProperties = (type) => {
    const defaults = {
      transistor: { width: '10μm', length: '0.5μm', threshold: '0.7V' },
      resistor: { resistance: '1kΩ', power: '0.25W', tolerance: '5%' },
      capacitor: { capacitance: '1pF', voltage: '5V', type: 'ceramic' },
      inductor: { inductance: '1μH', current: '1A', core: 'air' },
      diode: { forwardVoltage: '0.7V', current: '1A', type: 'silicon' }
    };
    return defaults[type] || {};
  };

  const latestData = simulationData[simulationData.length - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Zap className="text-yellow-400 w-8 h-8" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                VelocityChip
              </h1>
            </div>
            <input 
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              className="bg-gray-700 px-3 py-1 rounded border border-gray-600 focus:border-blue-400 focus:outline-none"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <button className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded transition-colors">
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>
            <button className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded transition-colors">
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-80 bg-gray-800/30 backdrop-blur-sm border-r border-gray-700 p-4 overflow-y-auto">
          {/* Component Palette */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <CircuitBoard className="mr-2 text-blue-400" />
              Components
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(componentTypes).map(([type, config]) => (
                <button
                  key={type}
                  onClick={() => addComponent(type)}
                  className="flex flex-col items-center p-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg transition-colors border border-gray-600"
                  style={{ borderColor: config.color + '40' }}
                >
                  <span className="text-2xl mb-1">{config.icon}</span>
                  <span className="text-sm capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Properties Panel */}
          {selectedComponent && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <Settings className="mr-2 text-green-400" />
                Properties
              </h3>
              <div className="bg-gray-700/30 rounded-lg p-4">
                <div className="mb-3">
                  <label className="text-sm text-gray-300">Name</label>
                  <input 
                    value={selectedComponent.name}
                    className="w-full bg-gray-600 px-2 py-1 rounded mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                {Object.entries(selectedComponent.properties).map(([key, value]) => (
                  <div key={key} className="mb-2">
                    <label className="text-sm text-gray-300 capitalize">{key}</label>
                    <input 
                      value={value}
                      className="w-full bg-gray-600 px-2 py-1 rounded mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Simulation Controls */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <BarChart3 className="mr-2 text-purple-400" />
              Simulation
            </h3>
            <div className="flex space-x-2 mb-4">
              <button
                onClick={startSimulation}
                disabled={isRunning}
                className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 px-3 py-2 rounded transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Run</span>
              </button>
              <button
                onClick={stopSimulation}
                className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-500 px-3 py-2 rounded transition-colors"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>
            </div>
            
            {latestData && (
              <div className="bg-gray-700/30 rounded-lg p-3 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Voltage:</span>
                  <span className="text-yellow-400 font-mono">{latestData.voltage.toFixed(2)}V</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Current:</span>
                  <span className="text-blue-400 font-mono">{latestData.current.toFixed(3)}A</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Power:</span>
                  <span className="text-green-400 font-mono">{latestData.power.toFixed(3)}W</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Frequency:</span>
                  <span className="text-purple-400 font-mono">{latestData.frequency.toFixed(0)}Hz</span>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="bg-gray-700/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Status</span>
              <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            </div>
            <div className="text-xs text-gray-400">
              {isRunning ? 'Simulation Running' : 'Ready'} • {components.length} components
            </div>
          </div>
        </div>

        {/* Main Design Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full cursor-crosshair bg-gray-900/50"
            />
            
            {/* Performance Overlay */}
            {isRunning && (
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-4 border border-green-400/30">
                <div className="flex items-center space-x-2 mb-2">
                  <Cpu className="text-green-400 w-5 h-5" />
                  <span className="text-green-400 font-semibold">Real-time Analysis</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="text-gray-300">Simulation Speed: <span className="text-white">10x</span></div>
                  <div className="text-gray-300">Data Points: <span className="text-white">{simulationData.length}</span></div>
                  <div className="text-gray-300">Update Rate: <span className="text-white">100ms</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Waveform Panel */}
          {simulationData.length > 0 && (
            <div className="h-48 bg-gray-800/50 border-t border-gray-700 p-4">
              <h4 className="text-sm font-semibold mb-2 text-gray-300">Signal Waveforms</h4>
              <div className="h-32 bg-black/50 rounded border border-gray-600 relative overflow-hidden">
                <svg className="w-full h-full">
                  {/* Voltage waveform */}
                  <polyline
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    points={simulationData.map((d, i) => 
                      `${(i / simulationData.length) * 100}%,${((5 - d.voltage) / 5) * 100}%`
                    ).join(' ')}
                  />
                  {/* Current waveform */}
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    points={simulationData.map((d, i) => 
                      `${(i / simulationData.length) * 100}%,${((2 - d.current) / 2) * 100}%`
                    ).join(' ')}
                  />
                </svg>
                <div className="absolute top-2 left-2 text-xs space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-0.5 bg-yellow-400"></div>
                    <span className="text-gray-300">Voltage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-0.5 bg-blue-400"></div>
                    <span className="text-gray-300">Current</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VelocityChip;