import React, { useContext, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

function MobileChat() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, users } = useContext(AuthContext);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  // 🔥 Demo Users
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

  // 🔥 Merge demo + registered users
  const allUsers = [
    ...demoUsers,
    ...users.filter(
      (u) => !demoUsers.some((d) => d.username === u.username)
    ),
  ];

  // ✅ Define selectedUser properly
  const selectedUser = allUsers.find(
    (u) => u.username === username
  );

  // 🔥 Load Messages
  useEffect(() => {
    if (!user) return;

    const key1 = `${user.username}_${username}`;
    const key2 = `${username}_${user.username}`;

    const stored =
      JSON.parse(localStorage.getItem(key1)) ||
      JSON.parse(localStorage.getItem(key2)) ||
      [];

    setMessages(stored);
  }, [username, user]);

  // 🔥 Send Message
  const handleSend = () => {
    if (!message) return;

    const key = `${user.username}_${username}`;

    const newMessage = {
      sender: user.username,
      text: message,
    };

    const updated = [...messages, newMessage];

    localStorage.setItem(key, JSON.stringify(updated));
    setMessages(updated);
    setMessage("");
  };

  return (
    <div className="chat-bg vh-100 d-flex flex-column">

      {/* Header */}
      <div className="bg-primary text-white p-3 d-flex align-items-center">

        {/* Back Button */}
        <button
          className="btn btn-light btn-sm me-3"
          onClick={() => navigate("/chat")}
        >
          ←
        </button>

        {/* Profile Image */}
        <img
          src={
            selectedUser?.profilePic ||
            "https://via.placeholder.com/40"
          }
          alt="profile"
          className="rounded-circle me-2"
          width="40"
          height="40"
        />

        {/* Username */}
        <div>
          <h6 className="m-0">{username}</h6>
          <small className="text-light">Online</small>
        </div>

      </div>

      {/* Messages */}
      <div className="flex-grow-1 p-3 chat-scroll">
        {messages.map((msg, i) => (
          <div
            key={i}
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
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="input-group p-2">
        <input
          type="text"
          className="form-control"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type message..."
        />
        <button className="btn btn-primary" onClick={handleSend}>
          Send
        </button>
      </div>

    </div>
  );
}

export default MobileChat;