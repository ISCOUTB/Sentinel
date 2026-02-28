import { useState, useEffect } from "react";
import { User, Lock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/pngwing.com.png";
import { useAuth } from "@/contexts/AuthContext";


const Login = () => {

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        <h1>Login</h1>
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
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <Lock className="icon" />
        </div>
        <button type="submit" className="button-primary" disabled={isLoading}>
          {isLoading ? "Iniciando sesión..." : "Login"}
        </button>
        <div className="register-link">
          <p>
            Don't have an account?{" "}
            <span className="link" onClick={() => navigate("/register")}>
              Register here
            </span>
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;
