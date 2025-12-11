function Header() {
  return (
    <header className="header">
      <div className="mode-buttons">
        <button>3D</button>
        <button>MAPA</button>
      </div>
      <div className="date">
        <p>06 de septiembre, 2025</p>
        <p>Tiempo de actividad: HH:MM:SS</p>
      </div>
    </header>
  );
}

export default Header;