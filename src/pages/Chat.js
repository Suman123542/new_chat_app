import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

function Chat() {
  const API = "http://localhost:5000/api";
  const SOCKET_URL = "http://localhost:5000";

  const {
    user,
    users,
    unseenMessages,
    token,
    logout,
    refreshUsers,
    updateProfile,
  } = useContext(AuthContext);

  const navigate = useNavigate();

  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const [showAttachOptions, setShowAttachOptions] = useState(false);
  const [file, setFile] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [darkMode, setDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  const [typingUser, setTypingUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [replyTo, setReplyTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");

  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [callState, setCallState] = useState({
    active: false,
    type: null,
    muted: false,
    videoEnabled: true,
    startedAt: null,
  });

  const chatScrollRef = useRef(null);
  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);
  const messagesRef = useRef([]);
  const typingTimeoutRef = useRef(null);
  const profileInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const initialFetchRef = useRef(true);
  const lastLoadedRef = useRef(null);
  const refreshUsersTimerRef = useRef(null);
  const profilePreviewUrlRef = useRef(null);

  const scheduleUsersRefresh = useCallback((delay = 250) => {
    if (!refreshUsers) return;
    if (refreshUsersTimerRef.current) {
      clearTimeout(refreshUsersTimerRef.current);
    }
    refreshUsersTimerRef.current = setTimeout(() => {
      refreshUsers?.();
      refreshUsersTimerRef.current = null;
    }, delay);
  }, [refreshUsers]);

  const formatTime = (time) => {
    const d = new Date(time);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateSeparator = (time) => {
    if (!time) return "";
    const messageDate = new Date(time);
    const now = new Date();
    const startOfMessageDay = new Date(
      messageDate.getFullYear(),
      messageDate.getMonth(),
      messageDate.getDate()
    );
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDiff = Math.floor(
      (startOfToday.getTime() - startOfMessageDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayDiff < 7) {
      return messageDate.toLocaleDateString([], { weekday: "long" });
    }
    return messageDate.toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

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
          background: "#0f172a",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "700",
          fontSize: size / 2,
        }}
      >
        {initial}
      </div>
    );
  };

  const getMessageStatus = (msg) => {
    const isMine = String(msg.senderId) === String(user?._id);
    if (!isMine) return "";
    if (msg.seen) return "seen";
    if (selectedUser?.online) return "delivered";
    return "sent";
  };

  const emojiList = [
    "\u{1F600}",
    "\u{1F602}",
    "\u{1F60D}",
    "\u{1F60E}",
    "\u{1F44D}",
    "\u{1F64F}",
    "\u{1F525}",
    "\u{1F389}",
    "\u2764\uFE0F",
    "\u{1F91D}",
    "\u{1F622}",
    "\u{1F621}",
    "\u{1F634}",
    "\u{1F914}",
    "\u{1F44F}",
  ];

  const allUsers = useMemo(
    () =>
      (users || [])
        .filter((u) => String(u._id) !== String(user?._id))
        .map((u) => ({
          id: u._id,
          username: u.name,
          profilePic: u.profilePic,
          online: onlineUserIds.includes(String(u._id)),
          bio: u.bio || "",
        })),
    [users, user?._id, onlineUserIds]
  );

  const filteredUsers = allUsers.filter((u) =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!selectedUser?.id) return;
    const latest = allUsers.find((u) => String(u.id) === String(selectedUser.id));
    if (!latest) return;
    setSelectedUser((prev) => {
      if (!prev) return prev;
      if (
        prev.username === latest.username &&
        prev.profilePic === latest.profilePic &&
        prev.online === latest.online &&
        prev.bio === latest.bio
      ) {
        return prev;
      }
      return latest;
    });
  }, [allUsers, selectedUser?.id]);

  useEffect(() => {
    if (!token) return;
    scheduleUsersRefresh(0);
  }, [token, scheduleUsersRefresh]);

  useEffect(() => {
    return () => {
      if (refreshUsersTimerRef.current) {
        clearTimeout(refreshUsersTimerRef.current);
      }
      if (profilePreviewUrlRef.current) {
        URL.revokeObjectURL(profilePreviewUrlRef.current);
        profilePreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileBio(user.bio || "");
      setProfileImage(user.profilePic || null);
      setProfileImageFile(null);
    }

    const checkApi = async () => {
      try {
        const res = await fetch(`${API}/auth/check`, {
          headers: { Authorization: token },
        });
        setApiConnected(res.ok);
      } catch (e) {
        setApiConnected(false);
      }
    };

    if (token) checkApi();
  }, [user, token]);

  useEffect(() => {
    setMessage("");
    setAttachment(null);
    setFile(null);
    setUploadProgress(0);
    setSending(false);
    setReplyTo(null);
    setEditingMessageId(null);
    setEditText("");
    setTypingUser(null);
    initialFetchRef.current = true;
    lastLoadedRef.current = null;
  }, [selectedUser?.id]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, attachment, typingUser]);

  useEffect(() => {
    if (!user?._id) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SOCKET_URL, {
      auth: { userId: user._id },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));

    socket.on("onlineUsers", (ids) => {
      const list = Array.isArray(ids) ? ids : [];
      setOnlineUserIds(list);
    });

    socket.on("newMessage", (newMessage) => {
      const currentSelected = selectedUserRef.current;
      if (
        currentSelected?.id &&
        String(newMessage.senderId) === String(currentSelected.id)
      ) {
        setMessages((prev) => {
          const exists = prev.some((m) => String(m._id) === String(newMessage._id));
          return exists ? prev : [...prev, newMessage];
        });
      } else {
        scheduleUsersRefresh(200);
      }
    });

    socket.on("messageUpdated", (updated) => {
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(updated._id) ? updated : m))
      );
    });

    socket.on("messageDeleted", ({ id }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(id)
            ? {
                ...m,
                text: "This message was deleted",
                deleted: true,
                fileUrl: null,
                fileName: null,
                fileType: null,
                image: null,
              }
            : m
        )
      );
    });

    socket.on("userProfileUpdated", (updatedUser) => {
      if (!updatedUser?._id) return;
      scheduleUsersRefresh(0);

      if (String(selectedUserRef.current?.id) === String(updatedUser._id)) {
        setSelectedUser((prev) =>
          prev
            ? {
                ...prev,
                username: updatedUser.name ?? prev.username,
                profilePic: updatedUser.profilePic ?? prev.profilePic,
                bio: updatedUser.bio ?? prev.bio,
              }
            : prev
        );
      }
    });

    socket.on("typing", ({ from }) => {
      if (String(from) === String(selectedUserRef.current?.id)) {
        setTypingUser(from);
      }
    });

    socket.on("stopTyping", ({ from }) => {
      if (String(from) === String(selectedUserRef.current?.id)) {
        setTypingUser(null);
      }
    });

    socket.on("messagesSeen", ({ by }) => {
      if (String(by) !== String(selectedUserRef.current?.id)) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m.senderId) === String(user?._id) ? { ...m, seen: true } : m
        )
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id, scheduleUsersRefresh]);

  useEffect(() => {
    if (!selectedUser || !token) return;

    if (lastLoadedRef.current === selectedUser.id && messagesRef.current.length > 0) {
      return;
    }

    const fetchMessages = async () => {
      if (initialFetchRef.current) setLoadingMessages(true);
      try {
        const res = await fetch(`${API}/messages/${selectedUser.id}`, {
          headers: { Authorization: token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load messages");

        setMessages(data.messages || []);
        lastLoadedRef.current = selectedUser.id;
        scheduleUsersRefresh(250);
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingMessages(false);
        initialFetchRef.current = false;
      }
    };

    fetchMessages();
  }, [selectedUser, token, scheduleUsersRefresh]);

  const stopTypingSignal = () => {
    if (socketRef.current && selectedUser) {
      socketRef.current.emit("stopTyping", { to: selectedUser.id });
    }
  };

  const handleMessageChange = (value) => {
    setMessage(value);

    if (!selectedUser || !socketRef.current) return;

    socketRef.current.emit("typing", { to: selectedUser.id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingSignal();
    }, 1000);
  };

  const handleFileChangeProfile = (e) => {
    setProfileError("");
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!(selectedFile instanceof Blob)) {
      setProfileError("Invalid image file selected");
      return;
    }
    if (profilePreviewUrlRef.current) {
      URL.revokeObjectURL(profilePreviewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(selectedFile);
    profilePreviewUrlRef.current = previewUrl;
    setProfileImageFile(selectedFile);
    setProfileImage(previewUrl);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setUpdatingProfile(true);

    try {
      await updateProfile({
        name: profileName,
        bio: profileBio,
        profilePic: undefined,
        profilePicFile: profileImageFile || undefined,
      });
      if (profilePreviewUrlRef.current) {
        URL.revokeObjectURL(profilePreviewUrlRef.current);
        profilePreviewUrlRef.current = null;
      }
      setProfileImageFile(null);
      scheduleUsersRefresh(0);
      setProfileSuccess("Profile updated successfully");
      setTimeout(() => setShowProfile(false), 250);
    } catch (err) {
      console.warn(err);
      setProfileError(err.message || "Update failed");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleFileChange = (e, kind = "file") => {
    setSendError("");
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!(selectedFile instanceof Blob)) {
      setSendError("Selected attachment is invalid. Please choose the file again.");
      return;
    }

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
  };

  const handleSend = async (overrideFile) => {
    setSendError("");

    const isBlobLike = (value) =>
      typeof Blob !== "undefined" && value instanceof Blob;
    const fileToSend = isBlobLike(overrideFile) ? overrideFile : file;
    const replyId = replyTo?._id || replyTo?.id;
    if ((!message && !fileToSend) || !selectedUser || !token) return;
    if (fileToSend && !isBlobLike(fileToSend)) {
      setSendError("Attachment is not a valid file. Please re-attach and try again.");
      return;
    }

    setSending(true);
    setUploadProgress(0);

    if (fileToSend) {
      const form = new FormData();
      form.append("text", message || "");
      form.append("file", fileToSend, fileToSend.name || "attachment");
      if (replyId) form.append("replyTo", replyId);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API}/messages/send/${selectedUser.id}`);
      xhr.setRequestHeader("Authorization", token);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(event.loaded / event.total);
        }
      };

      xhr.onload = () => {
        try {
          const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          if (xhr.status >= 400) {
            throw new Error(data.message || "Failed to send message");
          }

          const newMsg = data.newMessage;
          if (!newMsg) {
            throw new Error("Upload finished, but server did not return the new message.");
          }
          setMessages((prev) => [...prev, newMsg]);
          setMessage("");
          setAttachment(null);
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          if (photoInputRef.current) photoInputRef.current.value = "";
          if (videoInputRef.current) videoInputRef.current.value = "";
          if (audioInputRef.current) audioInputRef.current.value = "";
          setReplyTo(null);
          scheduleUsersRefresh(100);

          stopTypingSignal();
        } catch (err) {
          console.warn(err);
          setSendError(
            err.message ||
              `Unable to send file (status ${xhr.status || "unknown"})`
          );
        } finally {
          setSending(false);
          setUploadProgress(0);
        }
      };

      xhr.onerror = () => {
        setSendError("Network error uploading file");
        setSending(false);
        setUploadProgress(0);
      };

      xhr.send(form);
      return;
    }

    try {
      const res = await fetch(`${API}/messages/send/${selectedUser.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ text: message || "", replyTo: replyId || null }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send message");

      const newMsg = data.newMessage;
      setMessages((prev) => [...prev, newMsg]);
      setMessage("");
      setReplyTo(null);
      scheduleUsersRefresh(100);
      stopTypingSignal();
    } catch (err) {
      console.warn(err);
      setSendError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg._id);
    setEditText(msg.text || "");
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !token) return;
    const targetId = editingMessageId;
    const optimisticText = editText;
    const previousMessages = messages;

    try {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(targetId)
            ? { ...m, text: optimisticText, edited: true }
            : m
        )
      );
      setEditingMessageId(null);
      setEditText("");

      const res = await fetch(`${API}/messages/${targetId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ text: optimisticText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Edit failed");

      const updated = data.updatedMessage;
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(updated._id) ? updated : m))
      );
    } catch (err) {
      setMessages(previousMessages);
      setEditingMessageId(targetId);
      setEditText(optimisticText);
      setSendError(err.message || "Unable to edit message");
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!token) return;
    const ok = window.confirm("Delete this message?");
    if (!ok) return;
    const previousMessages = messages;

    try {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(id)
            ? {
                ...m,
                text: "This message was deleted",
                deleted: true,
                fileUrl: null,
                fileName: null,
                fileType: null,
                image: null,
              }
            : m
        )
      );
      const res = await fetch(`${API}/messages/${id}`, {
        method: "DELETE",
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
    } catch (err) {
      setMessages(previousMessages);
      setSendError(err.message || "Unable to delete message");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const startCall = (type) => {
    setCallState({
      active: true,
      type,
      muted: false,
      videoEnabled: type === "video",
      startedAt: Date.now(),
    });
  };

  const endCall = () => {
    setCallState({
      active: false,
      type: null,
      muted: false,
      videoEnabled: true,
      startedAt: null,
    });
  };

  const getReplyMessage = (msg) => {
    if (!msg?.replyTo) return null;
    if (typeof msg.replyTo === "object") return msg.replyTo;
    return messages.find((m) => String(m._id) === String(msg.replyTo)) || null;
  };

  return (
    <div className="chat-bg" data-bs-theme={darkMode ? "dark" : "light"}>
      <nav className="navbar navbar-dark bg-primary px-3 position-relative">
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

        <div className="position-relative">
          <button className="btn btn-light" onClick={() => setShowMenu(!showMenu)}>
            Menu
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
                <button
                  className="btn btn-sm btn-outline-primary w-100 mb-2"
                  onClick={() => {
                    setShowProfile(true);
                    setShowMenu(false);
                  }}
                >
                  Profile
                </button>

                <button
                  className="btn btn-sm btn-outline-dark w-100 mb-2"
                  onClick={() => setDarkMode(!darkMode)}
                >
                  {darkMode ? "Light Mode" : "Dark Mode"}
                </button>

                <button
                  className="btn btn-sm btn-outline-success w-100 mb-2"
                  onClick={() => navigate("/signup")}
                >
                  Add Account
                </button>

                <button className="btn btn-sm btn-danger w-100" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {showProfile && (
        <div className="profile-overlay">
          <div className="profile-card animate__animated animate__zoomIn">
            <form onSubmit={handleUpdateProfile}>
              <div className="mb-3 text-center" style={{ position: "relative" }}>
                {renderAvatar(profileImage || user?.profilePic, profileName || user?.name, 120)}
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
                  onClick={() => profileInputRef.current?.click()}
                >
                  Edit
                </button>
              </div>

              <div className="mb-3">
                <label className="form-label text-start w-100 text-white">Name</label>
                <input
                  className="form-control"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-start w-100 text-white">Bio</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                />
              </div>

              {profileError && (
                <div className="alert alert-danger" role="alert">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="alert alert-success" role="alert">
                  {profileSuccess}
                </div>
              )}

              <button type="submit" className="btn btn-primary w-100 mt-2" disabled={updatingProfile}>
                {updatingProfile ? "Updating..." : "Update Profile"}
              </button>

              <button type="button" className="btn btn-secondary w-100 mt-2" onClick={() => setShowProfile(false)}>
                Close
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="container-fluid mt-3">
        <div className="row">
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
                  <li className="list-group-item text-muted">No registered users found.</li>
                ) : (
                  filteredUsers.map((u) => (
                    <li
                      key={u.id}
                      className={`list-group-item d-flex align-items-center justify-content-between ${
                        selectedUser?.id === u.id ? "active" : ""
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
                        <div className="position-relative me-2" style={{ width: 40, height: 40 }}>
                          {renderAvatar(u.profilePic, u.username, 40)}
                          <span
                            title={u.online ? "Online" : "Offline"}
                            style={{
                              position: "absolute",
                              right: 0,
                              bottom: 0,
                              background: u.online ? "#22c55e" : "#9ca3af",
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
                            <div style={{ fontSize: "0.75rem", color: "#22c55e" }}>online</div>
                          )}
                        </div>
                      </div>

                      {unseenMessages?.[u.id] && (
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
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

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
                    {selectedUser.bio && <div className="ms-5 mt-1 text-white small">{selectedUser.bio}</div>}
                    {typingUser && (
                      <div className="ms-5 mt-1 typing-indicator">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                        <span className="ms-2">typing...</span>
                      </div>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <div style={{ fontSize: "0.85rem", color: selectedUser.online ? "#22c55e" : "#d1d5db" }}>
                      {selectedUser.online ? "Online" : "Offline"}
                    </div>
                    <button className="btn btn-sm btn-light" onClick={() => startCall("audio")}>
                      Audio Call
                    </button>
                    <button className="btn btn-sm btn-light" onClick={() => startCall("video")}>
                      Video Call
                    </button>
                  </div>
                </div>

                <div className="chat-scroll p-3" ref={chatScrollRef}>
                  {initialFetchRef.current && loadingMessages ? (
                    <div className="text-center text-muted">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted">No messages yet. Say hi!</div>
                  ) : (
                    messages.map((msg, idx) => {
                      const currentDateLabel = formatDateSeparator(msg.createdAt);
                      const prevDateLabel =
                        idx > 0 ? formatDateSeparator(messages[idx - 1]?.createdAt) : "";
                      const shouldShowDateDivider = currentDateLabel && currentDateLabel !== prevDateLabel;
                      const isMine = String(msg.senderId) === String(user?._id);
                      const avatarSrc = isMine ? user?.profilePic : selectedUser?.profilePic;
                      const status = getMessageStatus(msg);
                      const replied = getReplyMessage(msg);

                      return (
                        <React.Fragment key={msg._id || `${msg.senderId}-${msg.createdAt}`}>
                          {shouldShowDateDivider && (
                            <div className="chat-date-separator">{currentDateLabel}</div>
                          )}
                          <div
                            className={`d-flex ${isMine ? "justify-content-end" : "justify-content-start"} mb-2`}
                          >
                            {!isMine && (
                              <div className="me-2" style={{ alignSelf: "flex-end" }}>
                                {renderAvatar(avatarSrc, selectedUser?.username, 32)}
                              </div>
                            )}

                          <div className={isMine ? "chat-bubble sent" : "chat-bubble received"}>
                            {replied && (
                              <div className="reply-preview-box">
                                <div className="reply-label">Reply</div>
                                <div className="reply-text">{replied.text || "Attachment"}</div>
                              </div>
                            )}

                            {editingMessageId === msg._id ? (
                              <div className="d-flex gap-2 align-items-center">
                                <input
                                  className="form-control form-control-sm"
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                />
                                <button className="btn btn-sm btn-success" onClick={handleSaveEdit}>
                                  Save
                                </button>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    setEditingMessageId(null);
                                    setEditText("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                {msg.text && <div>{msg.text}</div>}

                                {msg.fileUrl && (
                                  <div className="mt-2">
                                    {msg.fileType?.startsWith("image") ? (
                                      <img
                                        src={msg.fileUrl}
                                        alt={msg.fileName || "shared"}
                                        style={{ maxWidth: "220px", borderRadius: "10px" }}
                                      />
                                    ) : (
                                      <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                        {msg.fileName || "Download file"}
                                      </a>
                                    )}
                                  </div>
                                )}

                                {msg.image && (
                                  <div className="mt-2">
                                    <img
                                      src={msg.image}
                                      alt="shared"
                                      style={{ maxWidth: "220px", borderRadius: "10px" }}
                                    />
                                  </div>
                                )}

                                <div className="message-meta-row">
                                  <span>{msg.createdAt ? formatTime(msg.createdAt) : ""}</span>
                                  {msg.edited && <span className="ms-1">edited</span>}
                                  {isMine && (
                                    <span className={`ms-2 status-tick ${status}`}>
                                      {status === "seen" ? "\u2713\u2713" : status === "delivered" ? "\u2713\u2713" : "\u2713"}
                                    </span>
                                  )}
                                </div>

                                {!msg.deleted && (
                                  <div className={`d-flex gap-2 mt-1 small message-actions ${isMine ? "mine" : "other"}`}>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 text-decoration-none chat-action-btn"
                                      onClick={() => setReplyTo(msg)}
                                    >
                                      ↩ Reply
                                    </button>
                                    {isMine && (
                                      <>
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm p-0 text-decoration-none chat-action-btn"
                                          onClick={() => handleStartEdit(msg)}
                                        >
                                          ✎ Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-link btn-sm p-0 text-decoration-none chat-action-btn delete"
                                          onClick={() => handleDeleteMessage(msg._id)}
                                        >
                                          🗑 Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                            {isMine && (
                              <div className="ms-2" style={{ alignSelf: "flex-end" }}>
                                {renderAvatar(avatarSrc, user?.name, 32)}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                <div className="p-2 border-top bg-light-subtle">
                  {replyTo && (
                    <div className="reply-composer d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <div className="small fw-bold">
                          Replying to{" "}
                          {String(replyTo.senderId) === String(user?._id) ? "yourself" : selectedUser.username}
                        </div>
                        <div className="small text-muted text-truncate" style={{ maxWidth: "500px" }}>
                          {replyTo.text || "Attachment"}
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setReplyTo(null)}>
                        Cancel
                      </button>
                    </div>
                  )}

                  {attachment && (
                    <div className="d-flex align-items-center gap-2 mb-2">
                      {attachment.kind === "photo" && attachment.url && (
                        <img src={attachment.url} alt="preview" className="attachment-preview-thumb" />
                      )}
                      <span className="small">{attachment.name}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => {
                          setAttachment(null);
                          setFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                          if (photoInputRef.current) photoInputRef.current.value = "";
                          if (videoInputRef.current) videoInputRef.current.value = "";
                          if (audioInputRef.current) audioInputRef.current.value = "";
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <div className="input-group">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                    >
                      Emoji
                    </button>

                    <input
                      type="text"
                      className="form-control"
                      placeholder="Type message..."
                      value={message}
                      onChange={(e) => handleMessageChange(e.target.value)}
                    />

                    <div className="position-relative">
                      <button
                        type="button"
                        className="btn btn-secondary mb-0"
                        onClick={() => setShowAttachOptions((prev) => !prev)}
                      >
                        Attach
                      </button>
                      {showAttachOptions && (
                        <div
                          className="card p-2"
                          style={{
                            position: "absolute",
                            bottom: "40px",
                            left: 0,
                            zIndex: 1000,
                            minWidth: 130,
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-light w-100 mb-1"
                            onClick={() => photoInputRef.current?.click()}
                          >
                            Photo
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light w-100 mb-1"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            File
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light w-100 mb-1"
                            onClick={() => videoInputRef.current?.click()}
                          >
                            Video
                          </button>
                          <button type="button" className="btn btn-sm btn-light w-100" onClick={() => audioInputRef.current?.click()}>
                            Audio
                          </button>
                        </div>
                      )}
                    </div>

                    <button className="btn btn-primary" onClick={() => handleSend()} disabled={sending}>
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>

                  {showEmojiPicker && (
                    <div className="emoji-picker-panel mt-2">
                      {emojiList.map((emoji) => (
                        <button
                          type="button"
                          key={emoji}
                          className="emoji-btn"
                          onClick={() => {
                            handleMessageChange(message + emoji);
                            setShowEmojiPicker(false);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {sendError && <div className="text-danger small mt-1">{sendError}</div>}
                  {uploadProgress > 0 && uploadProgress < 1 && (
                    <div className="progress w-50 mt-2" style={{ height: "0.6rem" }}>
                      <div
                        className="progress-bar"
                        role="progressbar"
                        style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                        aria-valuenow={Math.round(uploadProgress * 100)}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                  )}

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

      {callState.active && (
        <div className="call-overlay">
          <div className="call-card">
            <h5 className="mb-1 text-capitalize">{callState.type} call</h5>
            <p className="mb-2">With {selectedUser?.username}</p>
            <div className="call-screen mb-3">
              {callState.type === "video" && callState.videoEnabled
                ? "Video stream preview"
                : "Audio call in progress"}
            </div>
            <div className="d-flex justify-content-center gap-2">
              <button
                className="btn btn-warning btn-sm"
                onClick={() => setCallState((prev) => ({ ...prev, muted: !prev.muted }))}
              >
                {callState.muted ? "Unmute" : "Mute"}
              </button>
              {callState.type === "video" && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setCallState((prev) => ({ ...prev, videoEnabled: !prev.videoEnabled }))
                  }
                >
                  {callState.videoEnabled ? "Camera Off" : "Camera On"}
                </button>
              )}
              <button className="btn btn-danger btn-sm" onClick={endCall}>
                End
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
