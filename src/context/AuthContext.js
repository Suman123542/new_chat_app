import React, { createContext, useState, useEffect } from "react";

export const AuthContext = createContext();

const API = "http://localhost:5000/api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  const fetchUsers = async (authToken) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${API}/messages/users`, {
        headers: {
          Authorization: authToken,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load users");
      }

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    if (!savedToken) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API}/auth/check`, {
          headers: {
            Authorization: savedToken,
          },
        });

        if (!res.ok) throw new Error("Not authenticated");

        const data = await res.json();
        setUser(data.user);
        setToken(savedToken);
        await fetchUsers(savedToken);
      } catch (err) {
        console.error(err);
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchUsers(token);
  }, [token]);

  const signup = async (username, email, password, profilePic) => {
    const body = { name: username, email, password, profilePic };

    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Signup failed");
    }

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("token", data.token);
    await fetchUsers(data.token);
    return true;
  };

  const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("token", data.token);
    await fetchUsers(data.token);
    return true;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setUsers([]);
    localStorage.removeItem("token");
  };

  const refreshUsers = async () => {
    await fetchUsers(token);
  };

  const updateProfile = async ({ name, bio, profilePic }) => {
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${API}/auth/update-profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ name, bio, profilePic }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Failed to update profile");
    }

    if (data.user) setUser(data.user);
    await fetchUsers(token);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{ user, users, token, signup, login, logout, loading, refreshUsers, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};