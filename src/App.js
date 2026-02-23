import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import MobileChat from "./pages/MobileChat";
import { AuthProvider, AuthContext } from "./context/AuthContext";

function PrivateRoute({ children }) {
  return (
    <AuthContext.Consumer>
      {({ user }) => (user ? children : <Navigate to="/" />)}
    </AuthContext.Consumer>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/chat"
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            }
          />
          <Route path="/chat/:username" element={<MobileChat />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
