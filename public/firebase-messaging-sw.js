importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyBV5kVoe0CaF1V0ymmMp5u3gH7Cuw46SGQ",
  authDomain:        "solarradar-8882e.firebaseapp.com",
  projectId:         "solarradar-8882e",
  storageBucket:     "solarradar-8882e.firebasestorage.app",
  messagingSenderId: "1017230591284",
  appId:             "1:1017230591284:web:79567a12cb9722f841d161",
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
