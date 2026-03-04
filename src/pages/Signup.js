import React, { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [error, setError] = useState("");
  const { signup } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleImage = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      setProfilePic(reader.result); // base64 image
    };

    if (file) {
      reader.readAsDataURL(file);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await signup(username, email, password, profilePic);
      navigate("/chat");
    } catch (err) {
      setError(err.message || "Signup failed");
    }
  };

  return (
    <div className="auth-bg d-flex justify-content-center align-items-center">
      <div className="auth-card animate__animated animate__fadeInDown">
        <h2 className="text-center text-warning fw-bold mb-1">Chattrix</h2>

        <p className="text-center text-light mb-4">
          Create Your Account
        </p>

        <h4 className="text-center mb-3 text-white">
          Signup
        </h4>

        {error && (
          <div className="alert alert-danger text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup}>
          <input
            type="text"
            className="form-control mb-3"
            placeholder="Username"
            required
            onChange={(e) => setUsername(e.target.value)}
          />


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

          <input
            type="file"
            className="form-control mb-3"
            accept="image/*"
            onChange={handleImage}
          />

          <button className="btn btn-success w-100">
            Create Account
          </button>
        </form>

        <p className="text-center mt-3 text-white">
          Already have account?{" "}
          <Link to="/" className="text-warning">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;