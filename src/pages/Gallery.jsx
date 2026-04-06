import DriversCard from '../components/DriversCard'
import {useDrivers} from '../hooks/useDrivers'
import NavBar from '../layout/NavBar'
import Main from '../layout/Main'

const Gallery = () => {
  const {drivers, loading, error} = useDrivers()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-red-600 mx-auto mb-4"></div>
          <p className="text-xl font-bold">Loading drivers...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600 mb-2">Error loading drivers</p>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-rose-50 w-full h-dvh flex flex-col">
      <NavBar />

      <Main>
        {drivers && drivers.length > 0 ? (
          <div className="w-full max-w-7xl gap-6 lg:gap-7 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 h-full">
            {drivers.map((driver, index) => (
              <DriversCard
                key={driver.id}
                driver={driver}
                className={index % 2 === 0 ? 'hover:-rotate-2' : 'hover:-rotate-2'}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-600">No drivers yet</p>
            <p className="text-gray-500">Add drivers in your Sanity Studio</p>
          </div>
        )}
      </Main>
    </div>
  )
}

export default Gallery
