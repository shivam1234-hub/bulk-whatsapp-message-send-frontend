import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";

import { Editor } from 'primereact/editor';


import "./App.css";

const App = () => {
  const [qrCode, setQrCode] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("Hello! 🚀");
  const [contacts, setContacts] = useState([]);
  const [userId, setUserId] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Generate or retrieve userId on component mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("whatsapp_user_id");
    if (storedUserId) {
      setUserId(storedUserId);
      initializeSession(storedUserId);
    } else {
      const newUserId = `user_${Date.now()}`;
      localStorage.setItem("whatsapp_user_id", newUserId);
      setUserId(newUserId);
      initializeSession(newUserId);
    }
  }, []);

  function htmlToFormat(html) {
    console.log(html);
    const codes = { B: "*", STRONG: "*", I: "_", EM: "_", STRIKE: "~" }; // Ensuring all format tags are covered
    const { body } = new DOMParser().parseFromString(html, "text/html");

    let lastTag = null; // Keep track of the last tag type

    const dfs = ({ childNodes }) => Array.from(childNodes, node => {
      if (node.nodeType === 1) { // Element node
        if (node.tagName === "BR") {
          return "\n"; // Handle line breaks
        }
        if (node.tagName === "P") {
          let content = dfs(node).trim();
          let result = content;

          // Handle different paragraph scenarios
          if (lastTag === "P") {
            result = "\n" + content; // New line without extra space
          }
          lastTag = "P"; // Update last tag

          return result + "\n"; // Ensure proper spacing
        }

        const s = dfs(node);
        const code = codes[node.tagName];
        return code ? `${code}${s}${code}` : s; // Apply formatting codes correctly
      } else { // Text node
        return node.textContent;
      }
    }).join("").replace(/\n{3,}/g, "\n\n").trim(); // Clean up excessive newlines

    return dfs(body);
  }



  // Initialize WhatsApp session
  const initializeSession = async (currentUserId) => {
    try {
      await fetch("http://localhost:5000/init-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      startPollingQR(currentUserId);
    } catch (error) {
      toast.error("Failed to initialize session");
    }
  };

  // Poll for QR code or authentication status
  const startPollingQR = (currentUserId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:5000/qr/${currentUserId}`);
        const data = await response.json();

        if (data.status === "authenticated") {
          setIsAuthenticated(true);
          setQrCode("");
          clearInterval(interval);
          toast.success("WhatsApp connected successfully!");
        } else if (data.status === "not_authenticated" && data.qr) {
          setQrCode(data.qr);
        }
      } catch (error) {
        console.error("Error polling QR:", error);
      }
    }, 1000);

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  };

  const handleFileUpload = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUploadSubmit = async () => {
    if (!file) return toast.error("Please upload a file!");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`http://localhost:5000/upload/${userId}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setContacts(data.contacts);
      toast.success(`Uploaded ${data.contacts.length} contacts`);
    } catch (error) {
      toast.error("Failed to upload contacts");
    }
  };

  const handleSendMessages = async () => {

    if (!contacts.length) return toast.error("No contacts uploaded!");
    if (!message.trim()) return toast.error("Please enter a message!");

    try {
      const response = await fetch(`http://localhost:5000/send/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts, message: htmlToFormat(message) }),
      });

      const data = await response.json();
      toast.success(`Messages sent to ${data.count} contacts!`);
    } catch (error) {
      toast.error("Failed to send messages");
    }
  };

  return (
      <div className="container">
        <Toaster />
        <div className="card">
          <h2>WhatsApp Bulk Sender</h2>

          {isAuthenticated ? (
              <div className="status-badge success">WhatsApp Connected</div>
          ) : qrCode ? (
              <div className="qr-container">
                <img src={qrCode} alt="QR Code" className="qr-code" />
                <p>Scan this QR code with WhatsApp</p>
              </div>
          ) : (
              <div className="status-badge loading">
                Initializing WhatsApp...
              </div>
          )}

          <div className="input-group">
            <label className="file-input-label">
              Upload CSV File
              <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".csv"
                  disabled={!isAuthenticated}
              />
            </label>
            <button
                onClick={handleUploadSubmit}
                disabled={!isAuthenticated || !file}
                className="upload-btn"
            >
              Upload Contacts
            </button>
          </div>

          {contacts.length > 0 && (
              <div className="contacts-info">
                {contacts.length} contacts loaded
              </div>
          )}

          <Editor value={message} onTextChange={(e) => setMessage(e.htmlValue)} style={{ height: '320px' }} />

          {/*<textarea*/}
          {/*    value={message}*/}
          {/*    onChange={(e) => setMessage(e.target.value)}*/}
          {/*    placeholder="Enter your message here..."*/}
          {/*    rows="4"*/}
          {/*    disabled={!isAuthenticated}*/}
          {/*    className="message-input"*/}
          {/*/>*/}

          <button
              onClick={handleSendMessages}
              disabled={!isAuthenticated || !contacts.length}
              className="send-btn"
          >
            Send Messages
          </button>
        </div>
      </div>
  );
};

export default App;