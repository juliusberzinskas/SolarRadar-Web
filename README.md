SolarRadar — Web Admin

A maintenance and fault-registration system for solar power plants, built for a Lithuanian solar O&M company.

This repository contains the web administration panel. The companion Android app used by field technicians lives in a separate repository.

Built as my bachelor's thesis at Vilnius Business College (Programming and Internet Technologies), 2026.

The problem

Small solar O&M companies coordinate their field work on paper, in spreadsheets and over the phone. Jobs get assigned verbally, fault reports arrive as photos in a messaging app, and nobody has a single view of what is open, what is in progress and what was actually done on site.

I looked at what the market offers and found a gap. Monitoring platforms (SolarEdge, Fronius Solar.web, Meteocontrol) are strong on energy data and automated fault alerts, but have no job assignment, no technician management and no structured completion reports. General field-service platforms (ServiceMax) have the workflow tools but are not built for solar and are priced well beyond a small O&M operation.

SolarRadar covers the gap: site and equipment records, job assignment, real-time status tracking, and structured reports with photo evidence — in one system, for a team of a size that cannot justify enterprise software.

What it does

Dashboard — four live KPI cards (open jobs, in progress, resolved, active sites) with a priority-sorted recent jobs table. Updates without a page refresh.

Sites — solar plant records with address, region, operational status and installed capacity. Each site has four tabs: general information, mounting system details (panel type and count, inverter model, mounting type), a photo gallery, and its location on an OpenStreetMap map.

Jobs — the operational core. Create a job with type, priority, description and site, assign it to a technician, and it appears on that technician's phone within seconds. Filter by status, priority, site, date and assignee. Completed jobs are archived rather than deleted.

Reports — technician submissions with colour-coded outcome chips (green completed, red not completed, orange needs follow-up), free-text notes, and photos pulled from Firebase Storage. Admins can attach internal notes to any report.

Members — user administration. A super admin can grant or revoke admin rights, and the change takes effect immediately.

Bilingual UI — Lithuanian and English via i18next, with the choice persisted locally. No hardcoded strings anywhere in the interface.

Roles
Role	Access
Super admin	Everything, plus granting and revoking admin rights
Admin	Full web panel: sites, jobs, technician accounts, reports
Technician	Mobile app only — sees their own assigned jobs, nothing else

Roles are stored on the users/{uid} document and enforced through Firestore security rules, not only in the UI.

Tech stack
Layer	Choice
Frontend	React 19, Vite
UI	Material UI v7, MUI DataGrid
Routing	React Router DOM v7, with a guarded admin route
Auth	Firebase Authentication (email + password)
Database	Cloud Firestore (NoSQL, real-time)
Files	Firebase Storage
Server-side	Firebase Cloud Functions
Maps	OpenStreetMap
i18n	i18next (LT / EN)
Hosting	Firebase Hosting
Why this stack

The system needed real-time sync between a web panel and a mobile app, on a budget that ruled out running and maintaining a server.

Firebase was chosen over Supabase and a Node + PostgreSQL backend for one specific reason: Firestore's onSnapshot gives real-time synchronisation with no backend code at all. When a technician changes a job status in the field, the admin sees it in seconds. Auth, Storage and Cloud Functions being part of the same ecosystem meant both clients could connect to shared infrastructure without a REST API layer in between.

React over Vue mainly for MUI DataGrid, whose React support is the most mature — it does the heavy lifting for every list view in the app.

Architecture

Backend-as-a-Service. Both clients talk directly to Firebase; there is no custom server.

┌──────────────────┐         ┌──────────────────┐
│   Web admin      │         │   Android app    │
│ React 19 + Vite  │         │ Kotlin + Compose │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         └──────────┬─────────────────┘
                    │
         ┌──────────▼──────────┐
         │      Firebase       │
         │  Authentication     │
         │  Cloud Firestore    │
         │  Storage            │
         │  Cloud Functions    │
         └─────────────────────┘

Every list view subscribes through onSnapshot rather than polling. Listeners are unsubscribed in the React useEffect cleanup — each open listener costs Firestore reads, so leaving them attached is a real cost, not just untidy code.

Data model

Four Firestore collections:

users — name, email, role (superadmin | admin | technician), active, hiredAt, expertise, photoURL. Document ID matches the Firebase Auth UID.

sites — name, address, region, status (active | inactive | maintenance), capacityKw, location.lat/lng, and a mounting object holding panel type, panel count, inverter model and mounting type.

jobs — title, description, siteId, siteName, type (e.g. inverter_fault, inspection), priority (low | medium | high), status (open | in_progress | resolved), assignedTo, timestamps, archived.

reports — jobId, siteId, technicianId, submittedAt, status (completed | not_completed | …), notes, photoUrls[], adminNotes.

Fields like siteName, technicianName and jobTitle are deliberately duplicated across documents. Firestore has no joins, so denormalisation is what keeps list views to a single query.

Screenshots


Requirements: Node.js 18+, a Firebase project with Authentication, Firestore, Storage and Hosting enabled.

bash
git clone https://github.com/juliusberzinskas/SolarRadar-Web.git
cd SolarRadar-Web
npm install

Create a .env file in the project root:

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

Then:

bash
npm run dev      # development server
npm run build    # production build
firebase deploy  # deploy hosting, rules and functions

Security rules are in firestore.rules and storage.rules and must be deployed for role-based access to work.

Browser support: Chrome, Firefox and Edge 100+, Safari 15+.

Testing

Manual black-box testing across 19 test cases covering four modules: authentication and role management, the admin panel, real-time synchronisation, and the Android app.

Test environment: Chrome on Windows 11 at 1920×1080; Android 13 emulator plus a physical Samsung Galaxy S23 Ultra; Firebase Blaze plan with Firestore in europe-west.

All 19 cases passed. Three minor non-functional defects were found and fixed during testing. All 14 functional requirements were verified.

Roadmap

Development of the mobile app is ongoing. Planned:

Offline mode for sites with no coverage
Work-hour logging
Technician shift calendar
Push notifications on job assignment
Note on data

This repository contains no client data. The system was developed and demonstrated using generated test data only — the company's internal records were never used in the project.

Author

Julius Beržinskas

Eight years in solar construction in Sweden — installation, site supervision and quality inspection — before building this. The subject was not chosen at random: I spent years on the other side of it, logging faults and watching information get lost between the site and the office.
