import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { time: '10:00', temp: 22, humidity: 80 },
  { time: '10:10', temp: 23, humidity: 82 },
  { time: '10:20', temp: 24, humidity: 85 },
  { time: '10:30', temp: 23, humidity: 83 },
  { time: '10:40', temp: 25, humidity: 88 },
];

function SensorGraph() {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <h3>Datos de Sensores</h3>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="temp" stroke="#8884d8" name="Temperatura (°C)" />
          <Line type="monotone" dataKey="humidity" stroke="#82ca9d" name="Humedad (%)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SensorGraph;