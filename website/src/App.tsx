import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { Hero } from './components/sections/Hero'
import { Installation } from './components/sections/Installation'
import { HowItWorks } from './components/sections/HowItWorks'
import { Performance } from './components/sections/Performance'
import { CliReference } from './components/sections/CliReference'
import { Gdock } from './components/sections/Gdock'

function App() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors">
      <Header />
      <main>
        <Hero />
        <Gdock />
        <HowItWorks />
        <Performance />
        <Installation />
        <CliReference />
      </main>
      <Footer />
    </div>
  )
}

export default App
