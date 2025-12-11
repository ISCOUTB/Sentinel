import MapSection from './MapSection';
import SensorsPanel from './SensorsPanel';

function MainPanel() {
  return (
    <div className="main-panel">
      <MapSection />
      <SensorsPanel />
    </div>
  );
}

export default MainPanel;