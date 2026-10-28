/**
 * SearchSelect Examples
 */
import { useState } from 'react';

import { SearchSelect, type TwoColumnOption } from './index';

// Example data
const processOptions: TwoColumnOption[] = [
    { value: 'proc_001', col1: 'Process A', col2: 'Production Line 1' },
    { value: 'proc_002', col1: 'Process B', col2: 'Production Line 2' },
    { value: 'proc_003', col1: 'Process C', col2: 'Quality Check' },
    { value: 'proc_004', col1: 'Process D', col2: 'Assembly' },
];

const sensorOptions: TwoColumnOption[] = [
    { value: 'sensor_temp', col1: 'Temperature', col2: 'Celsius' },
    { value: 'sensor_humid', col1: 'Humidity', col2: 'Percentage' },
    { value: 'sensor_press', col1: 'Pressure', col2: 'Bar' },
];

// Example 1: Basic Usage
export function Example1_Basic() {
    const [selected, setSelected] = useState<string | number | null>(null);

    return (
        <div style={{ padding: '20px' }}>
            <h3>Example 1: Basic Process Selection</h3>
            <SearchSelect
                id="process-select"
                name="process"
                value={selected}
                options={processOptions}
                onChange={setSelected}
                placeholder="Select a process..."
                searchPlaceholder="Search process or line..."
                selectedDisplayMode="col1"
            />
            <p style={{ marginTop: '10px', color: '#666' }}>Selected: {selected || 'None'}</p>
        </div>
    );
}

// Example 2: Display Both Columns
export function Example2_BothColumns() {
    const [selected, setSelected] = useState<string | number | null>(null);

    return (
        <div style={{ padding: '20px' }}>
            <h3>Example 2: Display Both Columns</h3>
            <SearchSelect
                value={selected}
                options={processOptions}
                onChange={setSelected}
                placeholder="Select a process..."
                selectedDisplayMode="both"
            />
            <p style={{ marginTop: '10px', color: '#666' }}>Selected: {selected || 'None'}</p>
        </div>
    );
}

// Example 3: Sensor with col2 Display
export function Example3_SensorSelection() {
    const [selected, setSelected] = useState<string | number | null>(null);

    return (
        <div style={{ padding: '20px' }}>
            <h3>Example 3: Sensor Selection (Display col2)</h3>
            <SearchSelect
                options={sensorOptions}
                value={selected}
                onChange={setSelected}
                placeholder="Select a sensor..."
                searchPlaceholder="Search sensor type or unit..."
                selectedDisplayMode="col2"
            />
            <p style={{ marginTop: '10px', color: '#666' }}>Selected: {selected || 'None'}</p>
        </div>
    );
}

// All Examples
export default function AllExamples() {
    const [activeExample, setActiveExample] = useState(1);

    return (
        <div style={{ padding: '20px' }}>
            <h1>SearchSelect Examples</h1>

            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                {[1, 2, 3].map((num) => (
                    <button
                        key={num}
                        onClick={() => setActiveExample(num)}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: activeExample === num ? '#0066cc' : '#e0e0e0',
                            color: activeExample === num ? 'white' : '#222',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        Example {num}
                    </button>
                ))}
            </div>

            <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '4px' }}>
                {activeExample === 1 && <Example1_Basic />}
                {activeExample === 2 && <Example2_BothColumns />}
                {activeExample === 3 && <Example3_SensorSelection />}
            </div>
        </div>
    );
}
