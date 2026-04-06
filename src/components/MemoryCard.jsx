import {Radio} from 'lucide-react'
import {useRef, useEffect} from 'react'

const MemoryCard = ({moment, driver}) => {
  const cardRef = useRef(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const setSpan = () => {
      const height = card.getBoundingClientRect().height
      card.style.gridRowEnd = `span ${Math.ceil((height + 16) / 10)}`
    }

    const observer = new ResizeObserver(setSpan)
    observer.observe(card)

    return () => observer.disconnect()
  }, [moment])

  return (
    <div ref={cardRef} className="flex flex-col gap-3 cursor-pointer">
      {/* Moment Image */}
      <div className="bg-gray-200">
        {moment.imageUrl ? (
          <img src={moment.imageUrl} alt={moment.title} className="w-full h-auto object-cover" />
        ) : (
          <div className="w-full h-64 flex items-center justify-center">
            <span className="text-4xl">🏎️</span>
          </div>
        )}
      </div>

      {/* Moment Info */}
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold">{moment.title}</h3>
        <p className="text-gray-600 font-quicksand text-sm">{moment.description}</p>

        {moment.radio && (
          <div className="border-l-4 p-4 rounded" style={{borderColor: driver.teamColor}}>
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4" />
              <span className="text-xs font-bold text-gray-500 uppercase">Team Radio</span>
            </div>
            <p className="text-sm italic">"{moment.radio}"</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MemoryCard
