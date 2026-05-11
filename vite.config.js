import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

function fcmServiceWorkerPlugin() {
  return {
    name: "fcm-service-worker",
    apply: "serve",
    configResolved(config) {
      generateSW(config.env);
    },
  };
}

function fcmServiceWorkerBuildPlugin() {
  return {
    name: "fcm-service-worker-build",
    apply: "build",
    configResolved(config) {
      generateSW(config.env);
    },
  };
}

function generateSW(env) {
  const content = `\
importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "${env.VITE_FIREBASE_API_KEY}",
  authDomain:        "${env.VITE_FIREBASE_AUTH_DOMAIN}",
  projectId:         "${env.VITE_FIREBASE_PROJECT_ID}",
  storageBucket:     "${env.VITE_FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${env.VITE_FIREBASE_MESSAGING_SENDER_ID}",
  appId:             "${env.VITE_FIREBASE_APP_ID}",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "SolarRadar";
  const body  = payload.notification?.body  || "";
  self.registration.showNotification(title, {
    body,
    icon:  "/favicon.ico",
    badge: "/favicon.ico",
    tag:   payload.data?.reportId || "solarradar",
    data:  { url: payload.fcmOptions?.link || "/reports" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/reports";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
`;

  try {
    mkdirSync(resolve(process.cwd(), "public"), { recursive: true });
    writeFileSync(resolve(process.cwd(), "public/firebase-messaging-sw.js"), content, "utf-8");
  } catch (e) {
    console.warn("[fcm-sw] Could not write service worker:", e.message);
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Patch env into the plugin (configResolved receives config.env which is VITE_ prefixed)
  // We use loadEnv so the generate runs even before config is fully resolved
  generateSW(env);

  return {
    plugins: [react(), fcmServiceWorkerPlugin(), fcmServiceWorkerBuildPlugin()],
  };
});
