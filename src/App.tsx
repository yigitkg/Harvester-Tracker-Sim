import './App.css'
import './index.css'
import { useSimulation } from './sim/useSimulation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTractor } from '@fortawesome/free-solid-svg-icons'
import { MapField } from './map/MapField'
import { useLaneSim } from './map/useLaneSim'
import type { Feature, LineString as TLineString, Polygon as TPolygon } from 'geojson'
import { useState } from 'react'
import * as turf from '@turf/turf'
import { generateLanes } from './map/laneGen'

function StatusPill({ label, color }: { label: string; color: 'green' | 'yellow' | 'red' }) {
  const cls = color === 'green' ? 'status-green' : color === 'yellow' ? 'status-yellow' : 'status-red'
  return <span className={`status-pill ${cls}`}><span className="w-2 h-2 rounded-full bg-current inline-block"></span>{label}</span>
}

function Header() {
  return (
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <FontAwesomeIcon icon={faTractor} className="text-emerald-400" />
        <span>Biçerdöver İzleme Paneli</span>
        </div>
      <div className="text-sm text-slate-400">Simülasyon</div>
      </div>
  )
}

function MetricsGrid({
  speedKmh, harvestingRateTPerH, harvestingRateKgPerMin, distanceM, throughputKgPerS, lossPct, lossKgPerHa, tankKg, tankFillPct, areaHarvestedHa,
  position,
}: any) {
  const coord = Array.isArray(position)
    ? `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`
    : '—';
  const items = [
    { label: 'Araç Hız', value: `${speedKmh.toFixed(1)} km/sa` },
    { label: 'Hasat Hızı', value: `${harvestingRateTPerH.toFixed(2)} t/sa · ${harvestingRateKgPerMin.toFixed(0)} kg/dk` },
    { label: 'Hazne', value: `${tankKg.toFixed(0)} kg · ${tankFillPct.toFixed(0)}%` },
    { label: 'Dane Kaybı', value: `${lossPct.toFixed(1)}% · ${lossKgPerHa.toFixed(0)} kg/ha` },
    { label: 'Mesafe', value: `${distanceM.toFixed(0)} m` },
    { label: 'Alan', value: `${areaHarvestedHa.toFixed(3)} ha` },
    { label: 'Anlık Akış', value: `${throughputKgPerS.toFixed(1)} kg/sn` },
    { label: 'Koordinat', value: coord, mono: true, wrap: true },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
      {items.map((m) => (
        <div key={m.label} className="card p-3 min-h-[92px] flex flex-col justify-between">
          <div className="metric">
            <div className="text-slate-400 text-[11px] uppercase tracking-wider">{m.label}</div>
            <div
              title={String(m.value)}
              className={`value mt-1 text-center ${m.mono ? 'font-mono tabular-nums' : ''} ${m.wrap ? 'break-all text-base md:text-lg' : 'overflow-hidden text-ellipsis whitespace-nowrap text-xl md:text-2xl'}`}
            >
              {m.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// (Old FieldView removed from rendering; kept out to avoid unused code.)

function Controls({ running, timeScale, onStart, onPause, onReset, onTimeScale }: any) {
  return (
    <div className="card p-4 flex flex-wrap items-center gap-3">
      <button onClick={onStart} disabled={running} className="px-3 py-2 bg-emerald-600 disabled:opacity-50 hover:bg-emerald-500 rounded-lg">Başlat</button>
      <button onClick={onPause} disabled={!running} className="px-3 py-2 bg-slate-700 disabled:opacity-50 hover:bg-slate-600 rounded-lg">Duraklat</button>
      <button onClick={onReset} className="px-3 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg">Sıfırla</button>
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-sm text-slate-400">Zaman</span>
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-700">
          {[1,2,5,20].map((x) => (
            <button key={x} onClick={() => onTimeScale(x)} className={`px-3 py-2 text-sm ${timeScale===x? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{x}x</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function App() {
  const { state, controls, api } = useSimulation()
  const statusColor = state.status === 'Alarm' ? 'red' : state.status === 'Unloading' ? 'yellow' : controls.running ? 'green' : 'yellow'
  // Default demo field (given 4 corners) loaded by default
  const defaultLL: number[][] = [
    [27.364657, 37.656833],
    [27.368453, 37.657979],
    [27.369767, 37.656383],
    [27.365448, 37.655095],
  ]
  const defaultPoly = turf.polygon([[...defaultLL, defaultLL[0]]]) as unknown as Feature<TPolygon>
  const [fieldPolygon] = useState<Feature<TPolygon>>(defaultPoly)
  const [lanes] = useState<Feature<TLineString>[]>(() => generateLanes(defaultPoly as any, { headerWidthM: 7.5 }) as any)
  const laneSim = useLaneSim(
    lanes.length ? lanes : null,
    {
      running: controls.running && state.status !== 'Unloading',
      // Drive visual movement from the effective sim speed
      speedKmh: state.metrics.speedKmh,
      timeScale: state.timeScale,
    }
  )
  const trStatus = state.status === 'Idle' ? 'Boşta' : state.status === 'Harvesting' ? 'Hasat' : state.status === 'Unloading' ? 'Boşaltma' : 'Alarm'
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="w-full p-0 space-y-4">
        <div className="px-6 xl:px-8 2xl:px-12">
          <div
            className={
              `rounded-lg px-4 py-3 text-center font-semibold pointer-events-none transition-opacity duration-200 ` +
              (state.status === 'Alarm'
                ? 'opacity-100 border border-rose-700 bg-rose-900/60 text-rose-200'
                : 'opacity-0 border border-transparent')
            }
          >
            Dane Kaybı Alarmı — Hızı düşürünüz (≥ 7 km/sa kayıp artar)
          </div>
        </div>
        <div className="flex items-center justify-between px-6 xl:px-8 2xl:px-12">
          <StatusPill label={trStatus} color={statusColor as any} />
          <div className="text-sm text-slate-400 font-mono tabular-nums w-28 text-right">Hazne: {state.metrics.tankFillPct.toFixed(0)}%</div>
        </div>
        <div className="w-full px-6 xl:px-8 2xl:px-12">
          <Controls
            running={controls.running}
            timeScale={state.timeScale}
            onStart={api.start}
            onPause={api.pause}
            onReset={api.reset}
            onTimeScale={api.setTimeScale}
          />
          <MetricsGrid {...state.metrics} position={laneSim.position} />
        </div>
        <div className="w-full px-6 xl:px-8 2xl:px-12">
          <MapField lanes={lanes} laneState={laneSim.laneState} position={laneSim.position as any} polygon={fieldPolygon as any} />
        </div>
        {state.summary && (
          <div className="card p-4 w-full px-6 xl:px-8 2xl:px-12">
            <div className="text-lg font-semibold mb-2">Hasat Özeti</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>Toplam hasat: <b>{state.summary.totalHarvestedKg.toFixed(0)} kg</b></div>
              <div>Ortalama kayıp: <b>{state.summary.avgLossPct.toFixed(1)}%</b></div>
              <div>Biçilen alan: <b>{state.summary.areaHa.toFixed(3)} ha</b></div>
              <div>Ortalama hız: <b>{controls.targetSpeedKmh.toFixed(1)} km/sa</b></div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
