const Main = ({children}) => {
  return (
    <div className="w-full h-full items-center flex flex-col px-5 lg:px-16 md:px-8 py-10 lg:py-16 overflow-scroll scroll-auto no-scrollbar">
      {children}
    </div>
  )
}

export default Main
