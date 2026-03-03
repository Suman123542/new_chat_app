import React, { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

function Chat() {
  const API = "http://localhost:5000/api";
  const SOCKET_URL = "http://localhost:5000";
  const [file, setFile] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { user, users, token, logout, refreshUsers, updateProfile } =
    useContext(AuthContext);
  const navigate = useNavigate();

  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  const settingsRef = useRef();
  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);

  // Map backend users to the shape used in the UI
  // UI excludes the currently logged-in user (Messenger style)
  const allUsers = (users || [])
    .filter((u) => String(u._id) !== String(user?._id))
    .map((u) => ({
      id: u._id,
      username: u.name,
      profilePic: u.profilePic,
    }));

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Make sure user list refreshes when Chat opens
  useEffect(() => {
    if (!token) return;
    if (typeof refreshUsers === "function") refreshUsers();
  }, [token, refreshUsers]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileBio(user.bio || "");
    }
  }, [user]);

  // Real-time messaging via Socket.IO
  useEffect(() => {
    if (!user?._id) return;

    // avoid duplicate connections
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SOCKET_URL, {
      query: { userId: user._id },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });

    socketRef.current = socket;

    socket.on("onlineUsers", (ids) => {
      setOnlineUserIds(Array.isArray(ids) ? ids : []);
    });

    socket.on("newMessage", (newMessage) => {
      const currentSelected = selectedUserRef.current;

      // If I'm currently chatting with the sender, append instantly
      if (
        currentSelected?.id &&
        String(newMessage.senderId) === String(currentSelected.id)
      ) {
        setMessages((prev) => [...prev, newMessage]);
        return;
      }

      // Otherwise add a simple notification
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: "New message received",
          fromUserId: newMessage.senderId,
        },
      ]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // selectedUser is intentionally NOT a dependency; we only need it for conditional append
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Close settings if clicked outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load messages
  useEffect(() => {
    if (!selectedUser || !token) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`${API}/messages/${selectedUser.id}`, {
          headers: {
            Authorization: token,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to load messages");
        }

        setMessages(data.messages || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedUser, token]);

  // Send message
  const handleSend = () => {
    if ((!message && !file) || !selectedUser || !token) return;

    const send = async () => {
      setSending(true);
      try {
        const body = {
          text: message || "",
          image: file ? file.data : null,
        };

        const res = await fetch(`${API}/messages/send/${selectedUser.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token,
          },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to send message");
        }

        const newMessage = data.newMessage;
        setMessages((prev) => [...prev, newMessage]);
        setMessage("");
        setFile(null);
      } catch (err) {
        console.error(err);
      } finally {
        setSending(false);
      }
    };

    send();
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleFileChangeProfile = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await updateProfile({
        name: profileName,
        bio: profileBio,
        profilePic: profileImage || undefined,
      });

      // Refresh list so updated profilePic shows immediately in Users section
      await refreshUsers?.();
      setShowProfile(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingProfile(false);
    }
  };
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    const reader = new FileReader();

    reader.onloadend = () => {
      setFile({
        name: selectedFile.name,
        type: selectedFile.type,
        data: reader.result,
      });
    };

    reader.readAsDataURL(selectedFile);
  };
  return (
    <div className="chat-bg">
      {/* Navbar */}
      <nav className="navbar navbar-dark bg-primary px-3 position-relative">
        {/* App Name */}
        <h5 className="text-white m-0">Chattrix</h5>

        {/* Hamburger Button */}
        <div className="position-relative">
          <button
            className="btn btn-light"
            onClick={() => setShowMenu(!showMenu)}
          >
            ☰
          </button>

          {showMenu && (
            <div
              className="card shadow"
              style={{
                position: "absolute",
                right: 0,
                top: "45px",
                width: "220px",
                zIndex: 2000,
              }}
            >
              <div className="card-body p-2">
                {/* Profile */}
                <button
                  className="btn btn-sm btn-outline-primary w-100 mb-2"
                  onClick={() => {
                    setShowProfile(true);
                    setShowMenu(false);
                  }}
                >
                  👤 Profile
                </button>

                {/* Notifications */}
                <button
                  className="btn btn-sm btn-outline-secondary w-100 mb-2"
                  onClick={() => alert("No new notifications")}
                >
                  🔔 Notifications
                </button>

                {/* Dark / Light Mode */}
                <button
                  className="btn btn-sm btn-outline-dark w-100 mb-2"
                  onClick={() => setDarkMode(!darkMode)}
                >
                  {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
                </button>

                {/* About */}
                <button
                  className="btn btn-sm btn-outline-info w-100 mb-2"
                  onClick={() => alert("Chattrix v1.0\nBuilt with React")}
                >
                  ℹ About
                </button>

                {/* Add Account */}
                <button
                  className="btn btn-sm btn-outline-success w-100 mb-2"
                  onClick={() => navigate("/signup")}
                >
                  ➕ Add Account
                </button>

                {/* Logout */}
                <button
                  className="btn btn-sm btn-danger w-100"
                  onClick={handleLogout}
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
      {showProfile && (
        <div className="profile-overlay">
          <div className="profile-card animate__animated animate__zoomIn">
            {/* Profile Image */}
            <form onSubmit={handleUpdateProfile}>
              <div className="mb-3 text-center">
                <img
                  src={
                    profileImage ||
                    user?.profilePic ||
                    "https://via.placeholder.com/120"
                  }
                  alt="profile"
                  className="profile-image"
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-start w-100 text-white">
                  Name
                </label>
                <input
                  className="form-control"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-start w-100 text-white">
                  Bio
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-start w-100 text-white">
                  Profile Picture
                </label>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={handleFileChangeProfile}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 mt-2"
                disabled={updatingProfile}
              >
                {updatingProfile ? "Updating..." : "Update Profile"}
              </button>

              <button
                type="button"
                className="btn btn-secondary w-100 mt-2"
                onClick={() => setShowProfile(false)}
              >
                Close
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="container-fluid mt-3">
        <div className="row">
          {/* Users List */}
          <div className="col-12 col-md-3">
            <div className="card p-3 shadow">
              <div className="d-flex align-items-center justify-content-between">
                <h5 className="m-0">Users</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => refreshUsers?.()}
                >
                  Refresh
                </button>
              </div>

              <ul className="list-group">
                {allUsers.length === 0 ? (
                  <li className="list-group-item text-muted">
                    No registered users found.
                  </li>
                ) : (
                  allUsers.map((u, i) => (
                    <li
                      key={i}
                      className={`list-group-item d-flex align-items-center ${
                        selectedUser?.username === u.username ? "active" : ""
                      }`}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        if (window.innerWidth < 768) {
                          navigate(`/chat/${u.username}`);
                        } else {
                          setSelectedUser(u);
                        }
                      }}
                    >
                      <div
                        className="position-relative me-2"
                        style={{ width: 40, height: 40 }}
                      >
                        <img
                          src={u.profilePic || "https://via.placeholder.com/40"}
                          alt="profile"
                          className="rounded-circle"
                          width="40"
                          height="40"
                        />
                        <span
                          title={
                            onlineUserIds.includes(u.id) ? "Online" : "Offline"
                          }
                          style={{
                            position: "absolute",
                            right: 0,
                            bottom: 0,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: onlineUserIds.includes(u.id)
                              ? "#22c55e"
                              : "#9ca3af",
                            border: "2px solid white",
                          }}
                        />
                      </div>
                      {u.username}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Chat Section */}
          <div className="col-md-9">
            {!selectedUser ? (
              <div className="card p-5 text-center shadow">
                <h4>Select a user to start chatting</h4>
              </div>
            ) : (
              <div className="card shadow animate__animated animate__fadeIn">
                <div className="card-header bg-info text-white">
                  Chat with {selectedUser.username}
                </div>

                <div className="card-header bg-info text-white d-flex align-items-center">
                  <img
                    src={
                      selectedUser.profilePic ||
                      "https://via.placeholder.com/40"
                    }
                    alt="profile"
                    className="rounded-circle me-2"
                    width="40"
                    height="40"
                  />
                  Chat with {selectedUser.username}
                </div>

                <div className="chat-scroll p-3">
                  {loadingMessages ? (
                    <div className="text-center text-muted">
                      Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted">
                      No messages yet. Say hi!
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const isMine = String(msg.senderId) === String(user?._id);
                      const avatarSrc = isMine
                        ? user?.profilePic || "https://via.placeholder.com/32"
                        : selectedUser?.profilePic ||
                          "https://via.placeholder.com/32";

                      return (
                        <div
                          key={index}
                          className={`d-flex ${
                            isMine
                              ? "justify-content-end"
                              : "justify-content-start"
                          } mb-2`}
                        >
                          {!isMine && (
                            <img
                              src={avatarSrc}
                              alt="avatar"
                              className="rounded-circle me-2"
                              width="32"
                              height="32"
                              style={{ alignSelf: "flex-end" }}
                            />
                          )}

                          <div
                            className={
                              isMine
                                ? "chat-bubble sent"
                                : "chat-bubble received"
                            }
                          >
                            {msg.text && <div>{msg.text}</div>}

                            {msg.image && (
                              <div className="mt-2">
                                <img
                                  src={msg.image}
                                  alt="shared"
                                  style={{
                                    maxWidth: "200px",
                                    borderRadius: "10px",
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {isMine && (
                            <img
                              src={avatarSrc}
                              alt="avatar"
                              className="rounded-circle ms-2"
                              width="32"
                              height="32"
                              style={{ alignSelf: "flex-end" }}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="input-group p-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />

                  {/* File Upload Button */}
                  <label className="btn btn-secondary mb-0">
                    📎
                    <input type="file" hidden onChange={handleFileChange} />
                  </label>

                  <button className="btn btn-primary" onClick={handleSend}>
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
