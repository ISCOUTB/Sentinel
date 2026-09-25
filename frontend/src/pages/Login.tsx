import { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/pngwing.com.png";
import { useAuth } from "@/contexts/AuthContext";


const Login = () => {

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Si vienes de ConfirmEmail, pre-rellenar el email
  useEffect(() => {
    const email = location.state?.email;
    if (email) {
      setUsername(email);
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!username || !password) {
      setError("Todos los campos son obligatorios");
      setIsLoading(false);
      return;
    }

    try {
      await login(username, password);
      navigate("/hmi");
    } catch (error: any) {
      setError(error.message || "Error al iniciar sesión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="wrapper">
        <form onSubmit={handleSubmit}>
        <img src={logo} alt="Logo" className="login-logo" />
        <h1>Welcome to Sentinel</h1>
        {error && <p className="form-error">{error}</p>}
        <div className="input-group">
          <label>Email</label>
          <input
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="tu@email.com"
          />
          <User className="icon" />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input 
            type={showPassword ? "text" : "password"} 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            style={{ paddingRight: '3.5rem' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: '2.5rem', top: '2.2rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'hsl(var(--muted))' }}
          >
            {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
          <Lock className="icon" size={20} />
        </div>
        <button type="submit" className="button-primary" disabled={isLoading}>
          {isLoading ? "Iniciando sesión..." : "Login"}
        </button>
        <div className="register-link">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("/register"); }}>
            Don't have an account? Register here
          </a>
        </div>
      </form>
    </div>
  );
};

export default Login;
