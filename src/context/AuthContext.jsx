// src/frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import api, { setAuthToken } from "../shared/api";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // State ni localStorage'dan o'qimay, null bilan boshlash
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authStage, setAuthStage] = useState("anonymous");
  const [isLoading, setIsLoading] = useState(true);

  // Sahifa yuklanganda localStorage'dan ma'lumotlarni yuklash (faqat bir marta)
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    const savedAuthStage = localStorage.getItem("authStage");

    if (savedToken) {
      setToken(savedToken);
      setAuthToken(savedToken);
    }
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    if (savedAuthStage && savedAuthStage !== "anonymous") {
      setAuthStage(savedAuthStage);
    }
    
    // Loading tugadi, endi UI ni render qil
    setIsLoading(false);
  }, []);

  // Token o'zgarsa localStorage'ga saqla
  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }

    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [token, user]);

  // AuthStage o'zgarsa localStorage'ga saqla
  useEffect(() => {
    if (authStage && authStage !== "anonymous") {
      localStorage.setItem("authStage", authStage);
    } else {
      localStorage.removeItem("authStage");
    }
  }, [authStage]);

  // LOGIN FUNKSIYA
  const login = async (username, password) => {
    const res = await api.post("/auth/login", { username, password });

    setToken(res?.data?.token);
    setUser(res?.data?.user);

    api.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
    setAuthStage("password");

    return res.data;
  };

  // LOGOUT FUNKSIYA
  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthStage("anonymous");
    delete api.defaults.headers.common["Authorization"];
  };

  // PIN LOGIN FUNKSIYA
  const pinLogin = async (userId, pin) => {
    const res = await api.post("/auth/login-pin", { userId, pin });
    setToken(res?.data?.token);
    setUser(res?.data?.user);
    api.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
    setAuthStage("pin");
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ token, user, authStage, isLoading, login, pinLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
