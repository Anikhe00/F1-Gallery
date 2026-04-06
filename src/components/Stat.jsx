const Stat = ({statName, statCount}) => {
  return (
    <div className="w-full h-auto pb-4 border-b border-b-rose-200 flex flex-row items-center justify-between">
      <div className="text-sm font-medium text-gray-700 font-quicksand">{statName}</div>
      <div className="text-sm font-semibold text-gray-800 font-quicksand">{statCount}</div>
    </div>
  )
}

export default Stat
