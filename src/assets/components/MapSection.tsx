import Alert from "./Alert";
import BatteryStatus from "./BatteryStatus";
import ControlButtons from "./ControlButtons";
import MapView from "./MapView";

function MapSection() {
  return (
    <section className="map-section">
      <div className="map-container">
        <MapView />
      </div>
      <Alert />
      <BatteryStatus />
      <ControlButtons />
    </section>
  );
}

export default MapSection;
