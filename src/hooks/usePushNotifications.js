import { useCallback, useEffect, useRef, useState } from "react";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { app, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const LS_ENABLED = "pushNotificationsEnabled";

function getPermissionState() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState(getPermissionState);
  const [enabled, setEnabled] = useState(() => localStorage.getItem(LS_ENABLED) === "true");
  const [loading, setLoading] = useState(false);
  const messagingRef = useRef(null);

  // Check FCM support once on mount
  useEffect(() => {
    isSupported().then(setSupported);
  }, []);

  const getMsg = useCallback(async () => {
    if (messagingRef.current) return messagingRef.current;
    if (!(await isSupported())) return null;
    messagingRef.current = getMessaging(app);
    return messagingRef.current;
  }, []);

  const getCurrentToken = useCallback(async () => {
    const msg = await getMsg();
    if (!msg) return null;
    try {
      return await getToken(msg, { vapidKey: VAPID_KEY });
    } catch {
      return null;
    }
  }, [getMsg]);

  const enable = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const token = await getCurrentToken();
      if (token && user) {
        await updateDoc(doc(db, "users", user.uid), { fcmTokens: arrayUnion(token) });
      }
      localStorage.setItem(LS_ENABLED, "true");
      setEnabled(true);
      return true;
    } catch (e) {
      console.error("[FCM] enable failed:", e);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, getCurrentToken]);

  const disable = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getCurrentToken();
      if (token && user) {
        await updateDoc(doc(db, "users", user.uid), { fcmTokens: arrayRemove(token) });
      }
    } catch {}
    localStorage.setItem(LS_ENABLED, "false");
    setEnabled(false);
    setLoading(false);
  }, [user, getCurrentToken]);

  const toggle = useCallback(() => {
    if (enabled) return disable();
    return enable();
  }, [enabled, enable, disable]);

  // Show foreground notifications (tab is open and focused)
  useEffect(() => {
    if (!enabled || !user) return;
    let unsub = null;
    (async () => {
      const msg = await getMsg();
      if (!msg) return;
      unsub = onMessage(msg, (payload) => {
        if (Notification.permission !== "granted") return;
        const title = payload.notification?.title || "SolarRadar";
        const body  = payload.notification?.body  || "";
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag:  payload.data?.reportId || "solarradar",
        });
      });
    })();
    return () => unsub?.();
  }, [enabled, user, getMsg]);

  return { supported, permission, enabled, loading, enable, disable, toggle };
}
