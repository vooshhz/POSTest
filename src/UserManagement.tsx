import { api } from './api/apiLayer';
import { useState, useEffect } from "react";
import "./UserManagement.css";

interface User {
  id: number;
  username: string;
  role: string;
  full_name: string;
  active: number;
  created_at: string;
  last_login: string | null;
}

interface UserManagementProps {
  currentUser: any;
  onUserUpdate: () => void;
}

export default function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    pin: "",
    confirmPin: "",
    fullName: "",
    role: "cashier"
  });

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await api.getUsers();
      if (result.success && result.users) {
        setUsers(result.users);
      } else {
        setError(result.error || "Failed to load users");
      }
    } catch (err) {
      setError("Error loading users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.fullName) {
      setError("Please fill in all required fields");
      return;
    }

    // Validate based on role
    if (newUser.role === 'cashier') {
      if (!newUser.pin) {
        setError("Please enter a 4-digit PIN for cashier");
        return;
      }
      if (newUser.pin !== newUser.confirmPin) {
        setError("PINs do not match");
        return;
      }
      if (newUser.pin.length !== 4 || !/^\d{4}$/.test(newUser.pin)) {
        setError("PIN must be exactly 4 digits");
        return;
      }
    } else {
      // Admin or Manager
      if (!newUser.password) {
        setError("Please enter a password");
        return;
      }
      if (newUser.password !== newUser.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (newUser.password.length < 4) {
        setError("Password must be at least 4 characters");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const userData: any = {
        username: newUser.username,
        role: newUser.role,
        fullName: newUser.fullName
      };

      if (newUser.role === 'cashier') {
        userData.pin = newUser.pin;
      } else {
        userData.password = newUser.password;
      }

      const result = await api.addUser(userData);

      if (result.success) {
        setShowAddUser(false);
        setNewUser({
          username: "",
          password: "",
          confirmPassword: "",
          pin: "",
          confirmPin: "",
          fullName: "",
          role: "cashier"
        });
        await loadUsers();
      } else {
        setError(result.error || "Failed to add user");
      }
    } catch (err) {
      setError("Error adding user");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId: number, username: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove user "${username}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const result = await api.removeUser(userId);
      if (result.success) {
        await loadUsers();
      } else {
        setError(result.error || "Failed to remove user");
      }
    } catch (err) {
      setError("Error removing user");
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="user-management">
        <div className="login-required">
          <h3>Login Required</h3>
          <p>Please log in to access user management.</p>
        </div>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="user-management">
        <div className="access-denied">
          <h3>Access Denied</h3>
          <p>Only administrators can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="user-management-header">
        <h3>User Management</h3>
        <button 
          className="btn-add-user"
          onClick={() => setShowAddUser(!showAddUser)}
          disabled={loading}
        >
          {showAddUser ? "Cancel" : "Add User"}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {showAddUser && (
        <div className="add-user-form">
          <h4>Add New User</h4>
          <div className="form-grid">
            <div className="form-group">
              <label>Username *</label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                placeholder="Enter username"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                value={newUser.fullName}
                onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                placeholder="Enter full name"
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Role *</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value, password: "", confirmPassword: "", pin: "", confirmPin: ""})}
                disabled={loading}
              >
                <option value="cashier">Cashier</option>
                <option value="manager">Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            
            {/* Password fields for Admin/Manager */}
            {(newUser.role === 'admin' || newUser.role === 'manager') && (
              <>
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    placeholder="Enter password"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    value={newUser.confirmPassword}
                    onChange={(e) => setNewUser({...newUser, confirmPassword: e.target.value})}
                    placeholder="Confirm password"
                    disabled={loading}
                  />
                </div>
              </>
            )}
            
            {/* PIN fields for Cashier */}
            {newUser.role === 'cashier' && (
              <>
                <div className="form-group">
                  <label>4-Digit PIN *</label>
                  <input
                    type="text"
                    value={newUser.pin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setNewUser({...newUser, pin: value});
                    }}
                    placeholder="Enter 4-digit PIN"
                    maxLength={4}
                    pattern="\d{4}"
                    disabled={loading}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm PIN *</label>
                  <input
                    type="text"
                    value={newUser.confirmPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setNewUser({...newUser, confirmPin: value});
                    }}
                    placeholder="Confirm 4-digit PIN"
                    maxLength={4}
                    pattern="\d{4}"
                    disabled={loading}
                  />
                </div>
              </>
            )}
          </div>
          <div className="form-actions">
            <button 
              className="btn-primary"
              onClick={handleAddUser}
              disabled={loading}
            >
              Create User
            </button>
            <button 
              className="btn-secondary"
              onClick={() => setShowAddUser(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="users-list">
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Full Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  {user.username}
                  {user.id === currentUser.id && (
                    <span className="current-badge">Current</span>
                  )}
                </td>
                <td>{user.full_name}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${user.active ? 'active' : 'inactive'}`}>
                    {user.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  {user.last_login 
                    ? new Date(user.last_login).toLocaleString()
                    : 'Never'
                  }
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  {user.id !== currentUser.id && user.username !== 'admin' && (
                    <button
                      className="btn-remove"
                      onClick={() => handleRemoveUser(user.id, user.username)}
                      disabled={loading}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}