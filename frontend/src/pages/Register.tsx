import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/pngwing.com.png";
import { generateUsername } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const { name, lastName, email, password, confirmPassword } = formData;

    // Validaciones
    if (!name || !lastName || !email || !password || !confirmPassword) {
      setError("Nombre, apellido, email y contraseña son obligatorios");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    try {
      // Generar username
      const username = generateUsername(name, lastName, "");

      const userData = {
        username,
        email,
        password,
        role: "user",
      };

      console.log('Datos a enviar:', userData);

      // Registrar usuario
      await register(userData);

      // Mostrar mensaje de éxito
      setSuccess(`Registro exitoso. Tu nombre de usuario es ${username}. Ahora puedes iniciar sesión.`);

      // Navegar al login después de 3s
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error: any) {
      setError(error.message || "Error al registrar usuario");
    }
  };

  return (
    <div className="wrapper">
      <form onSubmit={handleSubmit}>
        <img src={logo} alt="Logo" className="login-logo" />
        <h1>Register</h1>
        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}
        <div className="input-group">
          <label>Name</label>
          <input name="name" value={formData.name} onChange={handleChange} />
        </div>
        <div className="input-group">
          <label>Last Name</label>
          <input name="lastName" value={formData.lastName} onChange={handleChange} />
        </div>
        <div className="input-group">
          <label>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange}/>
        </div>
        <div className="input-group">
          <label>Password</label>
          <input type="password" name="password" onChange={handleChange} />
        </div>
        <div className="input-group">
          <label>Confirm Password</label>
          <input type="password" name="confirmPassword" onChange={handleChange} />
        </div>
        <button type="submit" className="button-primary">Register</button>
        <p className="link" onClick={() => navigate("/")}>
          Back to login
        </p>
      </form>
    </div>
  );
};

export default Register;