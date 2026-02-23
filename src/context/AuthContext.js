import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const storedUsers = JSON.parse(localStorage.getItem("users")) || [];
    setUsers(storedUsers);
  }, []);

  const signup = (username, email, password, profilePic) => {
    const newUser = { username, email, password, profilePic };

    const updatedUsers = [...users, newUser];

    localStorage.setItem("users", JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
  };

  const login = (username, password) => {
    const validUser = users.find(
      (u) => u.username === username && u.password === password
    );

    if (validUser) {
      setUser(validUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, users, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};