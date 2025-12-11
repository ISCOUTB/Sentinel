import SensorGraph from './SensorGraph';
import Logs from './Logs';

function SensorsPanel() {
  return (
    <section className="sensors-panel">
      <h2>Datos Sensores</h2>
      <SensorGraph />
      <Logs />
    </section>
  );
}

export default SensorsPanel;