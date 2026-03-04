import React, { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

function Chat() {
  const API = "http://localhost:5000/api";
  const SOCKET_URL = "http://localhost:5000";
  const [file, setFile] = useState(null); // raw File object for uploads
  const [uploadProgress, setUploadProgress] = useState(0); // 0-1
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { user, users, unseenMessages, token, logout, refreshUsers, updateProfile } =
    useContext(AuthContext);
  const navigate = useNavigate();

  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAttachOptions, setShowAttachOptions] = useState(false);
  const [attachment, setAttachment] = useState(null); // {url,name,type,kind}
  const chatScrollRef = useRef(null); // to auto-scroll when messages update
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const settingsRef = useRef();
  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);
  const profileInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const lastLoadedRef = useRef(null);
  const initialFetchRef = useRef(true);

  // Map backend users to the shape used in the UI
  // UI excludes the currently logged-in user (Messenger style)
  // show all registered users except self, mark whether they're online
  const allUsers = (users || [])
    .filter((u) => String(u._id) !== String(user?._id))
    .map((u) => ({
      id: u._id,
      username: u.name,
      profilePic: u.profilePic,
      online: onlineUserIds.includes(String(u._id)),
      bio: u.bio || "",
    }));

  // apply search term to user list
  const filteredUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // helper to render avatar either image or initial
  const renderAvatar = (profilePic, name, size = 40) => {
    if (profilePic) {
      return (
        <img
          src={profilePic}
          alt="profile"
          className="rounded-circle"
          width={size}
          height={size}
        />
      );
    }
    const initial = name ? name.charAt(0).toUpperCase() : "?";
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "#000",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          fontSize: size / 2,
        }}
      >
        {initial}
      </div>
    );
  };

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
      setProfileImage(user.profilePic || null);
    }

    // simple API connectivity check
    const checkApi = async () => {
      try {
        const res = await fetch(`${API}/auth/check`, {
          headers: { Authorization: token },
        });
        if (res.ok) setApiConnected(true);
      } catch (e) {
        setApiConnected(false);
      }
    };

    if (token) checkApi();
  }, [user, token]);
  // whenever we switch to a different conversation, clear any draft/attachment
  useEffect(() => {
    setMessage("");
    setAttachment(null);
    setFile(null);
    setUploadProgress(0);
    setSending(false);
    // reset initialFetch so spinner can show for the new partner if desired
    initialFetchRef.current = true;
    lastLoadedRef.current = null;
  }, [selectedUser]);

  // auto-scroll to bottom when messages or attachment change
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, attachment]);

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
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));

    socketRef.current = socket;

    socket.on("onlineUsers", (ids) => {
      const list = Array.isArray(ids) ? ids : [];
      setOnlineUserIds(list);
      // when online list changes also refresh user sidebar (in case filter applied)
      refreshUsers?.();
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

      // increment unseen counts by re-fetching user list
      refreshUsers?.();

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
  // (refs declared earlier near other useRefs)
  useEffect(() => {
    if (!selectedUser || !token) return;

    // don't refetch if we already loaded for this user and still have messages
    if (
      lastLoadedRef.current === selectedUser.id &&
      messages.length > 0
    ) {
      return;
    }

    const fetchMessages = async () => {
      if (initialFetchRef.current) setLoadingMessages(true);
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
        lastLoadedRef.current = selectedUser.id;
        // update sidebar counts after marking messages seen on server
        refreshUsers?.();
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingMessages(false);
        initialFetchRef.current = false;
      }
    };

    fetchMessages();
  }, [selectedUser, token, refreshUsers, messages.length]);
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
      console.warn(err);
    } finally {
      setUpdatingProfile(false);
    }
  };
  const handleFileChange = (e, kind = "file") => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // keep raw file for upload, create preview URL for display
    setFile(selectedFile);
    let previewUrl = "";
    if (kind === "photo" || kind === "video" || kind === "audio") {
      previewUrl = URL.createObjectURL(selectedFile);
    }
    setAttachment({
      name: selectedFile.name,
      type: selectedFile.type,
      kind,
      url: previewUrl,
    });
    setShowAttachOptions(false);

    // immediately send file if there's nothing to type (speeds up sharing)
    // delay slightly to ensure state updates have occurred
    setTimeout(() => {
      if (!message && selectedFile && selectedUser && token) {
        handleSend();
      }
    }, 50);
  };

  const handleSend = () => {
    if ((!message && !file) || !selectedUser || !token) return;

    setSending(true);
    setUploadProgress(0);

    // if there's an attached file, send as multipart/form-data to avoid base64
    if (file) {
      const form = new FormData();
      form.append("text", message || "");
      form.append("file", file, file.name);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API}/messages/send/${selectedUser.id}`);
      xhr.setRequestHeader("Authorization", token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(e.loaded / e.total);
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 400) throw new Error(data.message || "Failed to send message");
          const newMsg = data.newMessage;
          setMessages((prev) => [...prev, newMsg]);
          setMessage("");
          setAttachment(null);
          setFile(null);
          refreshUsers?.();
        } catch (err) {
          console.warn(err);
        } finally {
          setSending(false);
          setUploadProgress(0);
        }
      };
      xhr.onerror = () => {
        console.warn("Upload error");
        setSending(false);
        setUploadProgress(0);
      };
      xhr.send(form);
    } else {
      // no file, simple text message
      const send = async () => {
        try {
          const body = { text: message || "" };
          const res = await fetch(`${API}/messages/send/${selectedUser.id}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token,
            },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to send message");
          const newMsg = data.newMessage;
          setMessages((prev) => [...prev, newMsg]);
          setMessage("");
          refreshUsers?.();
        } catch (err) {
          console.warn(err);
        } finally {
          setSending(false);
        }
      };
      send();
    }
  };
  return (
    <div className="chat-bg">
      {/* Navbar */}
      <nav className="navbar navbar-dark bg-primary px-3 position-relative">
        {/* App Name */}
        <h5 className="text-white m-0">Chattrix</h5>
        <div className="d-flex align-items-center ms-3">
          <span
            title={apiConnected ? "API connected" : "API offline"}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: apiConnected ? "#22c55e" : "#ef4444",
              marginRight: 4,
            }}
          />
          <span
            title={socketConnected ? "Socket connected" : "Socket offline"}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: socketConnected ? "#22c55e" : "#ef4444",
            }}
          />
        </div>

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
            {/* Profile Image with edit button */}
            <form onSubmit={handleUpdateProfile}>
              <div className="mb-3 text-center" style={{ position: "relative" }}>
                {renderAvatar(
                  profileImage || user?.profilePic,
                  profileName || user?.name,
                  120
                )}
                {/* hidden file input triggered by edit icon */}
                <input
                  type="file"
                  accept="image/*"
                  ref={profileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChangeProfile}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-light"
                  style={{
                    position: "absolute",
                    right: "10px",
                    bottom: "10px",
                    borderRadius: "50%",
                    padding: "4px 6px",
                  }}
                  onClick={() => profileInputRef.current && profileInputRef.current.click()}
                >
                  ✎
                </button>
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

              <div className="mb-2 mt-2">
                <input
                  type="text"
                  className="form-control rounded-pill"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <ul className="list-group">
                {filteredUsers.length === 0 ? (
                  <li className="list-group-item text-muted">
                    No registered users found.
                  </li>
                ) : (
                  filteredUsers.map((u, i) => (
                    <li
                      key={i}
                      className={`list-group-item d-flex align-items-center justify-content-between ${selectedUser?.username === u.username ? "active" : ""
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
                      <div className="d-flex align-items-center">
                        <div
                          className="position-relative me-2"
                          style={{ width: 40, height: 40 }}
                        >
                          {renderAvatar(u.profilePic, u.username, 40)}
                          <span
                            title={
                              onlineUserIds.includes(u.id) ? "Online" : "Offline"
                            }
                            style={{
                              position: "absolute",
                              right: 0,
                              bottom: 0,
                              background: onlineUserIds.includes(u.id)
                                ? "#22c55e"
                                : "#9ca3af",
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              border: "2px solid white",
                            }}
                          />
                        </div>
                        <div>
                          {u.username}
                          {u.online && (
                            <div style={{ fontSize: '0.75rem', color: '#22c55e' }}>
                              online
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="d-flex align-items-center">
                        {/* right-end green circle showing unseen count (in addition to red badge on avatar) */}
                        {unseenMessages && unseenMessages[u.id] && (
                          <span
                            title={`${unseenMessages[u.id]} unread`}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "#22c55e",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              marginLeft: 8,
                            }}
                          >
                            {unseenMessages[u.id]}
                          </span>
                        )}
                      </div>
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
                <div className="card-header bg-info text-white d-flex align-items-center justify-content-between">
                  <div className="d-flex flex-column">
                    <div className="d-flex align-items-center">
                      {renderAvatar(selectedUser.profilePic, selectedUser.username, 40)}
                      <span className="ms-2">Chat with {selectedUser.username}</span>
                    </div>
                    {selectedUser.bio && (
                      <div className="ms-5 mt-1 text-white small">
                        {selectedUser.bio}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: selectedUser.online ? '#22c55e' : '#d1d5db' }}>
                    {selectedUser.online ? 'Online' : 'Offline'}
                  </div>
                </div>

                <div className="chat-scroll p-3" ref={chatScrollRef}>
                  {(initialFetchRef.current && loadingMessages) ? (
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
                        ? user?.profilePic
                        : selectedUser?.profilePic;

                      return (
                        <div
                          key={index}
                          className={`d-flex ${isMine
                            ? "justify-content-end"
                            : "justify-content-start"
                            } mb-2`}
                        >
                          {!isMine && (
                            <div className="me-2" style={{ alignSelf: "flex-end" }}>
                              {renderAvatar(avatarSrc, isMine ? user?.name : selectedUser?.username, 32)}
                            </div>
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

                            {msg.fileUrl && (
                              <div className="mt-2">
                                {msg.fileType && msg.fileType.startsWith("image") ? (
                                  <img
                                    src={msg.fileUrl}
                                    alt={msg.fileName}
                                    style={{
                                      maxWidth: "200px",
                                      borderRadius: "10px",
                                    }}
                                  />
                                ) : (
                                  <a
                                    href={msg.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {msg.fileName || "Download file"}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {isMine && (
                            <div className="ms-2" style={{ alignSelf: "flex-end" }}>
                              {renderAvatar(avatarSrc, user?.name, 32)}
                            </div>
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
                  <div className="position-relative">
                    <button
                      type="button"
                      className="btn btn-secondary mb-0"
                      onClick={() => setShowAttachOptions(!showAttachOptions)}
                    >
                      📎
                    </button>
                    {showAttachOptions && (
                      <div
                        className="card p-2"
                        style={{
                          position: "absolute",
                          bottom: "40px",
                          left: 0,
                          zIndex: 1000,
                        }}
                      >
                        <button
                          className="btn btn-sm btn-light w-100 mb-1"
                          onClick={() => photoInputRef.current && photoInputRef.current.click()}
                        >
                          📷 Photo
                        </button>
                        <button
                          className="btn btn-sm btn-light w-100 mb-1"
                          onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        >
                          📁 File
                        </button>
                        <button
                          className="btn btn-sm btn-light w-100 mb-1"
                          onClick={() => videoInputRef.current && videoInputRef.current.click()}
                        >
                          🎥 Video
                        </button>
                        <button
                          className="btn btn-sm btn-light w-100"
                          onClick={() => audioInputRef.current && audioInputRef.current.click()}
                        >
                          🎵 Audio
                        </button>
                      </div>
                    )}
                  </div>

                  {attachment && (
                    <span className="ms-2 text-white" style={{ fontSize: "0.9rem" }}>
                      {attachment.name}
                    </span>
                  )}
                  {uploadProgress > 0 && uploadProgress < 1 && (
                    <div className="progress w-50 ms-2" style={{ height: '0.6rem' }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                        aria-valuenow={Math.round(uploadProgress * 100)}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      ></div>
                    </div>
                  )}

                  <button className="btn btn-primary" onClick={handleSend}>
                    {sending ? "Sending..." : "Send"}
                  </button>

                  {/* hidden inputs */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "file")}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    ref={photoInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "photo")}
                  />
                  <input
                    type="file"
                    accept="video/*"
                    ref={videoInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "video")}
                  />
                  <input
                    type="file"
                    accept="audio/*"
                    ref={audioInputRef}
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, "audio")}
                  />
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
