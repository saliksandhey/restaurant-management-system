import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'

export default function QRScanner() {
  const navigate = useNavigate()
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | starting | scanning | success | error | permission_denied
  const [errorMsg, setErrorMsg] = useState('')
  const [scannedUrl, setScannedUrl] = useState('')
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState(null)

  const startScanner = async (cameraId) => {
    setStatus('starting')
    setErrorMsg('')

    try {
      if (html5QrCodeRef.current) {
        try { await html5QrCodeRef.current.stop() } catch (_) {}
      }

      const scanner = new Html5Qrcode('qr-reader')
      html5QrCodeRef.current = scanner

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
      }

      await scanner.start(
        cameraId || { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleQRResult(decodedText, scanner)
        },
        () => {} // ignore scan errors (they're frequent during scanning)
      )

      setStatus('scanning')
    } catch (err) {
      console.error('Scanner error:', err)
      if (err.toString().includes('Permission')) {
        setStatus('permission_denied')
      } else {
        setStatus('error')
        setErrorMsg(err.message || 'Could not start camera.')
      }
    }
  }

  const handleQRResult = async (decodedText, scanner) => {
    // Stop scanner immediately
    try { await scanner.stop() } catch (_) {}

    setScannedUrl(decodedText)
    setStatus('success')

    // Try to extract the path from the scanned URL and navigate
    try {
      const url = new URL(decodedText)
      const path = url.pathname + url.search
      // Small delay so user sees the success state
      setTimeout(() => navigate(path), 1200)
    } catch {
      // Not a valid URL — show the raw result
      setStatus('error')
      setErrorMsg(`Scanned text is not a valid menu URL: "${decodedText}"`)
    }
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try { await html5QrCodeRef.current.stop() } catch (_) {}
    }
    setStatus('idle')
  }

  // Load available cameras on mount
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices)
          // Prefer back/environment camera
          const backCam = devices.find(d =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          )
          setSelectedCamera(backCam ? backCam.id : devices[devices.length - 1].id)
        }
      })
      .catch(() => {
        // Will handle on start
      })

    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
          <i className="fa-solid fa-utensils text-2xl text-white"></i>
        </div>
        <h1 className="text-2xl font-black tracking-tight">The Great Bites</h1>
        <p className="text-slate-400 text-sm mt-1">Scan your table QR code to start ordering</p>
      </div>

      {/* Scanner Card */}
      <div className="w-full max-w-sm bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border border-slate-700">

        {/* Camera Viewfinder Area */}
        <div className="relative bg-black aspect-square">
          {/* The html5-qrcode will inject video here */}
          <div id="qr-reader" ref={scannerRef} className="w-full h-full" />

          {/* Overlay when not scanning */}
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm">
              {status === 'idle' && (
                <>
                  <div className="w-48 h-48 border-2 border-dashed border-slate-600 rounded-2xl flex items-center justify-center mb-4">
                    <i className="fa-solid fa-qrcode text-6xl text-slate-600"></i>
                  </div>
                  <p className="text-slate-400 text-sm">Camera preview will appear here</p>
                </>
              )}
              {status === 'starting' && (
                <>
                  <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-300 font-medium">Starting camera...</p>
                </>
              )}
              {status === 'success' && (
                <div className="text-center animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-check text-3xl text-white"></i>
                  </div>
                  <p className="text-green-400 font-bold text-lg">QR Code Scanned!</p>
                  <p className="text-slate-400 text-sm mt-1">Redirecting to menu...</p>
                </div>
              )}
              {status === 'permission_denied' && (
                <div className="text-center px-6">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-video-slash text-2xl text-red-400"></i>
                  </div>
                  <p className="text-red-400 font-bold mb-2">Camera Access Denied</p>
                  <p className="text-slate-400 text-xs leading-relaxed">Please allow camera access in your browser settings, then try again.</p>
                </div>
              )}
              {status === 'error' && (
                <div className="text-center px-6">
                  <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fa-solid fa-triangle-exclamation text-2xl text-amber-400"></i>
                  </div>
                  <p className="text-amber-400 font-bold mb-2 text-sm">Scan Failed</p>
                  <p className="text-slate-500 text-xs">{errorMsg}</p>
                </div>
              )}
            </div>
          )}

          {/* Scanning frame overlay */}
          {status === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Corner brackets */}
              <div className="relative w-56 h-56">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-lg"></div>
                {/* Scanning line animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-orange-400 opacity-80 animate-scan-line"></div>
              </div>
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div className="p-5 space-y-4">
          {/* Camera selector (only shown if multiple cameras) */}
          {cameras.length > 1 && status !== 'scanning' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 block">
                <i className="fa-solid fa-camera mr-1"></i> Select Camera
              </label>
              <select
                value={selectedCamera || ''}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {cameras.map(cam => (
                  <option key={cam.id} value={cam.id}>{cam.label || `Camera ${cam.id.slice(0, 8)}`}</option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          {(status === 'idle' || status === 'error' || status === 'permission_denied') && (
            <button
              onClick={() => startScanner(selectedCamera)}
              className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition-all rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-orange-500/30"
            >
              <i className="fa-solid fa-camera"></i>
              {status === 'error' || status === 'permission_denied' ? 'Try Again' : 'Start Camera'}
            </button>
          )}

          {status === 'scanning' && (
            <button
              onClick={stopScanner}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 active:scale-[0.98] transition-all rounded-2xl font-bold flex items-center justify-center gap-3"
            >
              <i className="fa-solid fa-stop"></i>
              Stop Scanner
            </button>
          )}

          {status === 'starting' && (
            <button disabled className="w-full py-4 bg-slate-700 rounded-2xl font-bold text-slate-500 cursor-not-allowed">
              Please wait...
            </button>
          )}

          {/* Divider + Manual Entry */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700"></div>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>

          <ManualTableEntry navigate={navigate} />
        </div>
      </div>

      {/* Tip text */}
      <p className="mt-6 text-xs text-slate-600 text-center max-w-xs">
        <i className="fa-solid fa-circle-info mr-1"></i>
        Point your camera at the QR code on your table to automatically open the menu.
      </p>

      {/* Scanning line CSS animation */}
      <style>{`
        @keyframes scan-line {
          0% { top: 8px; }
          50% { top: calc(100% - 8px); }
          100% { top: 8px; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #qr-reader {
          border: none !important;
        }
        #qr-reader__scan_region {
          background: transparent !important;
        }
      `}</style>
    </div>
  )
}

function ManualTableEntry({ navigate }) {
  const [tableNum, setTableNum] = useState('')
  const handleGo = () => {
    const num = parseInt(tableNum)
    if (!num || num < 1) return
    navigate(`/?table=${num}`)
  }
  return (
    <div className="flex gap-2">
      <input
        type="number"
        min="1"
        value={tableNum}
        onChange={e => setTableNum(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleGo()}
        placeholder="Table number"
        className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-slate-500"
      />
      <button
        onClick={handleGo}
        disabled={!tableNum}
        className="px-5 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold transition-colors text-sm"
      >
        <i className="fa-solid fa-arrow-right"></i>
      </button>
    </div>
  )
}
