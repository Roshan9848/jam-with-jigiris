# Jam with Jigris - QR Entry Scan & Ticket Portal

A sleek, premium, mobile-first web application designed for verifying influencer guest entries and generating custom tickets at your jamming session events.

## Features
- **Mobile-First Scanner**: Automatic camera initialization on launch, slide-up bottom sheets, pulsing scans, haptic alerts, and peripheral feedback status glows.
- **Admin Portal Panel**: Statistics widgets, manual check-in overrides, database filters, arrival feeds, and CSV export.
- **Live Ticket Customizer**: Modify titles, dates, times, color theme, and rules in real-time.
- **High-Quality PDF Generation**: Automatic base64 rendering including event logos and unique scan IDs.
- **Secure Dashboard Access**: Locks admin configurations behind credentials (`checkin@a19.com` / `12345`).

## Quick Start Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Local Server**:
   ```bash
   npm start
   ```

3. **Accessing the Portal**:
   - **Bouncers Scanner App**: [http://localhost:3000](http://localhost:3000) (Direct camera scanning)
   - **Admin Control Portal**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html) (Requires login credentials)

## Connecting Bouncers at the Venue
1. Connect your laptop and all bouncers' mobile phones to the same Wi-Fi router (no internet required, a mobile hotspot works too).
2. Look at the terminal startup logs to copy the **Network Access IP Address** (e.g. `http://192.168.1.15:3000`).
3. Open this address on the bouncers' mobile browsers to let them scan instantly at the gate.

## Push to your GitHub Repository

To upload this project to your GitHub:
1. Create a new empty repository on [GitHub](https://github.com/new).
2. Open terminal in the project directory and run:
   ```bash
   git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
   git branch -M main
   git push -u origin main
   ```
