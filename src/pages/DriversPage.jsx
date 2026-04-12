import {useParams, useNavigate} from 'react-router-dom'
import {useDrivers} from '../hooks/useDrivers'
import MemoryCard from '../components/MemoryCard'
import InfoCard from '../components/InfoCard'
import MemoriesGrid from '../components/MemoriesGrid'
import {ArrowLeft} from 'lucide-react'

const DriverPage = () => {
  const {id} = useParams()
  const navigate = useNavigate()
  const {drivers, loading, error} = useDrivers()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-50 min-h-screen w-full flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md mx-auto text-center bg-white/50 p-8 rounded-2xl shadow-sm border border-red-100">
          <p className="text-2xl font-bold text-red-600 mb-4 font-indie">Error loading drivers</p>
          <p className="text-gray-600 font-quicksand wrap-break-word whitespace-pre-wrap leading-relaxed">
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-bold shadow-md"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const driver = drivers.find((d) => d.id === id)

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold mb-4">Driver not found</p>
          <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">
            Back to gallery
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-rose-50 h-full">
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="w-full px-5 py-5 flex md:hidden lg:hidden fixed items-center gap-2 text-gray-600 hover:text-gray-900 bg-rose-50"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to home</span>
      </button>

      <div className="px-5 lg:px-16 md:px-8 pt-20 md:pt-10 lg:pt-10 flex flex-col md:flex-row lg:flex-row gap-8 md:gap-10 lg:gap-12 md:h-screen lg:h-screen lg:overflow-hidden no-scrollbar">
        {/* Driver Info */}
        <InfoCard driver={driver} onClick={() => navigate('/')} />
        {/* Memories */}
        {driver.moments && driver.moments.length > 0 ? (
          <div className="flex-1 overflow-hidden h-full">
            <MemoriesGrid>
              {driver.moments.map((moment) => (
                <MemoryCard key={moment.id} moment={moment} driver={driver} />
              ))}
            </MemoriesGrid>
          </div>
        ) : (
          <div className="text-center py-20 w-full h-full flex items-center justify-center flex-col ">
            <p className="text-xl text-gray-500">No memories yet</p>
            <p className="text-gray-400">Check back after the next race!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default DriverPage
