# Vibe Tracker 🌊

[![Firebase](https://img.shields.io/badge/Firebase-Deployed-orange)](https://life-tracker-bc437.web.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A premium, dark-mode Habit and Mood tracking application. Focus on your vibe with a glassmorphic UI and intuitive tracking tools.

## 🚀 Live Demo
**Production URL**: [https://life-tracker-bc437.web.app/](https://life-tracker-bc437.web.app/)

## ✨ Features
- **Habit Tracking**: Create, group (Folders), and track habits.
- **Visuals**: Monthly calendar view for each habit + statistics.
- **Mood Logging**: Log your daily vibe with emojis.
- **Security**: Google Auth + strict user data isolation (Firestore Rules).
- **Environment Isolation**: Local development uses Emulators to prevent polluting production data.

## 🛠️ Development Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Athens556/life-tracker.git
    cd life-tracker
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Variables**
    Create a `.env` file in the root directory (copy from example):
    ```bash
    cp .env.example .env
    ```
    *Fill in your Firebase API keys in `.env`.*

4.  **Run Locally (with Emulators)**
    This starts both the Firebase Emulators (fake DB/Auth) and the Vite frontend.
    ```bash
    npm run emulators
    # In another terminal:
    npm run dev
    ```
    Open [http://localhost:5173](http://localhost:5173).

## 🔒 Security
- **Credentials**: Stored in `.env` (not committed).
- **Database**: Firestore Security Rules ensure users can only access their own data.

## 📦 Deployment
Deployment is manual to ensure stability.
```bash
npm run build
firebase deploy
```
