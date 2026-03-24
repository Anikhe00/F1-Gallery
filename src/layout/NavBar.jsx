import F1Logo from '../assets/F1Logo.svg'

const NavBar = () => {
  return (
    <header className="flex px-5 items-center justify-center lg:px-16 md:px-10 py-3 border-b border-b-red-200">
      <div className="w-full max-w-7xl">
        <div className="flex flex-row gap-1 items-center">
          <img src={F1Logo} alt="Logo" />
          <h1 className="text-xl lg:text-2xl font-medium">F1 Gallery</h1>
        </div>
      </div>
    </header>
  )
}

export default NavBar
