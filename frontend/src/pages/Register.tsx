import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/pngwing.com.png";
import { generateUsername } from "@/lib/utils";

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    email: "",
    organization: "",
    phone: "",
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { name, lastName, email, organization, phone, password, confirmPassword } = formData;

    // Validaciones
    if (!name || !lastName || !email || !organization || !phone || !password || !confirmPassword) {
      setError("Todos los campos son obligatorios");
      setSuccess("");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setSuccess("");
      return;
    }

    // Generar username
    const username = generateUsername(name, lastName, phone);

    // Guardar en localStorage (solo pruebas)
    localStorage.setItem("username", username);
    localStorage.setItem("password", password);

    // Mostrar mensaje de éxito
    setError("");
    setSuccess(`Registration successful. Your username is ${username}`);

    console.log("Usuario a registrar:", {
      name,
      lastName,
      email,
      organization,
      phone,
      username,
      password, // solo para pruebas, nunca en producción
    });

    // Navegar al login después de 4s
    setTimeout(() => {
      navigate("/");
    }, 4000);
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
          <label>Organization</label>
          <input name="organization" value={formData.organization} onChange={handleChange}/>
        </div>
        <div className="input-group">
          <label>Phone</label>
          <input name="phone" value={formData.phone} onChange={handleChange}/>
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