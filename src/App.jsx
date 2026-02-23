import { useState, useCallback } from 'react'
import './App.css'

// Instrument presets — auto-fill defaults, all editable
const INSTRUMENTS = {
  'NAS100': { name: 'NAS100 (US Tech 100)', contractSize: 10, valuePerPoint: 10, type: 'index', icon: '🇺🇸', price: 21500 },
  'NQ':     { name: 'NQ (Nasdaq Futures)',   contractSize: 20, valuePerPoint: 20, type: 'index', icon: '🇺🇸', price: 21500 },
  'EURUSD': { name: 'EUR/USD',              contractSize: 100000, valuePerPoint: 10, type: 'forex', icon: '🇪🇺', price: 1.085 },
  'GBPUSD': { name: 'GBP/USD',              contractSize: 100000, valuePerPoint: 10, type: 'forex', icon: '🇬🇧', price: 1.265 },
}

const LEVERAGE_OPTIONS = [5, 10, 20, 50, 100, 200, 500]

// Store inputs as strings so clearing works naturally
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }

function App() {
  const defaultInst = INSTRUMENTS['NAS100']
  const [instrument, setInstrument] = useState('NAS100')
  const [balance, setBalance] = useState('5000')
  const [stopLoss, setStopLoss] = useState('5')
  const [leverage, setLeverage] = useState(20)
  const [proposedRisk, setProposedRisk] = useState('50')
  const [entryPrice, setEntryPrice] = useState(String(defaultInst.price))
  const [contractSize, setContractSize] = useState(String(defaultInst.contractSize))
  const [valuePerPoint, setValuePerPoint] = useState(String(defaultInst.valuePerPoint))
  const [result, setResult] = useState(null)

  // Auto-fill all fields when instrument changes
  const handleInstrumentChange = (key) => {
    const preset = INSTRUMENTS[key]
    setInstrument(key)
    setEntryPrice(String(preset.price))
    setContractSize(String(preset.contractSize))
    setValuePerPoint(String(preset.valuePerPoint))
    setResult(null)
  }

  const calculate = useCallback(() => {
      const price = num(entryPrice)
      const bal = num(balance)
      const sl = num(stopLoss)
      const cs = num(contractSize)
      const vpp = num(valuePerPoint)
      const risk = num(proposedRisk)
      const isForex = INSTRUMENTS[instrument].type === 'forex'

      if (!price || !bal || !sl || !cs || !vpp) return

      // --- Core formulas ---
      // Margin per lot = (price × contractSize) / leverage
      const marginPerLot = (price * cs) / leverage

      // Max lots from margin
      const maxLots100 = bal / marginPerLot
      const maxLotsSafe = maxLots100 * 0.80

      // If proposed risk is provided, calculate lots for that risk
      // Otherwise, just use max safe lots
      const hasRiskTarget = risk > 0
      let actualLots, canAfford

      if (hasRiskTarget) {
        const lotsForRisk = risk / (sl * vpp)
        canAfford = lotsForRisk <= maxLotsSafe
        actualLots = canAfford ? lotsForRisk : maxLotsSafe
      } else {
        canAfford = true
        actualLots = maxLotsSafe
      }

      const actualRisk = actualLots * sl * vpp
      const marginUsed = actualLots * marginPerLot
      const marginPct = (marginUsed / bal) * 100

      const roundLots = (v) => Math.floor(v * 100) / 100
      const inst = INSTRUMENTS[instrument]

      // Cheat sheet
      const riskTargets = [5, 10, 15, 20, 30, 50]
      const stopTargets = isForex ? [5, 10, 15, 20, 30, 50] : [1, 2, 3, 4, 5, 7, 10]

      const cheatSheet = stopTargets.map(sl => {
        const row = { sl }
        riskTargets.forEach(risk => {
          const lots = risk / (sl * vpp)
          const mNeeded = lots * marginPerLot
          const pct = (mNeeded / bal) * 100
          row[`r${risk}`] = {
            lots: roundLots(lots),
            safe: pct <= 80,
            warning: pct > 80 && pct <= 100,
            impossible: pct > 100,
          }
        })
        return row
      })

      setResult({
        price,
        isForex,
        contractSize: cs,
        marginPerLot: marginPerLot.toFixed(2),
        maxLots100: roundLots(maxLots100),
        maxLotsSafe: roundLots(maxLotsSafe),
        valuePerPoint: vpp,
        // Proposed risk result
        canAfford,
        hasRiskTarget,
        proposedRisk: risk,
        actualLots: roundLots(actualLots),
        actualRisk: actualRisk.toFixed(2),
        marginUsed: marginUsed.toFixed(2),
        marginPct: marginPct.toFixed(1),
        // Cheat sheet
        cheatSheet,
        riskTargets,
        unit: isForex ? 'pips' : 'points',
      })
  }, [instrument, balance, stopLoss, leverage, proposedRisk, entryPrice, contractSize, valuePerPoint])

  const inst = INSTRUMENTS[instrument]

  return (
    <>
      <div className="grain" />
      <div className="app">
        <header className="header">
          <div className="logo-icon">₿</div>
          <span className="logo-text">MarginCalc</span>
        </header>

        <h1 className="page-title">Max Lot Size</h1>
        <p className="page-subtitle">Calculate maximum position size within your margin allowance</p>

        <div className="card">
          {/* Instrument */}
          <div className="input-group">
            <label className="input-label">
              <span className="icon">📊</span> Instrument
            </label>
            <select value={instrument} onChange={e => handleInstrumentChange(e.target.value)}>
              {Object.entries(INSTRUMENTS).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.name}</option>
              ))}
            </select>
          </div>

          {/* Entry Price */}
          <div className="input-group">
            <label className="input-label">
              <span className="icon">📈</span> Entry Price
            </label>
            <div className="input-wrapper">
              {inst.type !== 'forex' && <span className="input-prefix">$</span>}
              <input type="number" className={inst.type !== 'forex' ? 'has-prefix' : ''}
                value={entryPrice}
                onChange={e => setEntryPrice(e.target.value)}
                min={0} step={inst.type === 'forex' ? 0.0001 : 1} />
            </div>
          </div>

          <div className="row">
            {/* Contract Size */}
            <div className="input-group">
              <label className="input-label">
                <span className="icon">📦</span> Contract Size
              </label>
              <div className="input-wrapper">
                <input type="number" value={contractSize}
                  onChange={e => setContractSize(e.target.value)} min={1} />
              </div>
            </div>

            {/* Value per Point/Pip */}
            <div className="input-group">
              <label className="input-label">
                <span className="icon">💲</span> $ / {inst.type === 'forex' ? 'Pip' : 'Point'}
              </label>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input type="number" className="has-prefix" value={valuePerPoint}
                  onChange={e => setValuePerPoint(e.target.value)} min={0.01} step={0.01} />
              </div>
            </div>
          </div>

          <div className="row">
            {/* Balance */}
            <div className="input-group">
              <label className="input-label">
                <span className="icon">💰</span> Balance
              </label>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input type="number" className="has-prefix" value={balance}
                  onChange={e => setBalance(e.target.value)} min={0} />
              </div>
            </div>

            {/* Leverage */}
            <div className="input-group">
              <label className="input-label">
                <span className="icon">⚡</span> Leverage
              </label>
              <select value={leverage} onChange={e => setLeverage(Number(e.target.value))}>
                {LEVERAGE_OPTIONS.map(lev => (
                  <option key={lev} value={lev}>1:{lev}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            {/* Stop Loss */}
            <div className="input-group">
              <label className="input-label">
                <span className="icon">🎯</span> Stop Loss
              </label>
              <div className="input-wrapper">
                <input type="number" className="has-suffix" value={stopLoss}
                  onChange={e => setStopLoss(e.target.value)} min={0.1} step={0.5} />
                <span className="input-suffix">{inst.type === 'forex' ? 'pips' : 'pts'}</span>
              </div>
            </div>

            {/* Proposed Risk */}
            <div className="input-group">
              <label className="input-label">
                <span className="icon">💵</span> Proposed Risk
              </label>
              <div className="input-wrapper">
                <span className="input-prefix">$</span>
                <input type="number" className="has-prefix" value={proposedRisk}
                  onChange={e => setProposedRisk(e.target.value)} min={1} />
              </div>
            </div>
          </div>

          <button className="calc-btn" onClick={calculate}>
            Calculate Lot Size
          </button>
        </div>

        {/* Results */}
        {result && (
          <>
            <div className="results-card">
              <div className="result-header">
                <h3>Position Analysis</h3>
                <div className="price-badge">
                  <span className="dot" />
                  {inst.icon} {result.isForex ? result.price.toFixed(5) : `$${Number(result.price).toLocaleString()}`}
                </div>
              </div>

              {/* Primary result */}
              <div className="result-primary">
                <div className="label">
                  {!result.hasRiskTarget
                    ? 'Maximum safe lot size (80% margin)'
                    : result.canAfford
                      ? `Lot size for $${result.proposedRisk} risk`
                      : `Max safe lot size (capped — $${result.proposedRisk} exceeds margin)`}
                </div>
                <div className="value">{result.actualLots}</div>
                <div className="unit">lots</div>
              </div>

              {result.hasRiskTarget && !result.canAfford && (
                <div className="margin-warning" style={{ margin: '0', borderRadius: '0', border: 'none', borderBottom: '1px solid var(--border)' }}>
                  <span className="warn-icon">⚠️</span>
                  <div>
                    Your proposed risk of <strong>${result.proposedRisk}</strong> requires more margin than available.
                    Defaulting to <strong>{result.actualLots} lots</strong> (80% margin) with an actual risk
                    of <strong>${result.actualRisk}</strong>.
                  </div>
                </div>
              )}

              <div className="results-grid">
                <div className="item">
                  <div className="label">Actual Risk</div>
                  <div className="val">${result.actualRisk}</div>
                  <div className="sub">{result.canAfford ? 'as requested' : 'margin-limited'}</div>
                </div>
                <div className="item">
                  <div className="label">Margin Used</div>
                  <div className="val">${Number(result.marginUsed).toLocaleString()}</div>
                  <div className="sub">{result.marginPct}% of ${num(balance).toLocaleString()}</div>
                </div>
                <div className="item">
                  <div className="label">Margin / Lot</div>
                  <div className="val">${Number(result.marginPerLot).toLocaleString()}</div>
                  <div className="sub">at 1:{leverage}</div>
                </div>
                <div className="item">
                  <div className="label">$ / {result.isForex ? 'Pip' : 'Point'}</div>
                  <div className="val">${result.valuePerPoint}</div>
                  <div className="sub">per 1.0 lot</div>
                </div>
              </div>

              <div className="formula-bar">
                margin = (price × {result.contractSize.toLocaleString()}) ÷ {leverage} = ${Number(result.marginPerLot).toLocaleString()}/lot
              </div>
            </div>

            {/* Cheat sheet */}
            <div className="cheat-sheet">
              <h3>📋 Risk → Lot Size Cheat Sheet</h3>
              <table className="cheat-table">
                <thead>
                  <tr>
                    <th>SL ({result.unit})</th>
                    {result.riskTargets.map(r => <th key={r}>${r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {result.cheatSheet.map(row => (
                    <tr key={row.sl}>
                      <td>{row.sl}</td>
                      {result.riskTargets.map(r => {
                        const cell = row[`r${r}`]
                        const cls = cell.impossible ? 'impossible' :
                                    cell.warning ? 'warning' :
                                    cell.safe ? 'safe' : ''
                        return (
                          <td key={r} className={cls}>
                            {cell.impossible ? '—' : cell.lots.toFixed(2)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="margin-warning">
              <span className="warn-icon">⚠️</span>
              <div>
                <strong>Green</strong> = within 80% margin (safe).{' '}
                <strong>Amber</strong> = 80–100% margin (risky).{' '}
                <strong>—</strong> = exceeds available margin.
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default App
