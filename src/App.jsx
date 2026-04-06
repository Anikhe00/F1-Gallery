import {BrowserRouter, Routes, Route} from 'react-router-dom'
import Gallery from './pages/Gallery'
import DriversPage from './pages/DriversPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/drivers/:id" element={<DriversPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
