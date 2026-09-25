import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "@/assets/pngwing.com.png";
import { cognitoAuthService } from "@/services/cognitoAuthService";

const ConfirmEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email as string;

  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  if (!email) {
    return (
      <div className="wrapper">
        <div>
          <img src={logo} alt="Logo" className="login-logo" />
          <h1>Confirmación de Email</h1>
          <p className="form-error">
            Error: No se encontró el email. Por favor, registrate nuevamente.
          </p>
          <button
            className="button-primary"
            onClick={() => navigate("/register")}
          >
            Volver al registro
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    if (!confirmationCode.trim()) {
      setError("Por favor ingresa el código de confirmación");
      setIsLoading(false);
      return;
    }

    try {
      // Confirmar el email con el código
      await cognitoAuthService.confirmSignUp(email, confirmationCode.trim());

      setSuccess("¡Email confirmado! Ahora puedes iniciar sesión.");

      // Navegar al login después de 2s
      setTimeout(() => {
        navigate("/", { state: { email } });
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Error al confirmar el email");
      // Si el código es incorrecto, mostrar opción de reenvío
      if (error.message.includes("Invalid") || error.message.includes("Incorrect")) {
        setShowResend(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await cognitoAuthService.resendConfirmationCode(email);
      setSuccess("Se envió un nuevo código de confirmación a tu email");
      setShowResend(false);
    } catch (error: any) {
      setError(error.message || "Error reenviando el código");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="wrapper">
      <form onSubmit={handleSubmit}>
        <img src={logo} alt="Logo" className="login-logo" />
        <h1>Confirmar Email</h1>

        <p style={{ textAlign: "center", marginBottom: "20px", color: "#666" }}>
          Hemos enviado un código de confirmación a:<br />
          <strong>{email}</strong>
        </p>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <div className="input-group">
          <label>Código de Confirmación</label>
          <input
            type="text"
            placeholder="Ej: 848284"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            maxLength={6}
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          className="button-primary"
          disabled={isLoading || !confirmationCode}
        >
          {isLoading ? "Confirmando..." : "Confirmar Email"}
        </button>

        {showResend && (
          <button
            type="button"
            className="button-primary"
            style={{ marginTop: "10px", backgroundColor: "#666" }}
            onClick={handleResendCode}
            disabled={isLoading}
          >
            {isLoading ? "Reenviando..." : "Reenviar Código"}
          </button>
        )}

        <p className="link" onClick={() => navigate("/register")}>
          Volver al registro
        </p>
      </form>
    </div>
  );
};

export default ConfirmEmail;
