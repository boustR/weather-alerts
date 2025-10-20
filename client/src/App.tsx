/*import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'*/

export default function App() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "2rem auto",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <h1>🌦️ Weather SMS Alerts</h1>
      <p>
        Welcome! This is your placeholder UI. Soon you’ll connect it to a
        backend that:
      </p>

      <ul>
        <li>✅ Lets users save locations and temperature alert rules</li>
        <li>🌡️ Checks weather data from <strong>Open-Meteo</strong></li>
        <li>📱 Sends SMS alerts via <strong>Twilio</strong></li>
        <li>
          ✉️ Accepts “ACK &lt;id&gt;” replies to acknowledge active alerts
        </li>
      </ul>

      <p style={{ marginTop: 24, fontSize: 14, color: "#666" }}>
        You’ll soon be able to add and view your own rules here.
      </p>
    </main>
  );
}

