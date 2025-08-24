import { api } from './api/apiLayer';
import { useState, useRef, useEffect } from "react";
import "./Login.css";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  storeName?: string;
}

export default function Login({ onLoginSuccess, storeName }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showPinPad, setShowPinPad] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus username field when showing username input
    if (!showPasswordField && !showPinPad) {
      setTimeout(() => {
        if (usernameRef.current) {
          usernameRef.current.focus();
        }
      }, 100);
    }
    
    // Update clock every second
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Update window title with store name
    if (storeName) {
      document.title = `${storeName} - POS Login`;
    }

    return () => {
      clearInterval(clockTimer);
    };
  }, [storeName, showPasswordField, showPinPad]);

  const handleUsernameSubmit = async () => {
    if (!username) {
      setError("Please enter username");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await api.checkUserType(username);
      
      if (result.success) {
        setUserRole(result.role || null);
        if (result.requiresPin) {
          setShowPinPad(true);
          setShowPasswordField(false);
        } else if (result.requiresPassword) {
          setShowPasswordField(true);
          setShowPinPad(false);
          setTimeout(() => passwordRef.current?.focus(), 100);
        }
      } else {
        setError(result.error || "User not found");
      }
    } catch (err) {
      setError("Failed to check user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!password) {
      setError("Please enter password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await api.userLogin(username, password);
      
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error || "Invalid password");
        setPassword("");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (pinValue?: string) => {
    const pinToSubmit = pinValue || pin;
    
    if (pinToSubmit.length !== 4) {
      setError("Please enter 4-digit PIN");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await api.userLoginPin(username, pinToSubmit);
      
      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setError(result.error || "Invalid PIN");
        setPin("");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const handlePinPadClick = (digit: string) => {
    if (digit === 'C') {
      setPin("");
    } else if (digit === '⌫') {
      setPin(prev => prev.slice(0, -1));
    } else if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      
      // Auto-submit when 4 digits are entered
      if (newPin.length === 4) {
        setTimeout(() => handlePinSubmit(newPin), 100);
      }
    }
  };

  // Handle keyboard input for PIN pad
  useEffect(() => {
    if (!showPinPad) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle number keys (both numpad and regular)
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        if (pin.length < 4) {
          const newPin = pin + e.key;
          setPin(newPin);
          
          // Auto-submit when 4 digits are entered
          if (newPin.length === 4) {
            setTimeout(() => {
              handlePinSubmit(newPin);
            }, 100);
          }
        }
      }
      // Handle backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(prev => prev.slice(0, -1));
      }
      // Handle delete/clear
      else if (e.key === 'Delete' || e.key === 'Escape') {
        e.preventDefault();
        setPin("");
      }
      // Handle Enter
      else if (e.key === 'Enter' && pin.length === 4) {
        e.preventDefault();
        handlePinSubmit(pin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPinPad, pin]);

  const handleReset = () => {
    setUsername("");
    setPassword("");
    setPin("");
    setUserRole(null);
    setShowPinPad(false);
    setShowPasswordField(false);
    setError("");
    setLoading(false);
    
    // Simple focus after reset
    setTimeout(() => {
      if (usernameRef.current) {
        usernameRef.current.focus();
      }
    }, 50);
  };

  const handleUsernameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !showPasswordField && !showPinPad) {
      handleUsernameSubmit();
    }
  };

  const handlePasswordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePasswordSubmit();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="bg-gradient"></div>
      </div>
      
      <div className="login-content">
        <div className="login-box">
          <div className="login-header">
            {storeName && (
              <div className="store-name-badge">{storeName}</div>
            )}
            <h1 className="app-title">POS System</h1>
            <p className="app-subtitle">Point of Sale Management</p>
          </div>

          <div className="login-form">
            <h2>Sign In</h2>
            
            {error && (
              <div className="login-error">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            {/* Username Input */}
            {!showPasswordField && !showPinPad && (
              <>
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    ref={usernameRef}
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={handleUsernameKeyPress}
                    onClick={(e) => {
                      e.currentTarget.focus();
                      e.currentTarget.select();
                    }}
                    onFocus={(e) => {
                      e.currentTarget.select();
                    }}
                    placeholder="Enter your username"
                    autoComplete="username"
                    className="login-input"
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUsernameSubmit}
                  disabled={!username}
                  className="login-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Checking...
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
              </>
            )}

            {/* Password Input for Admin/Manager */}
            {showPasswordField && (
              <>
                <div className="user-info-display">
                  <span className="username-display">{username}</span>
                  <span className="role-badge">{userRole}</span>
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="password-input-wrapper">
                    <input
                      ref={passwordRef}
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handlePasswordKeyPress}
                      placeholder="Enter your password"
                      disabled={false}
                      autoComplete="current-password"
                      className="login-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="password-toggle"
                      tabIndex={-1}
                    >
                      {showPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePasswordSubmit}
                  disabled={!password}
                  className="login-button"
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="back-button"
                  disabled={false}
                >
                  Back
                </button>
              </>
            )}

            {/* PIN Pad for Cashiers */}
            {showPinPad && (
              <>
                <div className="user-info-display">
                  <span className="username-display">{username}</span>
                  <span className="role-badge cashier">Cashier</span>
                </div>

                <div className="pin-display">
                  <label>Enter PIN</label>
                  <div className="pin-dots">
                    {[0, 1, 2, 3].map((i) => (
                      <div 
                        key={i} 
                        className={`pin-dot ${pin.length > i ? 'filled' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="pin-hint">Use number pad or click buttons below</div>
                </div>

                <div className="pin-pad">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handlePinPadClick(digit)}
                      className={`pin-button ${digit === 'C' ? 'clear' : digit === '⌫' ? 'backspace' : ''}`}
                      disabled={false}
                    >
                      {digit}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="back-button"
                  disabled={false}
                >
                  Back
                </button>
              </>
            )}

            {!showPasswordField && !showPinPad && (
              <div className="login-help">
                <p>Default credentials:</p>
                <code>Username: admin | Password: admin</code>
              </div>
            )}
          </div>

          <div className="login-footer">
            <div className="clock-display">
              <div className="time">{formatTime(currentTime)}</div>
              <div className="date">{formatDate(currentTime)}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}