import { useCallback, useEffect, useRef, useState } from "react";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { app, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const LS_ENABLED = "pushNotificationsEnabled";

function getPermissionState() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // default  granted   denied
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState(getPermissionState);
  const [enabled, setEnabled] = useState(() => localStorage.getItem(LS_ENABLED) === "true");
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const messagingRef = useRef(null);

  // FCM perziura
  useEffect(() => {
    isSupported().then(setSupported);
  }, []);

  // Nuskaito visor permission kai user grysta i praita page po settings keitimu
  useEffect(() => {
    const onFocus = () => {
      const p = getPermissionState();
      setPermission(p);
      if (p !== "default") setDismissed(false);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Naudota permission API listeneri pakeist permission
  //                                                padaryti loading page nukreipim1 !!!
  useEffect(() => {
    if (!navigator.permissions) return;
    let permStatus;
    navigator.permissions.query({ name: "notifications" }).then((s) => {
      permStatus = s;
      s.onchange = () => setPermission(getPermissionState());
    }).catch(() => {});
    return () => { if (permStatus) permStatus.onchange = null; };
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
    setDismissed(false);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "default") {
        setDismissed(true);
        return false;
      }
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

  // Stackoverlow foreground notifications !
  useEffect(() => {
    if (!enabled || !user) return;
    let unsub = null;
    (async () => {
      const msg = await getMsg();
      if (!msg) return;
      unsub = onMessage(msg, (payload) => {
        if (Notification.permission !== "granted") return;
        const truncate = (s, max) => typeof s === "string" ? s.slice(0, max) : "";
        const title = truncate(payload.notification?.title, 100) || "SolarRadar";
        const body  = truncate(payload.notification?.body,  200);
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag:  truncate(payload.data?.reportId, 64) || "solarradar",
        });
      });
    })();
    return () => unsub?.();
  }, [enabled, user, getMsg]);

  return { supported, permission, enabled, loading, dismissed, enable, disable, toggle };
}
