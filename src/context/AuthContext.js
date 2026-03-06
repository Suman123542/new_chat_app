import React, { createContext, useState, useEffect, useCallback, useMemo } from "react";

export const AuthContext = createContext();

const API = "http://localhost:5000/api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [unseenMessages, setUnseenMessages] = useState({});

  const fetchUsers = useCallback(async (authToken) => {
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
      setUnseenMessages(data.unseenMessages || {});
    } catch (err) {
      console.warn("Error fetching users:", err);
      setUsers([]);
      setUnseenMessages({});
    }
  }, []);

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
        console.warn(err);
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [fetchUsers]);

  useEffect(() => {
    if (!token) return;
    fetchUsers(token);
  }, [token, fetchUsers]);

  const signup = useCallback(async (username, email, password, profilePic) => {
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
  }, [fetchUsers]);

  const login = useCallback(async (email, password) => {
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
  }, [fetchUsers]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setUsers([]);
    localStorage.removeItem("token");
  }, []);

  const refreshUsers = useCallback(async () => {
    await fetchUsers(token);
  }, [fetchUsers, token]);

  const updateProfile = useCallback(async ({ name, bio, profilePic, profilePicFile }) => {
    if (!token) throw new Error("Not authenticated");

    let res;
    if (profilePicFile instanceof Blob) {
      const form = new FormData();
      form.append("name", name || "");
      form.append("bio", bio || "");
      form.append("profilePic", profilePicFile, profilePicFile.name || "profile.jpg");

      res = await fetch(`${API}/auth/update-profile`, {
        method: "PUT",
        headers: {
          Authorization: token,
        },
        body: form,
      });
    } else {
      res = await fetch(`${API}/auth/update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ name, bio, profilePic }),
      });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "Failed to update profile");
    }

    setUser(data.user);
    setUsers((prev) =>
      (prev || []).map((u) =>
        String(u._id) === String(data.user?._id) ? data.user : u
      )
    );
    return data.user;
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      users,
      unseenMessages,
      token,
      signup,
      login,
      logout,
      loading,
      refreshUsers,
      updateProfile,
    }),
    [user, users, unseenMessages, token, signup, login, logout, loading, refreshUsers, updateProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
