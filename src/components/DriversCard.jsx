import Pin from './Pin'
import {useNavigate} from 'react-router-dom'

const DriversCard = ({driver, className}) => {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/drivers/${driver.id}`)}
      className={`px-4 pt-4 pb-4 lg:pb-6 bg-white flex flex-col gap-4 shadow-xs cursor-pointer transition-transform duration-300 rotate-0 hover:shadow-sm ${className}`}
    >
      <div className="absolute top-[-20px] left-1/2 -translate-x-1/2">
        <Pin color={driver.teamColor} />
      </div>
      <div className="bg-red-300">
        <img
          src={driver.image}
          alt={driver.name}
          className="h-[200px] md:h-[240px] lg:h-[280px] w-full object-cover object-top"
        />
      </div>
      <div className="flex flex-row justify-between items-center">
        <p className="text-base lg:text-xl font-medium">{driver.name}</p>
        <p className="text-sm lg:text-lg">{driver.number}</p>
      </div>
    </div>
  )
}

export default DriversCard
