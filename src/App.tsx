import { useEffect } from 'react'
import { useStore } from './store/useStore'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Gateway from './components/Gateway'
import Agents from './components/Agents'
import Channels from './components/Channels'
import Skills from './components/Skills'
import Config from './components/Config'
import Doctor from './components/Doctor'
import Install from './components/Install'
import Welcome from './components/Welcome'

export default function App() {
  const { activeTab, setOcInstalled, setOcVersion, setGatewayRunning, showWelcome, setShowWelcome } = useStore()

  useEffect(() => {
    // Check installation status on startup — show welcome if not installed and never seen guide
    window.openclaw.checkInstalled().then(({ installed, version }) => {
      setOcInstalled(installed)
      setOcVersion(version)
      if (!installed && !localStorage.getItem('oc_welcomed')) {
        setShowWelcome(true)
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
      case 'gateway': return <Gateway />
      case 'agents': return <Agents />
      case 'channels': return <Channels />
      case 'skills': return <Skills />
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
