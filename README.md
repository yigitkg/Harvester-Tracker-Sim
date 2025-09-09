# Harvester Tracker Sim

Real-time combine harvester monitoring simulation with an animated SVG field map and professional, smooth UI/UX.
Live metrics (speed, throughput, distance, tank fill, grain loss) with sticky alarms, unloading flow, and post-run summary.
Built with React, TypeScript, Tailwind, and Vite using mock data; designed for future integration with real telemetry.

## Live Demo

- Netlify: https://harvester-tracker-sm.netlify.app/

## Run Locally

Prerequisites:
- Node.js 20.19+ recommended (Vite 7 requirement). Earlier 20.x may work but is not guaranteed.

Steps:
1) Clone the repo and navigate into the app folder
   - `git clone https://github.com/yigitkg/Harvester-Tracker-Sim.git`
   - `cd Harvester-Tracker-Sim`
2) Install dependencies
   - `npm install`
3) Start the dev server
   - `npm run dev`
4) Open the URL shown (typically `http://localhost:5173`)

Useful scripts:
- `npm run build` – production build
- `npm run preview` – preview built app
- `npm run lint` – run ESLint rules

## What This Project Demonstrates

- Live harvester movement across a field (SVG) with smooth animations.
- Real-time performance metrics: speed, harvesting rate, distance, grain throughput, grain loss.
- Alarm logic: visible warning/alarm when speed exceeds optimal thresholds; sticky until resolved.
- Unloading flow: tank fill → drive to trailer → unload animation → summary modal.
- Operator statuses: Idle, Harvesting, Unloading, Alarm.

## Tech Stack and UI

- React + TypeScript + Vite
- Tailwind CSS for styling
- Font Awesome (CDN) for harvester icon (`fa-solid fa-tractor`)

## Purpose and Next Steps

This is a professional UI/UX prototype for agricultural operations monitoring. It uses a deterministic simulation to generate realistic telemetry for design validation, demos, and training. The architecture can be extended to read real machine data and support multiple machines and maps.
