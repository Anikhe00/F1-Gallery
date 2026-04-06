const MemoriesGrid = ({children}) => {
  return (
    <div className="overflow-y-auto h-full">
      <div
        className="grid grid-cols-3 p-4"
        style={{gridAutoRows: '10px', rowGap: '0px', columnGap: '16px', alignItems: 'start'}}
      >
        {children}
      </div>
    </div>
  )
}

export default MemoriesGrid
