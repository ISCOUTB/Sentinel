import { useState } from "react";
import { User, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/pngwing.com.png";
import { useAuth } from "@/contexts/AuthContext";


const Login = () => {

  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      await login({ username, password });
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
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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
