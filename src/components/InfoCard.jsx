import Stat from './Stat'
import {ArrowLeft} from 'lucide-react'

const InfoCard = ({driver, onClick}) => {
  return (
    <div className="flex flex-col gap-8 items-start shrink-0 self-stretch lg:w-80 md:w-55">
      {/* Back Button */}
      <button
        onClick={onClick}
        className="hidden md:flex lg:flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back to home</span>
      </button>

      {/* Drivers Name */}
      <div className="flex flex-row md:flex-col lg:flex-col gap-1 text-5xl md:text-6xl lg:text-6xl font-quicksand font-medium text-gray-900">
        <h1>{driver.name.split(' ')[0]}</h1>
        <h1>{driver.name.split(' ')[1]}</h1>
      </div>

      {/* Driver Stats */}
      <div className="flex flex-col items-start gap-4 self-stretch">
        <Stat statName="Car number" statCount={driver.number} />
        <Stat statName="Team" statCount={driver.team} />
        <Stat statName="Nationality" statCount={driver.nationality} />
        <Stat statName="Grand Prix Entered" statCount={driver.grandPrixEntered} />
        <Stat statName="Total Race Wins" statCount={driver.wins} />
        <Stat statName="Championships" statCount={driver.championships} />
        <Stat statName="Podiums" statCount={driver.podiums} />
        <Stat statName="Pole Positions" statCount={driver.polePositions} />
      </div>
    </div>
  )
}

export default InfoCard
