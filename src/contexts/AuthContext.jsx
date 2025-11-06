import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const response = await axios.get(`${api}/auth/verify`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (response.data.valid) {
            setUser(response.data.admin);
          } else {
            logout();
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [token, api]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${api}/auth/login`, {
        email,
        password
      });

      const { token: newToken, admin } = response.data;
      
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(admin);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const sendInvite = async (email) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post(
        `${api}/auth/send-invite`,
        { email },
        { headers }
      );
      
      return { success: true, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to send invitation' 
      };
    }
  };

  const signup = async (name, email, password, invitationCode) => {
    try {
      const response = await axios.post(`${api}/auth/signup`, {
        name,
        email,
        password,
        invitationCode
      });
      // auto login after successful signup
      const loginRes = await axios.post(`${api}/auth/login`, { email, password });
      const { token: newToken, admin } = loginRes.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(admin);
      return { success: true, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Signup failed' 
      };
    }
  };

  const updateSalePaymentStatus = async (saleId, paymentStatus) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.put(`${api}/sales/${saleId}/payment`, { paymentStatus }, { headers });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Failed to update status' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    sendInvite,
    signup,
    updateSalePaymentStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

