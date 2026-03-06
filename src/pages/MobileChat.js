import React, { useCallback, useContext, useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { io } from "socket.io-client";

function MobileChat() {
  const API = "http://localhost:5000/api";
  const SOCKET_URL = "http://localhost:5000";

  const { username } = useParams();
  const navigate = useNavigate();
  const { user, users, token, refreshUsers } = useContext(AuthContext);

  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sendError, setSendError] = useState("");

  // avatar helper copied from Chat.js
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

  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);
  const refreshUsersTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const scheduleUsersRefresh = useCallback((delay = 250) => {
    if (!refreshUsers) return;
    if (refreshUsersTimerRef.current) clearTimeout(refreshUsersTimerRef.current);
    refreshUsersTimerRef.current = setTimeout(() => {
      refreshUsers?.();
      refreshUsersTimerRef.current = null;
    }, delay);
  }, [refreshUsers]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // refresh user list when token available
  useEffect(() => {
    if (!token) return;
    scheduleUsersRefresh(0);
  }, [token, scheduleUsersRefresh]);

  // compute selected user from context list
  useEffect(() => {
    if (users && username) {
      const found = users.find((u) => u.name === username);
      if (found) {
        setSelectedUser({
          id: found._id,
          username: found.name,
          profilePic: found.profilePic,
        });
      } else {
        setSelectedUser(null);
      }
    }
  }, [users, username]);

  // socket setup (similar to Chat.js)
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

    socket.on("onlineUsers", (ids) => {
      setOnlineUserIds(Array.isArray(ids) ? ids : []);
    });

    socket.on("newMessage", (newMessage) => {
      const currentSelected = selectedUserRef.current;
      if (
        currentSelected &&
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
              }
            : prev
        );
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (refreshUsersTimerRef.current) clearTimeout(refreshUsersTimerRef.current);
    };
  }, [user?._id, scheduleUsersRefresh]);

  // load messages when selectedUser changes
  useEffect(() => {
    if (!selectedUser || !token) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`${API}/messages/${selectedUser.id}`, {
          headers: { Authorization: token },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load messages");
        setMessages(data.messages || []);
        scheduleUsersRefresh(250);
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();

    // clear draft state when switching
    setMessage("");
    setFile(null);
    setUploadProgress(0);
    setSending(false);
  }, [selectedUser, token, scheduleUsersRefresh]);

  const handleFileChange = (e) => {
    setSendError("");
    const selected = e.target.files[0];
    if (!selected) return;
    if (!(selected instanceof Blob)) {
      setSendError("Selected attachment is invalid. Please choose again.");
      return;
    }
    setFile(selected);
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

  const handleSend = () => {
    setSendError("");
    if ((!message && !file) || !selectedUser || !token) return;

    setSending(true);
    setUploadProgress(0);

    if (file) {
      const form = new FormData();
      form.append("text", message || "");
      form.append("file", file, file.name);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API}/messages/send/${selectedUser.id}`);
      xhr.setRequestHeader("Authorization", token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        try {
          const data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          if (xhr.status >= 400) throw new Error(data.message || "Failed to send message");
          const newMsg = data.newMessage;
          if (!newMsg) throw new Error("Upload finished, but no message was returned.");
          setMessages((prev) => [...prev, newMsg]);
          setMessage("");
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          scheduleUsersRefresh(120);
        } catch (err) {
          console.warn(err);
          setSendError(err.message || "Unable to send file");
        } finally {
          setSending(false);
          setUploadProgress(0);
        }
      };
      xhr.onerror = () => {
        console.warn("Upload error");
        setSendError("Network error uploading file");
        setSending(false);
        setUploadProgress(0);
      };
      xhr.send(form);
    } else {
      const send = async () => {
        setSending(true);
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
          scheduleUsersRefresh(120);
        } catch (err) {
          console.warn(err);
          setSendError(err.message || "Unable to send message");
        } finally {
          setSending(false);
        }
      };
      send();
    }
  };

  return (
    <div className="chat-bg vh-100 d-flex flex-column">
      {/* header */}
      <div className="bg-primary text-white p-3 d-flex align-items-center">
        <button
          className="btn btn-light btn-sm me-3"
          onClick={() => navigate("/chat")}
        >
          {"<-"}
        </button>
        {renderAvatar(selectedUser?.profilePic, selectedUser?.username, 40)}
        <div>
          <h6 className="m-0">{selectedUser?.username || username}</h6>
          <small className="text-light">
            {onlineUserIds.includes(selectedUser?.id) ? "Online" : "Offline"}
          </small>
        </div>
      </div>

      {/* messages */}
      <div className="flex-grow-1 p-3 chat-scroll">
        {loadingMessages ? (
          <div className="text-center text-muted">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted">No messages yet.</div>
        ) : (
          messages.map((msg, i) => {
            const currentDateLabel = formatDateSeparator(msg.createdAt);
            const prevDateLabel =
              i > 0 ? formatDateSeparator(messages[i - 1]?.createdAt) : "";
            const shouldShowDateDivider = currentDateLabel && currentDateLabel !== prevDateLabel;
            const isMine = String(msg.senderId) === String(user?._id);
            return (
              <React.Fragment key={msg._id || `${msg.senderId}-${msg.createdAt || i}`}>
                {shouldShowDateDivider && (
                  <div className="chat-date-separator">{currentDateLabel}</div>
                )}
                <div
                  className={`d-flex ${isMine ? "justify-content-end" : "justify-content-start"
                    } mb-2`}
                >
                  <div
                    className={isMine ? "chat-bubble sent" : "chat-bubble received"}
                  >
                    {msg.text}
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
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* input */}
      <div className="input-group p-2">
        <input
          type="text"
          className="form-control"
          placeholder="Type message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <label className="btn btn-secondary mb-0">
          Attach
          <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
        </label>
        {file && (
          <span className="ms-2 text-white" style={{ fontSize: '0.9rem' }}>{file.name}</span>
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
        <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
      {sendError && <div className="text-danger small px-2 pb-2">{sendError}</div>}
    </div>
  );
}

export default MobileChat;
