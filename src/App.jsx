import DriversCard from './components/DriversCard'
import {useDrivers} from './hooks/useDrivers'
import NavBar from './layout/NavBar'
import Main from './layout/Main'

const Homepage = () => {
  const {drivers, loading, error} = useDrivers()
  // const [selectedDriver, setSelectedDriver] = useState(null);

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div className="bg-rose-50 w-full h-dvh flex flex-col">
      <NavBar />

      <Main>
        <div className="w-full max-w-7xl gap-6 lg:gap-7 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 h-full">
          {drivers.map((driver, index) => (
            <DriversCard
              key={driver.id}
              img={driver.image}
              name={driver.name}
              number={driver.number}
              teamColor={driver.teamColor}
              className={index % 2 === 0 ? 'hover:-rotate-2' : 'hover:-rotate-2'}
            />
          ))}
        </div>
      </Main>
    </div>
  )
}

export default Homepage
