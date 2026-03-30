import { useEffect } from 'react'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Gateway from './components/Gateway'
import Agents from './components/Agents'
import Channels from './components/Channels'
import Config from './components/Config'
import Doctor from './components/Doctor'
import Install from './components/Install'
import Welcome from './components/Welcome'
import WebDashboard from './components/WebDashboard'
import Chat from './components/Chat'
import CronTasks from './components/CronTasks'

export default function App() {
  const { activeTab, setOcInstalled, setOcVersion, setGatewayRunning, showWelcome, setShowWelcome, gatewayAutoStart } = useStore()

  useEffect(() => {
    // Check installation status on startup — show welcome if not installed and never seen guide
    window.openclaw.checkInstalled().then(async ({ installed, version }) => {
      setOcInstalled(installed)
      setOcVersion(version)
      if (!installed && !localStorage.getItem('oc_welcomed')) {
        setShowWelcome(true)
      }
      // Auto-start gateway if enabled and openclaw is installed
      if (installed && gatewayAutoStart) {
        const running = await window.openclaw.gatewayStatus().catch(() => false)
        setGatewayRunning(running)
        if (!running) {
          window.openclaw.startManagedGateway().catch(() => {})
        }
      }
    }).catch(() => {
      setOcInstalled(false)
      setOcVersion(null)
    })

    // Check gateway status on startup
    window.openclaw.gatewayStatus().then((running) => {
      setGatewayRunning(running)
    }).catch(() => {
      setGatewayRunning(false)
    })
  }, [])

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'chat': return <Chat />
      case 'cron': return <CronTasks />
      case 'gateway': return <Gateway />
      case 'agents': return <Agents />
      case 'channels': return <Channels />
      case 'config': return <Config />
      case 'doctor': return <Doctor />
      case 'install': return <Install />
      default: return <Dashboard />
    }
  }

  return (
    <>
      <Layout>
        <div className="fade-in h-full">
          {renderContent()}
        </div>
      </Layout>
      {showWelcome && <Welcome onClose={() => setShowWelcome(false)} />}
    </>
  )
}
