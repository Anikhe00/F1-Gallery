const MemoriesGrid = ({children}) => {
  return (
    <div className="overflow-hidden md:overflow-y-auto lg:overflow-y-auto h-full no-scrollbar">
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:p-4 "
        style={{gridAutoRows: '10px', rowGap: '0px', columnGap: '16px', alignItems: 'start'}}
      >
        {children}
      </div>
    </div>
  )
}

export default MemoriesGrid
