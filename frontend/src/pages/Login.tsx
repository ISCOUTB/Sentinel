import { useState } from "react";
import { FaUser, FaLock } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/pngwing.com.png";


const Login = () => {
    
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
    setError("Todos los campos son obligatorios");
    return;
    }

    const storedUsername = localStorage.getItem("username");
    const storedPassword = localStorage.getItem("password");

    if (username === storedUsername && password === storedPassword) {
    setError("");
    navigate("/hmi");
  } else {
    setError("Usuario o contraseña incorrectos");
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
          <FaUser className="icon" />
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          />
          <FaLock className="icon" />
        </div>
        <button type="submit" className="button-primary">Login</button>
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
