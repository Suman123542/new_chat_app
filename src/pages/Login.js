import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await login(email, password);
      navigate("/chat");
    } catch (err) {
      setError(err.message || "Invalid email or password");
    }
  };

  return (
    <div className="auth-bg d-flex justify-content-center align-items-center">
      <div className="auth-card animate__animated animate__fadeInDown">
        <h2 className="text-center text-warning fw-bold mb-1">Chattrix</h2>

        <p className="text-center text-light mb-4">Connect. Chat. Enjoy.</p>

        <h4 className="text-center mb-3 text-white">Login</h4>

        {error && (
          <div className="alert alert-danger text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            className="form-control mb-3"
            placeholder="Email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="form-control mb-3"
            placeholder="Password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn btn-primary w-100">
            Login
          </button>
        </form>

        <p className="text-center mt-3 text-white">
          Don't have account?{" "}
          <Link to="/signup" className="text-warning">
            Signup
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;