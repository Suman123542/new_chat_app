import React, { useContext, useState, useEffect, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Chat() {
  const API = "http://localhost:5000/api";
  const [file, setFile] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const { user, users, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState([]);
const [showNotifications, setShowNotifications] = useState(false);

  const settingsRef = useRef();

  // Demo users (Previous style)
  const demoUsers = [
  {
    username: "Rahul",
    profilePic: "https://randomuser.me/api/portraits/men/11.jpg",
  },
  {
    username: "Priya",
    profilePic: "https://randomuser.me/api/portraits/women/12.jpg",
  },
  {
    username: "Amit",
    profilePic: "https://randomuser.me/api/portraits/men/13.jpg",
  },
  {
    username: "Sneha",
    profilePic: "https://randomuser.me/api/portraits/women/14.jpg",
  },
];

  // Merge demo + registered users
  const allUsers = [
    ...demoUsers,
    ...users.filter((u) => !demoUsers.some((d) => d.username === u.username)),
  ];

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
    if (selectedUser) {
      const chatKey1 = `${user.username}_${selectedUser.username}`;
      const chatKey2 = `${selectedUser.username}_${user.username}`;

      const stored =
        JSON.parse(localStorage.getItem(chatKey1)) ||
        JSON.parse(localStorage.getItem(chatKey2)) ||
        [];

      setMessages(stored);
    }
  }, [selectedUser, user.username]);

  // Send message
  const handleSend = () => {
  if ((!message && !file) || !selectedUser) return;

  const chatKey = `${user.username}_${selectedUser.username}`;

  const newMessage = {
    sender: user.username,
    text: message || "",
    file: file || null,
  };

  const updatedMessages = [...messages, newMessage];

  localStorage.setItem(chatKey, JSON.stringify(updatedMessages));
  setMessages(updatedMessages);
  setMessage("");
  setFile(null);

  };

  const handleLogout = () => {
    logout();
    navigate("/");
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
      <div className="mb-3">
        <img
          src={user.profilePic || "https://via.placeholder.com/120"}
          alt="profile"
          className="profile-image"
        />
      </div>

      <h4 className="mb-3">User Profile</h4>

      <p><strong>Username:</strong> {user.username}</p>
      <p><strong>Email:</strong> {user.email}</p>

      <button
        className="btn btn-primary w-100 mt-3"
        onClick={() => setShowProfile(false)}
      >
        Close
      </button>

    </div>
  </div>
)}

      <div className="container-fluid mt-3">
        <div className="row">
          {/* Users List */}
          <div className="col-12 col-md-3">
            <div className="card p-3 shadow">
              <h5>Users</h5>

              <ul className="list-group">
                {allUsers
                  .filter((u) => u.username !== user.username)
                  .map((u, i) => (
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
  <img
    src={u.profilePic || "https://via.placeholder.com/40"}
    alt="profile"
    className="rounded-circle me-2"
    width="40"
    height="40"
  />
  {u.username}
</li>
                  ))}
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
  {messages.map((msg, index) => (
    <div
      key={index}
      className={
        msg.sender === user.username
          ? "text-end mb-2"
          : "text-start mb-2"
      }
    >
      <div
        className={
          msg.sender === user.username
            ? "chat-bubble sent"
            : "chat-bubble received"
        }
      >
        {/* Text Message */}
        {msg.text && <div>{msg.text}</div>}

        {/* File Message */}
        {msg.file && (
          <div className="mt-2">
            {msg.file.type.startsWith("image") ? (
              <img
                src={msg.file.data}
                alt="shared"
                style={{ maxWidth: "200px", borderRadius: "10px" }}
              />
            ) : (
              <a
                href={msg.file.data}
                download={msg.file.name}
                className="btn btn-sm btn-light"
              >
                📎 {msg.file.name}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  ))}
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
    <input
      type="file"
      hidden
      onChange={handleFileChange}
    />
  </label>

  <button className="btn btn-primary" onClick={handleSend}>
    Send
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


